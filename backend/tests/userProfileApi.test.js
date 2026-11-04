jest.mock('../src/repositories/userRepository');

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const jwt = require('jsonwebtoken');
const userRepository = require('../src/repositories/userRepository');
const usersRouter = require('../src/routes/users');
const { calculateSemester } = require('../src/utils/semester');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

let server;
let baseUrl;

const signToken = (overrides = {}, expiresIn = '2h') =>
  jwt.sign(
    {
      userId: USER_ID,
      email: 'if24b032@technikum-wien.at',
      role: 'STUDENT',
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

const get = (path, token) =>
  fetch(baseUrl + path, token ? { headers: { Authorization: `Bearer ${token}` } } : {});

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Beide Mounts wie in src/index.js
  app.use('/api/v1/users', usersRouter);
  app.use('/users', usersRouter);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  jest.clearAllMocks();
  userRepository.findById.mockResolvedValue({
    id: USER_ID,
    displayName: 'if24b032',
    email: 'if24b032@technikum-wien.at',
    role: 'STUDENT',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  userRepository.findProfileById.mockResolvedValue({
    studentId: 'if24b032',
    studyProgram: 'Informatik',
    degree: 'Bachelor',
    studyStartYear: 2024,
  });
});

describe('GET /api/v1/users/me – erfolgreiche Abfragen', () => {

  test('gibt Konto- und Profilfelder plus dynamisches Semester zurück', async () => {
    const res = await get('/api/v1/users/me', signToken());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'currentSemester',
      'degree',
      'displayName',
      'email',
      'id',
      'role',
      'studyProgram',
      'studyStartYear',
    ]);
    expect(body).toEqual({
      id: USER_ID,
      displayName: 'if24b032',
      email: 'if24b032@technikum-wien.at',
      role: 'STUDENT',
      studyProgram: 'Informatik',
      degree: 'Bachelor',
      studyStartYear: 2024,
      currentSemester: calculateSemester(2024),
    });
    expect(typeof body.currentSemester).toBe('number');
    expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
    expect(userRepository.findProfileById).toHaveBeenCalledWith(USER_ID);
  });

  test('liefert nie Passwort-Hashes oder andere Auth-Daten', async () => {
    const res = await get('/api/v1/users/me', signToken());
    const text = await res.text();

    expect(text).not.toMatch(/password|password_hash|passwordHash/i);
    expect(text).not.toMatch(/secret|authorization/i);
    expect(JSON.parse(text)).not.toHaveProperty('password_hash');
  });

  test('erkennbar auch unter dem bestehenden /users/me-Pfad', async () => {
    const res = await get('/users/me', signToken());
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(USER_ID);
  });

  test('ignoriert freie Parameter – die ID stammt ausschließlich aus dem JWT', async () => {
    const res = await get(`/api/v1/users/me?id=${OTHER_ID}`, signToken());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(USER_ID);
    expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
    expect(userRepository.findById).not.toHaveBeenCalledWith(OTHER_ID);
  });

});

describe('GET /api/v1/users/me – Benutzer ohne Profildaten', () => {

  test('lokales Konto ohne Kennung: alle Profilfelder null', async () => {
    userRepository.findProfileById.mockResolvedValue({
      studentId: null,
      studyProgram: null,
      degree: null,
      studyStartYear: null,
    });

    const res = await get('/api/v1/users/me', signToken());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: USER_ID,
      displayName: 'if24b032',
      email: 'if24b032@technikum-wien.at',
      role: 'STUDENT',
      studyProgram: null,
      degree: null,
      studyStartYear: null,
      currentSemester: null,
    });
  });

  test('fehlende Profilzeile (null) wird ebenfalls zu null-Feldern', async () => {
    userRepository.findProfileById.mockResolvedValue(null);

    const res = await get('/api/v1/users/me', signToken());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.studyProgram).toBeNull();
    expect(body.degree).toBeNull();
    expect(body.studyStartYear).toBeNull();
    expect(body.currentSemester).toBeNull();
    expect(body.role).toBe('STUDENT');
  });

  test('unbekannte Kennungswerte bleiben als gespeicherter Fallback erhalten', async () => {
    userRepository.findProfileById.mockResolvedValue({
      studentId: 'xy99z999',
      studyProgram: 'unbekannt',
      degree: 'unbekannt',
      studyStartYear: 2099,
    });

    const res = await get('/api/v1/users/me', signToken());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.studyProgram).toBe('unbekannt');
    expect(body.degree).toBe('unbekannt');
    expect(body.currentSemester).toBe(calculateSemester(2099));
  });

});

describe('GET /api/v1/users/me – fehlende/ungültige Authentifizierung', () => {

  test('ohne Authorization-Header → 401 MISSING_AUTH_HEADER', async () => {
    const res = await get('/api/v1/users/me');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'MISSING_AUTH_HEADER' });
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('falsches Scheme → 401 INVALID_AUTH_FORMAT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { Authorization: `Basic ${Buffer.from('user:pw').toString('base64')}` },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_AUTH_FORMAT' });
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('ungültiges Token → 401 INVALID_OR_EXPIRED_TOKEN', async () => {
    const res = await get('/api/v1/users/me', 'not-a-valid-jwt');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('abgelaufenes Token → 401 INVALID_OR_EXPIRED_TOKEN', async () => {
    const res = await get('/api/v1/users/me', signToken({}, '-10s'));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('Token mit fremder Signatur → 401', async () => {
    const foreign = jwt.sign({ userId: USER_ID }, 'anderer-secret', { expiresIn: '2h' });
    const res = await get('/api/v1/users/me', foreign);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_OR_EXPIRED_TOKEN' });
  });

});

describe('GET /api/v1/users/me – Fehlerfälle', () => {

  test('gültiges Token, aber Benutzer nicht vorhanden → 404', async () => {
    userRepository.findById.mockResolvedValue(null);

    const res = await get('/api/v1/users/me', signToken());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'User not found' });
    expect(userRepository.findProfileById).not.toHaveBeenCalled();
  });

});
