const { pool } = require("../db");

// Reusable SELECT columns for messages with author name and aggregated tags
const MESSAGE_COLUMNS = `
  m.id,
  m.author_id    AS "authorId",
  u.display_name AS "authorName",
  m.target_role  AS "targetRole",
  m.title,
  m.body,
  m.created_at   AS "createdAt",
  COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
`;

const MESSAGE_JOINS = `
  LEFT JOIN users u         ON m.author_id = u.id
  LEFT JOIN message_tags mt ON m.id        = mt.message_id
  LEFT JOIN tags t          ON mt.tag_id   = t.id
`;

/**
 * Inserts a new message and returns the created record.
 * @param {{ authorId: string, targetRole: string, title: string, body: string }} param0
 */
async function create({ authorId, targetRole, title, body }) {
  const result = await pool.query(
    `INSERT INTO messages (author_id, target_role, title, body)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING id,
               author_id   AS "authorId",
               target_role AS "targetRole",
               title,
               body,
               created_at  AS "createdAt"`,
    [authorId, targetRole, title, body]
  );
  return result.rows[0];
}

/**
 * Links a tag to a message. Returns the join row.
 * @param {string} messageId
 * @param {string} tagId
 */
async function addTag(messageId, tagId) {
  const result = await pool.query(
    `INSERT INTO message_tags (message_id, tag_id)
     VALUES ($1::uuid, $2::uuid)
     RETURNING message_id AS "messageId", tag_id AS "tagId"`,
    [messageId, tagId]
  );
  return result.rows[0];
}

/**
 * Returns messages filtered by tag, subscriptions, or role.
 * - If `tag` is given: filter by that tag name.
 * - Else if user has subscriptions: show subscribed-tag messages + untagged messages.
 * - Else: show all messages the user's role can see.
 *
 * @param {{ userRole: string, userId: string, tag?: string }} param0
 */
async function findFiltered({ userRole, userId, tag }) {
  if (tag) {
    const result = await pool.query(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages m
       LEFT JOIN users u ON m.author_id = u.id
       JOIN message_tags mt_filter ON m.id = mt_filter.message_id
       JOIN tags t_filter           ON mt_filter.tag_id = t_filter.id
       LEFT JOIN message_tags mt2  ON m.id = mt2.message_id
       LEFT JOIN tags t            ON mt2.tag_id = t.id
       WHERE LOWER(t_filter.name) = LOWER($1)
         AND (m.target_role = $2 OR m.target_role = 'ALL')
       GROUP BY m.id, u.display_name
       ORDER BY m.created_at DESC`,
      [tag, userRole]
    );
    return result.rows;
  }

  const subResult = await pool.query(
    `SELECT tag_id FROM subscriptions WHERE user_id = $1::uuid`,
    [userId]
  );

  if (subResult.rows.length > 0) {
    const result = await pool.query(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages m
       ${MESSAGE_JOINS}
       WHERE (m.target_role = $2 OR m.target_role = 'ALL')
         AND (
           m.id IN (
             SELECT message_id FROM message_tags
             WHERE tag_id IN (SELECT tag_id FROM subscriptions WHERE user_id = $1::uuid)
           )
           OR m.id NOT IN (SELECT message_id FROM message_tags)
         )
       GROUP BY m.id, u.display_name
       ORDER BY m.created_at DESC`,
      [userId, userRole]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages m
     ${MESSAGE_JOINS}
     WHERE m.target_role = $1 OR m.target_role = 'ALL'
     GROUP BY m.id, u.display_name
     ORDER BY m.created_at DESC`,
    [userRole]
  );
  return result.rows;
}

/**
 * Full-text search across title, body, and tag names using a list of terms.
 * @param {{ terms: string[], userRole: string }} param0
 */
async function search({ terms, userRole }) {
  const likeTerms = terms.map((term) => `%${term}%`);
  const result = await pool.query(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages m
     ${MESSAGE_JOINS}
     WHERE (m.target_role = $1 OR m.target_role = 'ALL')
       AND (
         LOWER(m.title) LIKE ANY($2::text[])
         OR LOWER(m.body) LIKE ANY($2::text[])
         OR LOWER(COALESCE(t.name, '')) LIKE ANY($2::text[])
       )
     GROUP BY m.id, u.display_name
     ORDER BY m.created_at DESC`,
    [userRole, likeTerms]
  );
  return result.rows;
}

/**
 * Returns a single message by ID, respecting the user's role.
 * @param {string} id
 * @param {string} userRole
 */
async function findById(id, userRole) {
  const result = await pool.query(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages m
     ${MESSAGE_JOINS}
     WHERE m.id = $1::uuid
       AND (m.target_role = $2 OR m.target_role = 'ALL')
     GROUP BY m.id, u.display_name`,
    [id, userRole]
  );
  return result.rows[0] || null;
}

/**
 * Returns a single message by ID with NO role filter.
 * Used exclusively for SSE broadcasting after tag assignment.
 * @param {string} id
 */
async function findByIdAdmin(id) {
  const result = await pool.query(
    `SELECT ${MESSAGE_COLUMNS}
     FROM messages m
     ${MESSAGE_JOINS}
     WHERE m.id = $1::uuid
     GROUP BY m.id, u.display_name`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { create, addTag, findFiltered, search, findById, findByIdAdmin };
