/**
 * Kennungsparser für Studierendenkennungen der FH Technikum Wien.
 *
 * Format (bestätigt): <Studiengangskürzel><2-stelliges Jahr><Abschlussbuchstabe><3-stellige Nummer>
 * Beispiel: if24b032 → "if" | "24" | "b" | "032"
 *
 * Reine Funktion – keine Abhängigkeit von LDAP, Auth, JWT oder Datenbank.
 */

const STUDENT_ID_REGEX = /^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$/;

// Ausschließlich bestätigte Zuordnungen. Alles andere → "unbekannt".
const STUDY_PROGRAMS = {
  if: "Informatik",
};

const DEGREES = {
  b: "Bachelor",
};

const UNKNOWN = "unbekannt";

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

  return {
    valid: true,
    studentId,
    studyProgramCode,
    studyProgram: STUDY_PROGRAMS[studyProgramCode] || UNKNOWN,
    studyStartYear: 2000 + Number(yearPart),
    degreeCode,
    degree: DEGREES[degreeCode] || UNKNOWN,
    number,
  };
}

module.exports = { parseStudentId };
