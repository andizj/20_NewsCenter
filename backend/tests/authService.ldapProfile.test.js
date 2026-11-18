const { EventEmitter } = require('events');
const ldap = require('ldapjs');
const { SearchResultEntry } = require('@ldapjs/messages');
const { authenticateLDAP } = require('../src/services/authService');

const USERNAME = 'if24b032';
const PASSWORD = 'synthetic-test-password';
const GIVEN = 'Vornamen-Fixture';
const SURNAME = 'Nachnamen-Fixture';
const DISPLAY_NAME = `${GIVEN} ${SURNAME}`;
const ATTRIBUTES = [
  { type: 'givenName', values: [GIVEN] },
  { type: 'sn', values: [SURNAME] },
  { type: 'uid', values: [USERNAME] },
];

let client;
let result;
let bindDN;
let createClient;

beforeEach(() => {
  process.env.LDAP_URL = 'ldap://diagnostic.invalid';
  process.env.LDAP_BASE_DN = 'ou=people,dc=example,dc=invalid';
  result = new EventEmitter();
  client = new EventEmitter();
  client.starttls = jest.fn((_, controls, callback) => callback(null));
  client.bind = jest.fn((dn, password, callback) => { bindDN = dn; callback(null); });
  client.search = jest.fn((base, options, callback) => callback(null, result));
  client.unbind = jest.fn(callback => callback());
  client.destroy = jest.fn();
  createClient = jest.spyOn(ldap, 'createClient').mockReturnValue(client);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function finishEntry({ dn, attributes = ATTRIBUTES, entries, status = 0 } = {}) {
  if (entries) entries.forEach(entry => result.emit('searchEntry', entry));
  else result.emit('searchEntry', new SearchResultEntry({ objectName: dn || bindDN, attributes }));
  result.emit('end', { status });
}

test('reads the verified full name on the same StartTLS connection before unbind', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  expect(client.unbind).not.toHaveBeenCalled();
  expect(client.bind).toHaveBeenCalledWith(bindDN, PASSWORD, expect.any(Function));
  expect(client.search).toHaveBeenCalledWith(bindDN, {
    scope: 'base', filter: '(objectClass=*)',
    attributes: ['givenName', 'sn', 'displayName', 'cn', 'uid'],
    derefAliases: 0, sizeLimit: 1, timeLimit: 5,
  }, expect.any(Function));
  finishEntry();
  await expect(pending).resolves.toEqual({ authenticated: true, displayName: DISPLAY_NAME, profileReadStatus: 'ok' });
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(client.starttls.mock.invocationCallOrder[0]).toBeLessThan(client.bind.mock.invocationCallOrder[0]);
  expect(client.bind.mock.invocationCallOrder[0]).toBeLessThan(client.search.mock.invocationCallOrder[0]);
  expect(client.search.mock.invocationCallOrder[0]).toBeLessThan(client.unbind.mock.invocationCallOrder[0]);
  expect(client.unbind).toHaveBeenCalledTimes(1);
  expect(client.destroy).toHaveBeenCalledTimes(1);
});

test.each([
  ['attribute type case', dn => dn.replace(/uid=|ou=|dc=/g, value => value.toUpperCase())],
  ['standard value case with matching uid', dn => dn.replace('ou=people', 'ou=People')],
])('uses the diagnostic identity rules for %s', async (_, transform) => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ dn: transform(bindDN) });
  expect((await pending).displayName).toBe(DISPLAY_NAME);
});

test('does not accept value-case differences without a confirming uid', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ dn: bindDN.replace('ou=people', 'ou=People'), attributes: ATTRIBUTES.slice(0, 2) });
  await expect(pending).resolves.toMatchObject({ authenticated: true, displayName: null, profileReadStatus: 'unverified_entry' });
});

test('a matching uid does not authorize an unrelated DN', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ dn: bindDN.replace('ou=people', 'ou=other') });
  expect((await pending).profileReadStatus).toBe('unverified_entry');
});

test('a conflicting uid rejects the name despite an exact DN', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ attributes: [...ATTRIBUTES.slice(0, 2), { type: 'uid', values: ['different-identity'] }] });
  expect((await pending).displayName).toBeNull();
});

test('unknown DN matching rules are not guessed', async () => {
  process.env.LDAP_BASE_DN = 'ou=people,opaqueKey=MixedCase,dc=example,dc=invalid';
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ dn: bindDN.replace('MixedCase', 'mixedcase') });
  expect((await pending).profileReadStatus).toBe('unverified_entry');
});

test('escapes the bind RDN without changing the supplied identity', async () => {
  const username = 'employee,example';
  const pending = authenticateLDAP(username, PASSWORD);
  expect(ldap.parseDN(bindDN).rdnAt(0).getValue('uid')).toBe(username);
  finishEntry({ attributes: [...ATTRIBUTES.slice(0, 2), { type: 'uid', values: [username] }] });
  expect((await pending).displayName).toBe(DISPLAY_NAME);
});

test('preserves Unicode, compound names and attribute language options', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ attributes: [
    { type: 'GIVENNAME;lang-de', values: ['  Ä-Test Zweitname  '] },
    { type: 'SN', values: [' Ö-Test-Nachname '] },
    ATTRIBUTES[2],
  ] });
  expect((await pending).displayName).toBe('Ä-Test Zweitname Ö-Test-Nachname');
});

test.each([
  [],
  [{ type: 'givenName', values: [GIVEN] }],
  [{ type: 'givenName', values: [' '] }, { type: 'sn', values: [SURNAME] }],
  [{ type: 'givenName', values: [GIVEN, 'second-value'] }, { type: 'sn', values: [SURNAME] }],
  [{ type: 'givenName', values: [USERNAME] }, { type: 'sn', values: [SURNAME] }],
  [{ type: 'displayName', values: [DISPLAY_NAME] }, { type: 'cn', values: [DISPLAY_NAME] }],
].map(attributes => [attributes]))('missing or ambiguous verified name attributes remain a soft failure %#', async attributes => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ attributes });
  await expect(pending).resolves.toEqual({ authenticated: true, displayName: null, profileReadStatus: 'missing_name_attributes' });
  expect(client.destroy).toHaveBeenCalledTimes(1);
});

test('never uses the first entry of a multiple-entry result', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  const entry = new SearchResultEntry({ objectName: bindDN, attributes: ATTRIBUTES });
  finishEntry({ entries: [entry, entry] });
  expect((await pending).profileReadStatus).toBe('unverified_entry');
});

test('an empty search is a soft failure', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  result.emit('end', { status: 0 });
  await expect(pending).resolves.toMatchObject({ authenticated: true, displayName: null, profileReadStatus: 'not_found' });
});

test('does not follow referrals or accept their name attributes', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  result.emit('searchReference', {});
  finishEntry();
  expect((await pending).profileReadStatus).toBe('unverified_entry');
});

test('invalid LDAP payloads do not invalidate authentication', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry({ entries: [{ pojo: { objectName: bindDN, attributes: 'invalid' } }] });
  await expect(pending).resolves.toMatchObject({ authenticated: true, displayName: null, profileReadStatus: 'invalid_response' });
});

test.each(['callback', 'event', 'throw', 'result-code'])('failed search (%s) preserves bind success and closes the connection', async failure => {
  const sensitiveError = new Error('private LDAP data must not be logged');
  if (failure === 'callback') client.search.mockImplementation((base, options, callback) => callback(sensitiveError));
  if (failure === 'throw') client.search.mockImplementation(() => { throw sensitiveError; });
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  if (failure === 'event') result.emit('error', sensitiveError);
  if (failure === 'result-code') finishEntry({ status: 50 });
  await expect(pending).resolves.toEqual({ authenticated: true, displayName: null, profileReadStatus: 'query_failed' });
  expect(client.unbind).toHaveBeenCalledTimes(1);
  expect(client.destroy).toHaveBeenCalledTimes(1);
});

test('a connection error after bind is a profile failure, not an auth failure', async () => {
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  client.emit('error', new Error('private connection detail'));
  await expect(pending).resolves.toMatchObject({ authenticated: true, displayName: null, profileReadStatus: 'connection_error' });
  expect(client.destroy).toHaveBeenCalledTimes(1);
});

test.each(['tls', 'bind', 'connection'])('authentication failure at %s rejects with a redacted error', async stage => {
  const error = new Error('sensitive authentication detail');
  if (stage === 'tls') client.starttls.mockImplementation((options, controls, callback) => callback(error));
  if (stage === 'bind') client.bind.mockImplementation((dn, password, callback) => callback(error));
  if (stage === 'connection') client.starttls.mockImplementation(() => {});
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  if (stage === 'connection') client.emit('error', error);
  await expect(pending).rejects.toThrow('LDAP authentication failed');
  expect(client.destroy).toHaveBeenCalledTimes(1);
});

test('empty passwords never open a connection', async () => {
  await expect(authenticateLDAP(USERNAME, '')).rejects.toThrow('LDAP credentials are required');
  expect(createClient).not.toHaveBeenCalled();
});

test('client creation errors are redacted', async () => {
  createClient.mockImplementation(() => { throw new Error('private setup detail'); });
  await expect(authenticateLDAP(USERNAME, PASSWORD)).rejects.toThrow('LDAP authentication failed');
});

test('profile-read timeout preserves authentication and closes the client', async () => {
  jest.useFakeTimers();
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  await jest.advanceTimersByTimeAsync(6000);
  await expect(pending).resolves.toMatchObject({ authenticated: true, displayName: null, profileReadStatus: 'timeout' });
  expect(client.destroy).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('a stalled bind times out and closes the client', async () => {
  jest.useFakeTimers();
  client.bind.mockImplementation(() => {});
  const pending = expect(authenticateLDAP(USERNAME, PASSWORD)).rejects.toThrow('LDAP authentication failed');
  await jest.advanceTimersByTimeAsync(20000);
  await pending;
  expect(client.search).not.toHaveBeenCalled();
  expect(client.destroy).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('a stalled unbind is force-closed after a bounded delay', async () => {
  jest.useFakeTimers();
  client.unbind.mockImplementation(() => {});
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry();
  await jest.advanceTimersByTimeAsync(1000);
  expect((await pending).displayName).toBe(DISPLAY_NAME);
  expect(client.destroy).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('cleanup exceptions never replace a successful bind and verified name', async () => {
  client.unbind.mockImplementation(() => { throw new Error('private cleanup detail'); });
  client.destroy.mockImplementation(() => { throw new Error('private cleanup detail'); });
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry();
  expect((await pending).displayName).toBe(DISPLAY_NAME);
});

test('LDAP entries, names and credentials are never logged', async () => {
  const logs = ['log', 'warn', 'error'].map(method => jest.spyOn(console, method).mockImplementation(() => {}));
  const pending = authenticateLDAP(USERNAME, PASSWORD);
  finishEntry();
  await pending;
  logs.forEach(log => expect(log).not.toHaveBeenCalled());
});
