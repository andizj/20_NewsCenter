const { calculateSemester } = require('../src/utils/semester');
const { parseStudentId } = require('../src/utils/studentIdParser');

const date = (year, month, day = 15) => new Date(year, month - 1, day);

describe('calculateSemester', () => {

  describe('Wintersemester (Oktober–Februar)', () => {
    test('Beispiel: Studienbeginn 2024, November 2026 → 5. Semester', () => {
      expect(calculateSemester(2024, date(2026, 11))).toBe(5);
    });

    test('Startjahr zählt als 1. Semester (Dezember 2024)', () => {
      expect(calculateSemester(2024, date(2024, 12))).toBe(1);
    });

    test('Oktober eröffnet ein neues Wintersemester', () => {
      expect(calculateSemester(2024, date(2025, 10))).toBe(3);
      expect(calculateSemester(2024, date(2026, 10))).toBe(5);
    });

    test('Januar und Februar gehören noch zum Vorjahres-WS', () => {
      expect(calculateSemester(2024, date(2025, 1))).toBe(1);
      expect(calculateSemester(2024, date(2026, 2))).toBe(3);
    });
  });

  describe('Sommersemester (März–September)', () => {
    test('erstes Sommersemester nach dem Start', () => {
      expect(calculateSemester(2024, date(2025, 5))).toBe(2);
    });

    test('März bis September des gleichen Jahres', () => {
      expect(calculateSemester(2024, date(2026, 3))).toBe(4);
      expect(calculateSemester(2024, date(2026, 9))).toBe(4);
    });
  });

  describe('Jahreswechsel', () => {
    test('Dezember bis Februar ergeben denselben Zählerstand', () => {
      expect(calculateSemester(2024, date(2025, 12))).toBe(3);
      expect(calculateSemester(2024, date(2026, 1))).toBe(3);
      expect(calculateSemester(2024, date(2026, 2))).toBe(3);
    });

    test('Umschlag von Februar auf März erhöht das Semester', () => {
      expect(calculateSemester(2024, date(2026, 2, 28))).toBe(3);
      expect(calculateSemester(2024, date(2026, 3, 1))).toBe(4);
    });
  });

  describe('ungültige und zukünftige Angaben', () => {
    test.each([
      ['null', null],
      ['undefined', undefined],
      ['String', '2024'],
      ['NaN', NaN],
      ['Gleitkommazahl', 2024.5],
    ])('liefert null bei %s als Studienbeginnjahr', (_label, input) => {
      expect(calculateSemester(input, date(2026, 11))).toBeNull();
    });

    test('liefert null bei ungültigem Datum', () => {
      expect(calculateSemester(2024, new Date('ungültig'))).toBeNull();
      expect(calculateSemester(2024, null)).toBeNull();
      expect(calculateSemester(2024, '2026-11-03')).toBeNull();
    });

    test('liefert null bei zukünftigem Studienbeginn', () => {
      expect(calculateSemester(2027, date(2026, 11))).toBeNull();
      // Beginn WS 2026 (Okt 2026): davor noch kein Semester
      expect(calculateSemester(2026, date(2026, 1))).toBeNull();
      expect(calculateSemester(2026, date(2026, 6))).toBeNull();
      // Ab dem tatsächlichen Beginn wieder gültig
      expect(calculateSemester(2026, date(2026, 11))).toBe(1);
    });

    test('Standarddatum (heute) wirft keinen Fehler', () => {
      expect(typeof calculateSemester(2000)).toBe('number');
    });
  });

  describe('Integration mit dem Kennungsparser', () => {
    test('berechnet das Semester aus parseStudentId(...).studyStartYear', () => {
      const parsed = parseStudentId('if24b032');
      expect(parsed.valid).toBe(true);
      expect(calculateSemester(parsed.studyStartYear, date(2026, 11))).toBe(5);
    });

    test('ungültige Kennung liefert kein Semester', () => {
      const parsed = parseStudentId('keine-kennung');
      expect(parsed.valid).toBe(false);
      expect(calculateSemester(parsed.studyStartYear, date(2026, 11))).toBeNull();
    });
  });

});
