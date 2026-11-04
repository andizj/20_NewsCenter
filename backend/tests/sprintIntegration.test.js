jest.mock('../src/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('axios', () => ({ get: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const { pool } = require('../src/db');
const { calculateSemester } = require('../src/utils/semester');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TAG_ID = '22222222-2222-4222-8222-222222222222';
const TEST_KEY = randomBytes(32).toString('hex');
const TAG = { id: TAG_ID, name: 'events', description: null, subscriberCount: 3 };
const USER = { id: USER_ID, displayName: 'Integration', email: 'integration@example.test', role: 'STUDENT' };

let server;
let baseUrl;
let swaggerDocument;

const token = () => jwt.sign(
  { userId: USER_ID, email: USER.email, role: USER.role },
  TEST_KEY,
  { expiresIn: '5m' }
);
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

beforeAll(() => {
  process.env.JWT_SECRET = TEST_KEY;
  process.env.ALLOWED_ORIGIN = 'http://localhost:8081';
  process.env.PORT = '0';

  // Exercise the real entry point and its mounts on an ephemeral port.
  // Only database and external thesaurus calls are mocked.
  const listen = express.application.listen;
  const listenSpy = jest.spyOn(express.application, 'listen').mockImplementation(function () {
    server = listen.call(this, 0);
    return server;
  });
  const swaggerSpy = jest.spyOn(swaggerUi, 'setup');
  try {
    require('../src/index');
    swaggerDocument = swaggerSpy.mock.calls[0][0];
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  } finally {
    listenSpy.mockRestore();
    swaggerSpy.mockRestore();
  }
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { synsets: [] } });
  pool.query.mockImplementation(async (sql) => {
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Integration checks must not write data');
    if (sql.includes('FROM tags t') || sql.includes('FROM subscriptions s')) {
      return { rows: [TAG] };
    }
    if (sql.includes('FROM users')) {
      return {
        rows: sql.includes('student_id')
          ? [{ studentId: 'if24b032', studyProgram: 'Informatik', degree: 'Bachelor', studyStartYear: 2024 }]
          : [USER],
      };
    }
    throw new Error('Unexpected integration query');
  });
});

describe('Sprint 2 + 3 integration through the actual app', () => {
  test.each(['/api/v1/tags', '/tags'])('subscriber counts via %s', async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([TAG]);
    expect(pool.query.mock.calls[0][0]).toContain('COUNT(s.user_id)::int AS "subscriberCount"');
  });

  test.each(['/api/v1/users/me', '/users/me'])('LDAP profile and semester via %s', async (path) => {
    const response = await fetch(baseUrl + path, { headers: authHeaders() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...USER,
      studyProgram: 'Informatik',
      degree: 'Bachelor',
      studyStartYear: 2024,
      currentSemester: calculateSemester(2024),
    });
  });

  test.each(['/api/v1/users', '/users'])('subscription counts coexist with profile repository via %s', async (path) => {
    const response = await fetch(`${baseUrl}${path}/${USER_ID}/subscriptions`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([TAG]);
    expect(pool.query.mock.calls[1][0]).toContain('COUNT(all_subs.user_id)::int AS "subscriberCount"');
  });

  test.each(['/api/v1/messages/tag-suggestions', '/messages/tag-suggestions'])('publish suggestions via %s', async (path) => {
    const response = await fetch(baseUrl + path, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Events meetup', body: 'Join the events meetup.' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0]).toMatchObject({ type: 'existing', id: TAG_ID, subscriberCount: 3 });
    expect(pool.query.mock.calls.every(([sql]) => /^\s*SELECT\b/i.test(sql))).toBe(true);
  });

  test.each(['/api/v1/users/me', '/users/me'])('profile still requires authentication via %s', async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['/api/v1/messages/tag-suggestions', '/messages/tag-suggestions'])('suggestions require authentication via %s', async (path) => {
    const response = await fetch(baseUrl + path, { method: 'POST' });
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('CORS allows the configured frontend origin on the versioned API', async () => {
    const response = await fetch(baseUrl + '/api/v1/tags', { headers: { Origin: 'http://localhost:8081' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
  });

  test('Swagger combines versioning, subscriber counts and the LDAP profile without a double prefix', () => {
    expect(swaggerDocument.servers[0].url).toMatch(/\/api\/v1$/);
    expect(swaggerDocument.paths['/users/me'].get.security).toEqual([{ BearerAuth: [] }]);
    expect(swaggerDocument.components.schemas.UserProfile.properties.currentSemester).toBeDefined();
    expect(swaggerDocument.components.schemas.Tag.properties.subscriberCount).toBeDefined();
    expect(swaggerDocument.paths['/messages/tag-suggestions']).toBeDefined();
    expect(Object.keys(swaggerDocument.paths).some(path => path.startsWith('/api/v1'))).toBe(false);
    expect(swaggerDocument.paths['/subscribe'].servers[0].url).not.toContain('/api/v1');
  });

  test('SSE remains outside the versioned API and requires a token', async () => {
    const response = await fetch(baseUrl + '/subscribe');
    expect(response.status).toBe(401);
    expect((await fetch(baseUrl + '/api/v1/subscribe')).status).toBe(404);
  });
});
