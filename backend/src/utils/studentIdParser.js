/**
 * Kennungsparser für Studierendenkennungen der FH Technikum Wien.
 *
 * Format (bestätigt): <Studiengangskürzel><2-stelliges Jahr><Abschlussbuchstabe><3-stellige Nummer>
 * Beispiel: if24b032 → "if" | "24" | "b" | "032"
 *
 * Reine Funktion – keine Abhängigkeit von LDAP, Auth, JWT oder Datenbank.
 */

const { studyPrograms: STUDY_PROGRAMS, degrees: DEGREES } = require("../config/studyPrograms.json");

const STUDENT_ID_REGEX = /^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$/;

// Zuordnungen stammen aus config/studyPrograms.json (Studiengangsliste der FH).
// Schlüssel ist der FH-Code aus Abschlussbuchstabe + Studiengangskürzel,
// z.B. if24b032 → "BIF". Das Kürzel allein ist nicht eindeutig
// (BSE = Sports Engineering & Ergonomics, MSE = Software Engineering).
// Alles, was nicht in der Datei steht → "unbekannt".
const UNKNOWN = "unbekannt";

/** Eigene Einträge nachschlagen (kein Treffer über Object.prototype, z.B. "constructor"). */
function lookup(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : UNKNOWN;
}

/**
 * Werte ein Studierendenkennung aus und leitet Profilinformationen ab.
 *
 * @param {string} rawId - z.B. "if24b032" (Groß-/Klein egal, Leerzeichen erlaubt)
 * @returns {{ valid: false, studentId: string|null }
 *         | { valid: true, studentId: string, studyProgramCode: string,
 *             studyProgram: string, studyStartYear: number,
 *             degreeCode: string, degree: string, number: string }}
 */
function parseStudentId(rawId) {
  const trimmed = typeof rawId === "string" ? rawId.trim().toLowerCase() : null;
  const studentId = trimmed || null;

  if (!studentId || !STUDENT_ID_REGEX.test(studentId)) {
    return { valid: false, studentId };
  }

  const studyProgramCode = studentId.slice(0, 2);
  const yearPart = studentId.slice(2, 4);
  const degreeCode = studentId.slice(4, 5);
  const number = studentId.slice(5, 8);
  const programKey = `${degreeCode}${studyProgramCode}`.toUpperCase();

  return {
    valid: true,
    studentId,
    studyProgramCode,
    studyProgram: lookup(STUDY_PROGRAMS, programKey),
    studyStartYear: 2000 + Number(yearPart),
    degreeCode,
    degree: lookup(DEGREES, degreeCode.toUpperCase()),
    number,
  };
}

module.exports = { parseStudentId };
