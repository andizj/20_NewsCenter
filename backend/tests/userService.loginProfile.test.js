jest.mock('../src/repositories/userRepository');
jest.mock('../src/services/authService');

process.env.JWT_SECRET = 'test-secret';

const userRepository = require('../src/repositories/userRepository');
const authService = require('../src/services/authService');
const { login } = require('../src/services/userService');

const LDAP_HASH_MARKER = 'INVALID_LOCAL_LOGIN';
const LDAP_DISPLAY_NAME = 'LDAP Namens-Fixture';

const ldapRow = (overrides = {}) => ({
  id: 'u-ldap',
  email: 'if22b001@technikum-wien.at',
  display_name: 'if22b001',
  role: 'STUDENT',
  password_hash: `$2b$10$${LDAP_HASH_MARKER}_FOR_LDAP_USER_0000000`,
  ...overrides,
});

const localRow = (overrides = {}) => ({
  id: 'u-local',
  email: 'if24b032@technikum-wien.at',
  display_name: 'Lokaler Account',
  role: 'STUDENT',
  password_hash: '$2b$10$realLocalBcryptHash000000000000000',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  authService.comparePassword.mockResolvedValue(false);
  authService.authenticateLDAP.mockResolvedValue({ authenticated: true, displayName: LDAP_DISPLAY_NAME, profileReadStatus: 'ok' });
  authService.generateToken.mockReturnValue('jwt-token');
  userRepository.findByEmail.mockResolvedValue(null);
  userRepository.create.mockImplementation(async user => ({
    id: 'u-new',
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }));
  userRepository.updateProfile.mockResolvedValue({});
  userRepository.updateLdapDisplayName.mockImplementation(async (id, displayName) => {
    const row = await userRepository.findByEmail.mock.results.at(-1).value;
    return { id, email: row.email, role: row.role, displayName };
  });
});

describe('login – neue LDAP-Benutzer (Integration)', () => {

  test('speichert das Profil aus der Kennung beim ersten Login', async () => {
    const result = await login({ email: 'if24b032', password: 'secret' });

    expect(authService.authenticateLDAP).toHaveBeenCalledWith('if24b032', 'secret');
    expect(userRepository.create).toHaveBeenCalledWith({
      displayName: LDAP_DISPLAY_NAME,
      email: 'if24b032@technikum-wien.at',
      passwordHash: expect.stringContaining(LDAP_HASH_MARKER),
      role: 'STUDENT',
      studentId: 'if24b032',
      studyProgram: 'Informatik',
      degree: 'Bachelor',
      studyStartYear: 2024,
    });
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
    expect(result.message).toBe('Login erfolgreich');
    expect(result.user.displayName).toBe(LDAP_DISPLAY_NAME);
  });

  test('unbekanntes Studiengangskürzel nutzt den Unknown-Fallback', async () => {
    await login({ email: 'xy99z999', password: 'secret' });

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'xy99z999',
        studyProgram: 'unbekannt',
        degree: 'unbekannt',
        studyStartYear: 2099,
      })
    );
  });

  test('unbekannter Abschlussbuchstabe nutzt den Unknown-Fallback', async () => {
    await login({ email: 'if24m032', password: 'secret' });

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'if24m032',
        studyProgram: 'Informatik',
        degree: 'unbekannt',
        studyStartYear: 2024,
      })
    );
  });

  test('Mitarbeiterkennung (ungültiges Format) legt Konto ohne Profilfelder an', async () => {
    await login({ email: 'muster', password: 'secret' });

    const arg = userRepository.create.mock.calls[0][0];
    expect(arg).toEqual({
      displayName: LDAP_DISPLAY_NAME,
      email: 'muster@technikum-wien.at',
      passwordHash: expect.stringContaining(LDAP_HASH_MARKER),
      role: 'EMPLOYEE',
    });
    expect(arg).not.toHaveProperty('studentId');
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
  });

  test('Rollenprüfung bleibt unverändert (STUDENT_ID_REGEX)', async () => {
    await login({ email: 'if24b032', password: 'secret' });
    expect(userRepository.create.mock.calls[0][0].role).toBe('STUDENT');

    await login({ email: 'keine-kennung', password: 'secret' });
    expect(userRepository.create.mock.calls[1][0].role).toBe('EMPLOYEE');
  });

});

describe('login – bestehende LDAP-Benutzer (Integration)', () => {

  test('führt das Profil nach jedem erfolgreichen LDAP-Login fort', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow());

    const result = await login({ email: 'if22b001', password: 'secret' });

    expect(userRepository.updateProfile).toHaveBeenCalledWith('u-ldap', {
      studentId: 'if22b001',
      studyProgram: 'Informatik',
      degree: 'Bachelor',
      studyStartYear: 2022,
    });
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updateLdapDisplayName).toHaveBeenCalledWith('u-ldap', LDAP_DISPLAY_NAME);
    expect(result.user.displayName).toBe(LDAP_DISPLAY_NAME);
  });

  test('bestehender Mitarbeiter-LDAP-User ohne Kennung bekommt kein Profil-Update', async () => {
    userRepository.findByEmail.mockResolvedValue(
      ldapRow({ id: 'u-mitarbeiter', email: 'muster@technikum-wien.at', display_name: 'muster', role: 'EMPLOYEE' })
    );

    const result = await login({ email: 'muster', password: 'secret' });

    expect(userRepository.updateProfile).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updateLdapDisplayName).toHaveBeenCalledWith('u-mitarbeiter', LDAP_DISPLAY_NAME);
    expect(result.user.role).toBe('EMPLOYEE');
    expect(result.user.displayName).toBe(LDAP_DISPLAY_NAME);
  });

  test('LDAP-Dummy-Hash markiert das Konto weiterhin als LDAP-Konto', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow());

    const result = await login({ email: 'if22b001', password: 'secret' });

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(result.user.id).toBe('u-ldap');
  });

});

describe('login – lokale Konten bleiben unverändert', () => {

  test('erfolgreicher lokaler Login ruft weder LDAP noch Profilfunktionen auf', async () => {
    userRepository.findByEmail.mockResolvedValue(localRow({ email: 'alice@example.com' }));
    authService.comparePassword.mockResolvedValue(true);

    await login({ email: 'alice@example.com', password: 'secret' });

    expect(authService.authenticateLDAP).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
    expect(userRepository.updateLdapDisplayName).not.toHaveBeenCalled();
  });

  test('lokales Konto mit Kennungs-E-Mail: LDAP-Fallback schreibt KEIN Profil', async () => {
    // Lokales Konto (echter bcrypt-Hash), dessen Login lokal fehlschlägt,
    // aber per LDAP erfolgreich wäre – das Profil darf trotzdem nicht angefasst werden.
    userRepository.findByEmail.mockResolvedValue(localRow());
    authService.comparePassword.mockResolvedValue(false);

    const result = await login({ email: 'if24b032@technikum-wien.at', password: 'secret' });

    expect(authService.authenticateLDAP).toHaveBeenCalledWith('if24b032', 'secret');
    expect(result.user.id).toBe('u-local');
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updateLdapDisplayName).not.toHaveBeenCalled();
    expect(result.user.displayName).toBe('Lokaler Account');
  });

  test('Registrierung (createUser) überlässt die Profilfelder leer', async () => {
    const { createUser } = require('../src/services/userService');
    authService.hashPassword.mockResolvedValue('bcrypt-hash');
    userRepository.create.mockResolvedValue({ id: 'u-reg', email: 'neu@example.com', role: 'STUDENT' });

    await createUser({ displayName: 'Neu', email: 'neu@example.com', password: 'langer-passwort' });

    expect(userRepository.create).toHaveBeenCalledWith({
      displayName: 'Neu',
      email: 'neu@example.com',
      passwordHash: 'bcrypt-hash',
      role: 'STUDENT',
    });
  });

});

describe('login – LDAP-Anzeigenamen und Fehlerbehandlung', () => {
  test('ein Name mit fehlgeschlagener Identitätsprüfung wird nicht übernommen', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow({ display_name: LDAP_DISPLAY_NAME }));
    authService.authenticateLDAP.mockResolvedValue({ authenticated: true, displayName: 'Unverifizierte Namens-Fixture', profileReadStatus: 'unverified_entry' });
    const result = await login({ email: 'if22b001', password: 'secret' });
    expect(result.user.displayName).toBe(LDAP_DISPLAY_NAME);
    expect(userRepository.updateLdapDisplayName).not.toHaveBeenCalled();
  });

  test('bestehende LDAP-Konten erhalten bei jedem Login den aktuellen Namen', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow());
    await login({ email: 'if22b001', password: 'secret' });
    authService.authenticateLDAP.mockResolvedValue({ authenticated: true, displayName: 'Aktualisierte Namens-Fixture', profileReadStatus: 'ok' });
    const result = await login({ email: 'if22b001', password: 'secret' });

    expect(userRepository.updateLdapDisplayName).toHaveBeenCalledTimes(2);
    expect(userRepository.updateLdapDisplayName).toHaveBeenLastCalledWith('u-ldap', 'Aktualisierte Namens-Fixture');
    expect(result.user).toMatchObject({ id: 'u-ldap', role: 'STUDENT', displayName: 'Aktualisierte Namens-Fixture' });
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  test.each(['missing_name_attributes', 'query_failed', 'timeout', 'unverified_entry', 'connection_error'])(
    'neues LDAP-Konto bleibt bei %s authentifiziert, ohne einen Namen zu erfinden', async profileReadStatus => {
      authService.authenticateLDAP.mockResolvedValue({ authenticated: true, displayName: null, profileReadStatus });
      const result = await login({ email: 'if24b032', password: 'secret' });
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({ displayName: '', studentId: 'if24b032' }));
      expect(result.user.displayName).toBe('');
      expect(result.message).toBe('Login erfolgreich');
      expect(authService.generateToken).toHaveBeenCalled();
    }
  );

  test.each(['missing_name_attributes', 'query_failed', 'timeout', 'unverified_entry', 'connection_error'])(
    'bestehendes LDAP-Konto behält bei %s seinen gespeicherten Namen', async profileReadStatus => {
      userRepository.findByEmail.mockResolvedValue(ldapRow({ display_name: LDAP_DISPLAY_NAME }));
      authService.authenticateLDAP.mockResolvedValue({ authenticated: true, displayName: null, profileReadStatus });
      const result = await login({ email: 'if22b001', password: 'secret' });
      expect(result.user.displayName).toBe(LDAP_DISPLAY_NAME);
      expect(userRepository.updateLdapDisplayName).not.toHaveBeenCalled();
      expect(userRepository.updateProfile).toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    }
  );

  test('ein fehlgeschlagener Bind liefert 401 und protokolliert keine LDAP-Details', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    authService.authenticateLDAP.mockRejectedValue(new Error('sensitive LDAP response'));
    try {
      await expect(login({ email: 'if24b032', password: 'secret' })).rejects.toMatchObject({ status: 401 });
      expect(errorLog).toHaveBeenCalledWith('[Auth] LDAP authentication failed');
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain('sensitive LDAP response');
      expect(authService.generateToken).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
  });

  test('Speicherfehler werden nicht als LDAP-Authentifizierungsfehler verschluckt', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow());
    const storageError = new Error('storage unavailable');
    userRepository.updateLdapDisplayName.mockRejectedValue(storageError);
    await expect(login({ email: 'if22b001', password: 'secret' })).rejects.toBe(storageError);
    expect(authService.generateToken).not.toHaveBeenCalled();
  });

  test('ein zwischenzeitlich verschwundenes Konto wird nicht neu angelegt', async () => {
    userRepository.findByEmail.mockResolvedValue(ldapRow());
    userRepository.updateLdapDisplayName.mockResolvedValue(null);
    await expect(login({ email: 'if22b001', password: 'secret' })).rejects.toMatchObject({ status: 404 });
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(authService.generateToken).not.toHaveBeenCalled();
  });
});

describe('login – JWT und Response-Struktur unverändert', () => {

  test('JWT-Payload enthält weiterhin nur id, email und role', async () => {
    await login({ email: 'if24b032', password: 'secret' });

    expect(authService.generateToken).toHaveBeenCalledWith({
      id: 'u-new',
      email: 'if24b032@technikum-wien.at',
      role: 'STUDENT',
    });
  });

  test('Response-Shape bleibt unverändert (keine Profilfelder im Login-Response)', async () => {
    const result = await login({ email: 'if24b032', password: 'secret' });

    expect(Object.keys(result).sort()).toEqual(['message', 'token', 'user']);
    expect(Object.keys(result.user).sort()).toEqual(['displayName', 'email', 'id', 'role']);
    expect(result.token).toBe('jwt-token');
  });

});
