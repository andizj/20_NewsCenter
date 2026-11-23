/**
 * Kennungsparser für Studierendenkennungen der FH Technikum Wien.
 *
 * Format: <Studiengangskürzel><2-stelliges Jahr><Abschlussbuchstabe><3-stellige Nummer>
 * Beispiel: if24b032 → "if" | "24" | "b" | "032"
 *
 */

const { studyPrograms: STUDY_PROGRAMS, degrees: DEGREES } = require("../config/studyPrograms.json");

const STUDENT_ID_REGEX = /^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$/;

const UNKNOWN = "unbekannt";

/** Eigene Einträge nachschlagen (kein Treffer über Object.prototype, z.B. "constructor"). */
function lookup(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : UNKNOWN;
}


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
