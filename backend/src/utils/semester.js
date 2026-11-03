/**
 * Semesterberechnung für Sprint 3 (LDAP-Profiling).
 *
 * Reine Funktion – keine Abhängigkeit von LDAP, Auth, JWT oder Datenbank.
 * Das Studienbeginnjahr stammt aus dem Kennungsparser
 * (studentIdParser.parseStudentId(...).studyStartYear) und wird hier nicht
 * erneut abgeleitet.
 *
 * Annahmen:
 * - Studienbeginn im Wintersemester des angegebenen Jahres.
 * - Wintersemester: Oktober bis Februar (läuft über den Jahreswechsel).
 * - Sommersemester: März bis September.
 * - Keine Studienunterbrechungen.
 *
 * Rückgabe: Zahl (1 = erstes Semester) oder null bei ungültigem/zukünftigem
 * Studienbeginn oder ungültigem Datum.
 */
function calculateSemester(studyStartYear, date = new Date()) {
  if (!Number.isInteger(studyStartYear)) return null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Akademisches Jahr A:
  //   Wintersemester A  = Okt A – Feb A+1  → Offset 1
  //   Sommersemester A  = Mär A+1 – Sep A+1 → Offset 2
  let academicYear;
  let semesterOffset;

  if (month >= 10) {
    academicYear = year; // Okt–Dez: WS des aktuellen Jahres
    semesterOffset = 1;
  } else if (month <= 2) {
    academicYear = year - 1; // Jan–Feb: noch WS des Vorjahres
    semesterOffset = 1;
  } else {
    academicYear = year - 1; // Mär–Sep: SS zum Vorjahres-Akademischen-Jahr
    semesterOffset = 2;
  }

  const elapsed = academicYear - studyStartYear;
  if (elapsed < 0) return null; // Studienbeginn liegt (noch) in der Zukunft

  return 2 * elapsed + semesterOffset;
}

module.exports = { calculateSemester };
