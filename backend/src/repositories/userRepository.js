const { pool } = require("../db");

/**
 * Finds a user by email. Returns the raw DB row (including password_hash) for auth purposes.
 * @param {string} email
 */
async function findByEmail(email) {
  const result = await pool.query(
    `SELECT id, email, display_name, role, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Finds a user by UUID. Returns public fields only (no password_hash).
 * @param {string} id
 */
async function findById(id) {
  const result = await pool.query(
    `SELECT id,
            display_name AS "displayName",
            email,
            role,
            created_at AS "createdAt"
     FROM users
     WHERE id = $1::uuid`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Returns all users (public fields, ordered newest first).
 */
async function findAll() {
  const result = await pool.query(
    `SELECT id,
            display_name AS "displayName",
            email,
            created_at AS "createdAt"
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Inserts a new user and returns the created record.
 * Profile fields are optional and default to NULL (local accounts, employees,
 * or callers that do not parse a Kennung yet) – existing callers stay unchanged.
 * @param {{ displayName: string, email: string, passwordHash: string, role: string,
 *           studentId?: string|null, studyProgram?: string|null,
 *           degree?: string|null, studyStartYear?: number|null }} param0
 */
async function create({
  displayName,
  email,
  passwordHash,
  role,
  studentId = null,
  studyProgram = null,
  degree = null,
  studyStartYear = null,
}) {
  const result = await pool.query(
    `INSERT INTO users (display_name, email, password_hash, role,
                        student_id, study_program, degree, study_start_year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id,
               display_name AS "displayName",
               email,
               role,
               created_at AS "createdAt"`,
    [displayName, email, passwordHash, role, studentId, studyProgram, degree, studyStartYear]
  );
  return result.rows[0];
}

/** Update a verified LDAP name, preserving account identity and all study fields.
 * The existing LDAP marker also protects local accounts at the SQL boundary.
 */
async function updateLdapDisplayName(userId, displayName) {
  if (typeof displayName !== "string" || !displayName.trim()) {
    throw { status: 400, message: "A verified display name is required" };
  }
  const result = await pool.query(
    `UPDATE users
        SET display_name = $2
      WHERE id = $1::uuid
        AND POSITION('INVALID_LOCAL_LOGIN' IN password_hash) > 0
      RETURNING id, display_name AS "displayName", email, role,
                created_at AS "createdAt"`,
    [userId, displayName.trim()]
  );
  return result.rows[0] || null;
}

/**
 * Stores the derived profile of a user (LDAP profiling) as a whole.
 * Only the profile columns are written – email, display_name, password_hash,
 * role and created_at stay untouched. The current semester is NOT stored
 * (it is computed dynamically).
 * @param {string} userId - UUID
 * @param {{ studentId?: string|null, studyProgram?: string|null,
 *           degree?: string|null, studyStartYear?: number|null }} profile
 * @returns {Promise<object|null>} the stored profile row, null if user not found
 */
async function updateProfile(
  userId,
  { studentId = null, studyProgram = null, degree = null, studyStartYear = null }
) {
  const result = await pool.query(
    `UPDATE users
        SET student_id       = $2,
            study_program    = $3,
            degree           = $4,
            study_start_year = $5
      WHERE id = $1::uuid
      RETURNING id,
                student_id       AS "studentId",
                study_program    AS "studyProgram",
                degree,
                study_start_year AS "studyStartYear"`,
    [userId, studentId, studyProgram, degree, studyStartYear]
  );
  return result.rows[0] || null;
}

/**
 * Reads only the profile fields of a user.
 * Existing read functions (findById/findAll/findByEmail) stay unchanged.
 * @param {string} id - UUID
 * @returns {Promise<object|null>} profile row or null if user not found
 */
async function findProfileById(id) {
  const result = await pool.query(
    `SELECT student_id       AS "studentId",
            study_program    AS "studyProgram",
            degree,
            study_start_year AS "studyStartYear"
     FROM users
     WHERE id = $1::uuid`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Returns all tags a user has subscribed to, including the current
 * subscriber count of every tag (calculated from the subscriptions table).
 * @param {string} userId
 */
async function findSubscriptions(userId) {
  const result = await pool.query(
    `SELECT t.id,
            t.name,
            t.description,
            t.created_at AS "createdAt",
            COUNT(all_subs.user_id)::int AS "subscriberCount"
     FROM subscriptions s
     JOIN tags t ON t.id = s.tag_id
     LEFT JOIN subscriptions all_subs ON all_subs.tag_id = t.id
     WHERE s.user_id = $1::uuid
     GROUP BY t.id
     ORDER BY t.name ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Subscribes a user to a tag. Returns the new row, or null if it already existed.
 * @param {string} userId
 * @param {string} tagId
 */
async function addSubscription(userId, tagId) {
  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, tag_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (user_id, tag_id) DO NOTHING
     RETURNING user_id AS "userId", tag_id AS "tagId"`,
    [userId, tagId]
  );
  return result.rows[0] || null; // null means subscription already existed
}

/**
 * Removes a subscription. Returns the number of deleted rows.
 * @param {string} userId
 * @param {string} tagId
 */
async function removeSubscription(userId, tagId) {
  const result = await pool.query(
    `DELETE FROM subscriptions
     WHERE user_id = $1::uuid AND tag_id = $2::uuid`,
    [userId, tagId]
  );
  return result.rowCount;
}

module.exports = {
  findByEmail,
  findById,
  findAll,
  create,
  updateLdapDisplayName,
  updateProfile,
  findProfileById,
  findSubscriptions,
  addSubscription,
  removeSubscription,
};
