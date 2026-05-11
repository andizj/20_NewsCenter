const { pool } = require("../db");

/**
 * Returns all tags, newest first.
 */
async function findAll() {
  const result = await pool.query(
    `SELECT id, name, description, created_at AS "createdAt"
     FROM tags
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Finds a single tag by UUID. Returns null if not found.
 * @param {string} id
 */
async function findById(id) {
  const result = await pool.query(
    `SELECT id, name, description, created_at AS "createdAt"
     FROM tags
     WHERE id = $1::uuid`,
    [id]
  );
  return result.rows[0] || null;
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

module.exports = { findAll, findById, create };
