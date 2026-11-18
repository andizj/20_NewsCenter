const { pool } = require("../db");

// Shared projection: every tag carries its current number of subscribers
// (calculated from the subscriptions table).
const TAG_WITH_COUNT_SQL = `SELECT t.id,
            t.name,
            t.description,
            t.created_at AS "createdAt",
            COUNT(s.user_id)::int AS "subscriberCount"
     FROM tags t
     LEFT JOIN subscriptions s ON s.tag_id = t.id
     GROUP BY t.id`;

/**
 * Returns all tags including their subscriber count, newest first.
 */
async function findAll() {
  const result = await pool.query(
    `${TAG_WITH_COUNT_SQL}
     ORDER BY t.created_at DESC`
  );
  return result.rows;
}

/**
 * Finds a single tag by UUID (including its subscriber count).
 * Returns null if not found.
 * @param {string} id
 */
async function findById(id) {
  const result = await pool.query(
    `SELECT t.id,
            t.name,
            t.description,
            t.created_at AS "createdAt",
            COUNT(s.user_id)::int AS "subscriberCount"
     FROM tags t
     LEFT JOIN subscriptions s ON s.tag_id = t.id
     WHERE t.id = $1::uuid
     GROUP BY t.id`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Returns all tags ordered by name including the number of subscribers
 * (subscriptions rows). Used by the publish agent to suggest existing
 * tags with their reach.
 */
async function findAllWithSubscriberCount() {
  const result = await pool.query(
    `${TAG_WITH_COUNT_SQL}
     ORDER BY t.name ASC`
  );
  return result.rows;
}

/**
 * Inserts a new tag and returns the created record.
 * @param {{ name: string, description?: string }} param0
 */
async function create({ name, description }) {
  const result = await pool.query(
    `INSERT INTO tags (name, description)
     VALUES ($1, $2)
     RETURNING id, name, description, created_at AS "createdAt"`,
    [name, description || null]
  );
  return result.rows[0];
}

module.exports = { findAll, findById, findAllWithSubscriberCount, create };
