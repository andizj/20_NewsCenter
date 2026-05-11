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
 * @param {{ displayName: string, email: string, passwordHash: string, role: string }} param0
 */
async function create({ displayName, email, passwordHash, role }) {
  const result = await pool.query(
    `INSERT INTO users (display_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               display_name AS "displayName",
               email,
               role,
               created_at AS "createdAt"`,
    [displayName, email, passwordHash, role]
  );
  return result.rows[0];
}

/**
 * Returns all tags a user has subscribed to.
 * @param {string} userId
 */
async function findSubscriptions(userId) {
  const result = await pool.query(
    `SELECT t.id,
            t.name,
            t.description,
            t.created_at AS "createdAt"
     FROM subscriptions s
     JOIN tags t ON t.id = s.tag_id
     WHERE s.user_id = $1::uuid
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
  findSubscriptions,
  addSubscription,
  removeSubscription,
};
