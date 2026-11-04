jest.mock('../src/db', () => ({ pool: { query: jest.fn() } }));

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');
const { create, updateLdapDisplayName, updateProfile, findProfileById } = require('../src/repositories/userRepository');

const PROFILE_FIELDS = ['student_id', 'study_program', 'degree', 'study_start_year'];
const MIGRATION_PATH = path.join(__dirname, '..', '..', 'db', 'migrations', '001_user_profile_fields.sql');
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'init', '01_schema.sql');

const lastQuery = () => pool.query.mock.calls[pool.query.mock.calls.length - 1];

describe('userRepository – Profilfelder', () => {

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    test('schreibt Profilfelder, wenn sie übergeben werden', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'u1', displayName: 'if24b032' }] });

      const result = await create({
        displayName: 'if24b032',
        email: 'if24b032@technikum-wien.at',
        passwordHash: 'hash',
        role: 'STUDENT',
        studentId: 'if24b032',
        studyProgram: 'Informatik',
        degree: 'Bachelor',
        studyStartYear: 2024,
      });

      const [sql, params] = lastQuery();
      expect(sql).toMatch(/INSERT INTO users/);
      PROFILE_FIELDS.forEach((column) => expect(sql).toContain(column));
      expect(params).toEqual([
        'if24b032',
        'if24b032@technikum-wien.at',
        'hash',
        'STUDENT',
        'if24b032',
        'Informatik',
        'Bachelor',
        2024,
      ]);
      expect(result).toEqual({ id: 'u1', displayName: 'if24b032' });
    });

    test('bestehende Aufrufe ohne Profilangaben bleiben NULL (Rückwärtskompatibilität)', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'u2' }] });

      await create({
        displayName: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'hash',
        role: 'STUDENT',
      });

      const [sql, params] = lastQuery();
      expect(params).toEqual([
        'Alice',
        'alice@example.com',
        'hash',
        'STUDENT',
        null,
        null,
        null,
        null,
      ]);
      expect(sql).not.toMatch(/RETURNING[\s\S]*student_id/);
    });

    test('ändert die bestehenden RETURNING-Felder nicht', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'u3' }] });

      await create({ displayName: 'Bob', email: 'bob@example.com', passwordHash: 'h', role: 'EMPLOYEE' });

      const [sql] = lastQuery();
      expect(sql).toMatch(/RETURNING id,/);
      expect(sql).toContain('display_name AS "displayName"');
      expect(sql).toContain('created_at AS "createdAt"');
    });
  });

  describe('updateLdapDisplayName', () => {
    test('aktualisiert nur den Namen eines LDAP-Kontos und liefert die frische Benutzerzeile', async () => {
      const row = { id: 'u1', displayName: 'LDAP Namens-Fixture', email: 'ldap@example.test', role: 'STUDENT' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await updateLdapDisplayName('u1', ' LDAP Namens-Fixture ')).toEqual(row);
      const [sql, params] = lastQuery();
      expect(sql).toContain('SET display_name = $2');
      expect(sql).toContain("POSITION('INVALID_LOCAL_LOGIN' IN password_hash) > 0");
      expect(sql).toContain('display_name AS "displayName"');
      expect(params).toEqual(['u1', 'LDAP Namens-Fixture']);
      const assignments = sql.match(/\bSET\b([\s\S]*?)\bWHERE\b/)[1];
      ['id', 'email', 'role', 'password_hash', ...PROFILE_FIELDS].forEach(column => {
        expect(assignments).not.toMatch(new RegExp(`\\b${column}\\s*=`));
      });
    });

    test('liefert null für lokale oder nicht vorhandene Konten', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(updateLdapDisplayName('u-local', 'LDAP Namens-Fixture')).resolves.toBeNull();
    });

    test.each(['', ' ', null, undefined])('überschreibt keinen Namen mit einem fehlenden Wert %#', async displayName => {
      await expect(updateLdapDisplayName('u1', displayName)).rejects.toMatchObject({ status: 400 });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    test('speichert nur die Profilspalten und gibt die Zeile zurück', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'u1',
          studentId: 'if24b032',
          studyProgram: 'Informatik',
          degree: 'Bachelor',
          studyStartYear: 2024,
        }],
      });

      const result = await updateProfile('u1', {
        studentId: 'if24b032',
        studyProgram: 'Informatik',
        degree: 'Bachelor',
        studyStartYear: 2024,
      });

      const [sql, params] = lastQuery();
      expect(sql).toMatch(/UPDATE users/);
      expect(sql).toContain('student_id       = $2');
      expect(sql).toContain('WHERE id = $1::uuid');
      expect(params).toEqual(['u1', 'if24b032', 'Informatik', 'Bachelor', 2024]);
      expect(result).toMatchObject({ studentId: 'if24b032', studyStartYear: 2024 });
    });

    test('fasst bestehende Benutzerdaten nicht an', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await updateProfile('u1', { studentId: 'if24b032' });

      const [sql] = lastQuery();
      ['password_hash', 'role', 'email', 'display_name', 'created_at'].forEach((column) => {
        expect(sql).not.toMatch(new RegExp(`SET[\\s\\S]*${column}\\s*=`));
      });
      expect(sql).not.toMatch(/DELETE|DROP|TRUNCATE/i);
    });

    test('liefert null wenn die Nutzer-ID nicht existiert', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(updateProfile('00000000-0000-4000-8000-000000000000', { studentId: 'if24b032' }))
        .resolves.toBeNull();
    });

    test('setzt fehlende Profilangaben auf NULL', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'u1' }] });

      await updateProfile('u1', {});
      expect(lastQuery()[1]).toEqual(['u1', null, null, null, null]);
    });
  });

  describe('findProfileById', () => {
    test('liest ausschließlich die vier Profilfelder', async () => {
      const row = {
        studentId: 'if24b032',
        studyProgram: 'Informatik',
        degree: 'Bachelor',
        studyStartYear: 2024,
      };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await findProfileById('u1');

      const [sql, params] = lastQuery();
      expect(sql).toMatch(/SELECT/);
      sql.match(/AS "\w+"/g).forEach((alias) =>
        expect(['"studentId"', '"studyProgram"', '"studyStartYear"']).toContain(alias.replace('AS ', ''))
      );
      expect(sql).toContain('degree');
      expect(sql).toContain('FROM users');
      expect(sql).toContain('WHERE id = $1::uuid');
      expect(sql).not.toContain('password_hash');
      expect(params).toEqual(['u1']);
      expect(result).toEqual(row);
    });

    test('liefert null wenn der Nutzer nicht existiert', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(findProfileById('missing')).resolves.toBeNull();
    });

    test('berechnet nicht das aktuelle Semester (kein Speicher-/Berechnungsfeld)', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await findProfileById('u1');
      const [sql] = lastQuery();
      expect(sql).not.toMatch(/semester/i);
    });
  });

});

describe('Migration 001_user_profile_fields.sql', () => {
  const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  test('fügt alle vier Profilspalten idempotent hinzu', () => {
    PROFILE_FIELDS.forEach((column) => {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    });
  });

  test('enthält keine destruktiven Anweisungen', () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });

  test('Schema-Init für frische Datenbanken enthält dieselben Spalten', () => {
    PROFILE_FIELDS.forEach((column) => {
      expect(schema).toMatch(new RegExp(`^\\s*${column}\\s`, 'm'));
    });
  });

  test('Spalten sind NULL-fähig, damit Bestandsdaten erhalten bleiben', () => {
    PROFILE_FIELDS.forEach((column) => {
      const line = migration.split('\n').find((l) => l.includes(`ADD COLUMN IF NOT EXISTS ${column}`));
      expect(line).toBeDefined();
      expect(line).not.toMatch(/NOT NULL/);
    });
  });
});
