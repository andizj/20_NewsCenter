jest.mock('../src/db', () => ({ pool: { query: jest.fn() } }));

const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { pool } = require('../src/db');
const authService = require('../src/services/authService');
const usersRouter = require('../src/routes/users');
const { calculateSemester } = require('../src/utils/semester');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const USERNAME = 'if24b032';
const EMAIL = `${USERNAME}@technikum-wien.at`;
const DISPLAY_NAME = 'LDAP Namens-Fixture';
const KEY = randomBytes(32).toString('hex');
let row;
let server;
let baseUrl;
let ldapLogin;
let comparePassword;

const publicUser = () => row && ({ id: row.id, email: row.email, role: row.role, displayName: row.display_name });
const profile = () => row && ({
  studentId: row.student_id ?? null, studyProgram: row.study_program ?? null,
  degree: row.degree ?? null, studyStartYear: row.study_start_year ?? null,
});
const postLogin = () => fetch(baseUrl + '/api/v1/users/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: 'synthetic-password' }),
});
const getProfile = token => fetch(baseUrl + '/api/v1/users/me', { headers: { Authorization: `Bearer ${token}` } });

beforeAll(() => {
  process.env.JWT_SECRET = KEY;
  process.env.JWT_EXPIRES_IN = '2h';
  ldapLogin = jest.spyOn(authService, 'authenticateLDAP');
  comparePassword = jest.spyOn(authService, 'comparePassword');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', usersRouter);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  jest.restoreAllMocks();
  await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
  jest.clearAllMocks();
  row = { id: USER_ID, email: EMAIL, role: 'STUDENT', display_name: USERNAME, password_hash: 'INVALID_LOCAL_LOGIN' };
  ldapLogin.mockResolvedValue({ authenticated: true, displayName: DISPLAY_NAME, profileReadStatus: 'ok' });
  comparePassword.mockResolvedValue(false);
  // Real services/repositories/routes, with only SQL persistence held in memory.
  pool.query.mockImplementation(async (sql, params = []) => {
    if (/SELECT/.test(sql) && /WHERE email =/.test(sql)) return { rows: row ? [row] : [] };
    if (/^\s*SELECT/.test(sql) && sql.includes('student_id')) return { rows: row ? [profile()] : [] };
    if (/^\s*SELECT/.test(sql) && sql.includes('FROM users')) return { rows: row ? [publicUser()] : [] };
    if (/INSERT INTO users/.test(sql)) {
      row = { id: USER_ID, display_name: params[0], email: params[1], password_hash: params[2], role: params[3],
        student_id: params[4], study_program: params[5], degree: params[6], study_start_year: params[7] };
      return { rows: [publicUser()] };
    }
    if (/UPDATE users/.test(sql) && sql.includes('SET student_id')) {
      Object.assign(row, { student_id: params[1], study_program: params[2], degree: params[3], study_start_year: params[4] });
      return { rows: [{ id: row.id, ...profile() }] };
    }
    if (/UPDATE users/.test(sql) && sql.includes('SET display_name')) {
      if (!row.password_hash.includes('INVALID_LOCAL_LOGIN')) return { rows: [] };
      row.display_name = params[1];
      return { rows: [publicUser()] };
    }
    throw new Error('Unexpected test query');
  });
});

test('existing account: login and profile API expose the persisted LDAP name with stable identity and JWT', async () => {
  const response = await postLogin();
  expect(response.status).toBe(200);
  const login = await response.json();
  expect(login.user).toEqual({ id: USER_ID, email: EMAIL, role: 'STUDENT', displayName: DISPLAY_NAME });
  expect(row.display_name).toBe(DISPLAY_NAME);
  expect(row.student_id).toBe(USERNAME);
  const decoded = jwt.verify(login.token, KEY);
  expect(Object.keys(decoded).sort()).toEqual(['email', 'exp', 'iat', 'role', 'userId']);
  expect(decoded.userId).toBe(USER_ID);
  expect(decoded.role).toBe('STUDENT');
  expect(decoded.exp - decoded.iat).toBe(7200);
  const profileResponse = await getProfile(login.token);
  expect(profileResponse.status).toBe(200);
  expect(await profileResponse.json()).toEqual({
    ...login.user, studyProgram: 'Informatik', degree: 'Bachelor', studyStartYear: 2024,
    currentSemester: calculateSemester(2024),
  });
});

test('new LDAP account stores the source name directly and still derives study information from the UID', async () => {
  row = null;
  const response = await postLogin();
  expect(response.status).toBe(200);
  const login = await response.json();
  expect(login.user.displayName).toBe(DISPLAY_NAME);
  expect(row.display_name).toBe(DISPLAY_NAME);
  expect(row.student_id).toBe(USERNAME);
  expect(row.study_program).toBe('Informatik');
  expect(row.role).toBe('STUDENT');
});

test('name changes are refreshed at the next login without recreating the existing account', async () => {
  await postLogin();
  ldapLogin.mockResolvedValue({ authenticated: true, displayName: 'Aktualisierte Namens-Fixture', profileReadStatus: 'ok' });
  const response = await postLogin();
  const login = await response.json();
  expect(row.id).toBe(USER_ID);
  expect(row.display_name).toBe('Aktualisierte Namens-Fixture');
  expect((await (await getProfile(login.token)).json()).displayName).toBe(row.display_name);
  expect(pool.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO users'))).toBe(false);
});

test('failed profile reads keep existing names and still issue a usable session', async () => {
  row.display_name = DISPLAY_NAME;
  ldapLogin.mockResolvedValue({ authenticated: true, displayName: null, profileReadStatus: 'query_failed' });
  const response = await postLogin();
  expect(response.status).toBe(200);
  const login = await response.json();
  expect(login.user.displayName).toBe(DISPLAY_NAME);
  expect((await (await getProfile(login.token)).json()).displayName).toBe(DISPLAY_NAME);
  expect(pool.query.mock.calls.some(([sql]) => sql.includes('SET display_name'))).toBe(false);
});

test('new accounts without a verified name return an explicit empty field, never a guessed name', async () => {
  row = null;
  ldapLogin.mockResolvedValue({ authenticated: true, displayName: null, profileReadStatus: 'missing_name_attributes' });
  const response = await postLogin();
  expect(response.status).toBe(200);
  const login = await response.json();
  expect(login.user.displayName).toBe('');
  expect((await (await getProfile(login.token)).json()).displayName).toBe('');
  expect(row.student_id).toBe(USERNAME);
});

test.each([true, false])('local accounts retain their name, role and empty study profile (local password match: %s)', async localMatch => {
  row.password_hash = 'local-password-hash';
  row.display_name = 'Lokale Namens-Fixture';
  row.role = 'EMPLOYEE';
  comparePassword.mockResolvedValue(localMatch);
  const response = await postLogin();
  expect(response.status).toBe(200);
  const login = await response.json();
  expect(login.user).toMatchObject({ displayName: 'Lokale Namens-Fixture', role: 'EMPLOYEE' });
  expect(row.student_id).toBeUndefined();
  expect(pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
  if (localMatch) expect(ldapLogin).not.toHaveBeenCalled();
});
