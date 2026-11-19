const { parseStudentId } = require('../src/utils/studentIdParser');

describe('studentIdParser', () => {

  describe('gültige Kennungen', () => {
    test('parst die bestätigte Kennung if24b032 vollständig', () => {
      const result = parseStudentId('if24b032');

      expect(result).toEqual({
        valid: true,
        studentId: 'if24b032',
        studyProgramCode: 'if',
        studyProgram: 'Informatik/Computer Science',
        studyStartYear: 2024,
        degreeCode: 'b',
        degree: 'Bachelor',
        number: '032',
      });
    });

    test('akzeptiert Großschreibung und Leerzeichen', () => {
      expect(parseStudentId('IF24B032')).toMatchObject({
        valid: true,
        studentId: 'if24b032',
        studyProgram: 'Informatik/Computer Science',
        degree: 'Bachelor',
      });

      expect(parseStudentId('  if24b032  ')).toMatchObject({
        valid: true,
        studentId: 'if24b032',
      });
    });

    test('bildet das zweistellige Jahr auf 20xx ab', () => {
      expect(parseStudentId('if22b001').studyStartYear).toBe(2022);
      expect(parseStudentId('if99b001').studyStartYear).toBe(2099);
    });

    test('liefert bei unbekanntem Kürzel valid=true und studyProgram=unbekannt', () => {
      const result = parseStudentId('xy99z999');

      expect(result.valid).toBe(true);
      expect(result.studyProgramCode).toBe('xy');
      expect(result.studyProgram).toBe('unbekannt');
      expect(result.studyStartYear).toBe(2099);
      expect(result.number).toBe('999');
    });

    test('liefert bei unbekanntem Abschlussbuchstaben degree=unbekannt', () => {
      const result = parseStudentId('if24x032');

      expect(result.valid).toBe(true);
      expect(result.degreeCode).toBe('x');
      expect(result.degree).toBe('unbekannt');
      expect(result.studyProgram).toBe('unbekannt');
    });

    test.each([
      ['wi24b001', 'Wirtschaftsinformatik', 'Bachelor'],
      ['wi24m001', 'Wirtschaftsinformatik', 'Master'],
      ['cs23m010', 'IT-Security', 'Master'],
      ['el25b100', 'Elektronik', 'Bachelor'],
    ])('erkennt %s als %s (%s)', (id, program, degree) => {
      expect(parseStudentId(id)).toMatchObject({ studyProgram: program, degree });
    });

    test('unterscheidet gleiche Kürzel nach Abschluss (BSE vs. MSE)', () => {
      expect(parseStudentId('se24b001').studyProgram).toBe('Sports Engineering & Ergonomics');
      expect(parseStudentId('se24m001').studyProgram).toBe('Software Engineering');
    });

    test('liefert unbekannt für Kombinationen, die es nicht gibt', () => {
      // "if" existiert nur als Bachelor (BIF), nicht als Master
      expect(parseStudentId('if24m032')).toMatchObject({ studyProgram: 'unbekannt', degree: 'Master' });
    });

    test('liefert für Lehrgänge den Namen, aber keinen Abschluss', () => {
      expect(parseStudentId('pw24l001')).toMatchObject({ studyProgram: 'Web-Development', degree: 'unbekannt' });
    });

    test('fällt nicht auf Object.prototype-Schlüssel herein', () => {
      expect(parseStudentId('to24b001').studyProgram).toBe('unbekannt');
    });
  });

  describe('ungültige Kennungen', () => {
    test.each([
      ['zu kurz', 'if24b03'],
      ['zu lang', 'if24b0032'],
      ['Jahreszahl fehlt', 'if241234'],
      ['leere Zeichenkette', ''],
      ['nur Leerzeichen', '   '],
    ])('liefert valid=false bei %s', (_label, input) => {
      const result = parseStudentId(input);

      expect(result.valid).toBe(false);
      expect(result.studentId).toBe(input.trim() || null);
    });

    test.each([
      ['null', null],
      ['undefined', undefined],
      ['Zahl', 12345678],
      ['Objekt', {}],
    ])('liefert valid=false bei %s', (_label, input) => {
      expect(parseStudentId(input)).toEqual({ valid: false, studentId: null });
    });
  });

});
