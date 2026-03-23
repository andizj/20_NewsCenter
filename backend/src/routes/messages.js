const express = require("express");
const { pool } = require("../db");
const auth = require("../middleware/auth");
const axios = require("axios");

module.exports = (broadcaster) => {
  const router = express.Router();

  // 1. POST / - Nachricht erstellen
  router.post("/", auth, async (req, res) => {
    try {
      const authorId = req.user.id; 
      const { title, body, targetRole } = req.body;

      if (!authorId) return res.status(401).json({ error: "Unauthorized" });
      if (!title || !body) return res.status(400).json({ error: "Bitte Titel und Text angeben." });

      const allowedRoles = ["ALL", "STUDENT", "EMPLOYEE"];
      const finalTargetRole = allowedRoles.includes(targetRole) ? targetRole : "ALL";

      const result = await pool.query(
        `INSERT INTO messages (author_id, target_role, title, body)
         VALUES ($1::uuid, $2, $3, $4)
         RETURNING id, author_id AS "authorId", target_role AS "targetRole", title, body, created_at AS "createdAt"`,
        [authorId, finalTargetRole, title, body]
      );

      const newMessage = result.rows[0];
      if (typeof broadcaster === "function") broadcaster(newMessage);

      return res.status(201).json(newMessage);
    } catch (err) {
      console.error("Error creating message:", err);
      return res.status(500).json({ error: "Failed to create message" });
    }
  });

  // 2. POST /:id/tags - Tags hinzufügen
  router.post("/:id/tags", auth, async (req, res) => {
    const { id } = req.params;
    const { tagId } = req.body;

    if (!tagId) return res.status(400).json({ error: "tagId is required" });

    try {
      const result = await pool.query(
        `INSERT INTO message_tags (message_id, tag_id)
         VALUES ($1::uuid, $2::uuid)
         RETURNING message_id AS "messageId", tag_id AS "tagId"`,
        [id, tagId]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: "Message already has this tag" });
      console.error("Error tagging message:", err);
      return res.status(500).json({ error: "Failed to tag message" });
    }
  });

  // 3. GET / - Feed abrufen (Mit ARRAY_AGG für Tags)
  router.get("/", auth, async (req, res) => {
    const { tag } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
      let query;
      let params = [];

      if (tag) {
        query = `
          SELECT m.id, m.author_id AS "authorId", u.display_name AS "authorName",
                 m.target_role AS "targetRole", m.title, m.body, m.created_at AS "createdAt",
                 COALESCE(array_agg(t2.name) FILTER (WHERE t2.name IS NOT NULL), '{}') AS tags
          FROM messages m
          LEFT JOIN users u ON m.author_id = u.id
          JOIN message_tags mt_filter ON m.id = mt_filter.message_id
          JOIN tags t_filter ON mt_filter.tag_id = t_filter.id
          LEFT JOIN message_tags mt2 ON m.id = mt2.message_id
          LEFT JOIN tags t2 ON mt2.tag_id = t2.id
          WHERE LOWER(t_filter.name) = LOWER($1) AND (m.target_role = $2 OR m.target_role = 'ALL')
          GROUP BY m.id, u.display_name
          ORDER BY m.created_at DESC
        `;
        params = [tag, userRole];
      } else {
        const subResult = await pool.query(`SELECT tag_id FROM subscriptions WHERE user_id = $1::uuid`, [userId]);

        if (subResult.rows.length > 0) {
          query = `
            SELECT m.id, m.author_id AS "authorId", u.display_name AS "authorName",
                   m.target_role AS "targetRole", m.title, m.body, m.created_at AS "createdAt",
                   COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
            FROM messages m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN message_tags mt ON m.id = mt.message_id
            LEFT JOIN tags t ON mt.tag_id = t.id
            WHERE (m.target_role = $2 OR m.target_role = 'ALL')
              AND (m.id IN (SELECT message_id FROM message_tags WHERE tag_id IN (SELECT tag_id FROM subscriptions WHERE user_id = $1::uuid)) OR m.id NOT IN (SELECT message_id FROM message_tags))
            GROUP BY m.id, u.display_name
            ORDER BY m.created_at DESC
          `;
          params = [userId, userRole];
        } else {
          query = `
            SELECT m.id, m.author_id AS "authorId", u.display_name AS "authorName",
                   m.target_role AS "targetRole", m.title, m.body, m.created_at AS "createdAt",
                   COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
            FROM messages m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN message_tags mt ON m.id = mt.message_id
            LEFT JOIN tags t ON mt.tag_id = t.id
            WHERE m.target_role = $1 OR m.target_role = 'ALL'
            GROUP BY m.id, u.display_name
            ORDER BY m.created_at DESC
          `;
          params = [userRole];
        }
      }

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // 4. GET /search - Intelligente Thesaurus-Suche
  router.get("/search", auth, async (req, res) => {
    const rawQuery = (req.query.q || "").trim().toLowerCase();
    const userRole = req.user.role;

    if (!rawQuery) return res.status(400).json({ error: "Search query is required" });

    try {
      let terms = [rawQuery];

      try {
        const response = await axios.get(`https://www.openthesaurus.de/synonyme/search?q=${rawQuery}&format=application/json`);
        const data = response.data;
        if (data.synsets && data.synsets.length > 0) {
          data.synsets.forEach(synset => synset.terms.forEach(t => terms.push(t.term.toLowerCase())));
        }
      } catch (apiErr) {
        console.error("Thesaurus API nicht erreichbar:", apiErr.message);
      }

      terms = [...new Set(terms)];
      const likeTerms = terms.map(term => `%${term}%`);

      const result = await pool.query(
        `SELECT m.id, m.author_id AS "authorId", u.display_name AS "authorName",
                m.target_role AS "targetRole", m.title, m.body, m.created_at AS "createdAt",
                COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
         FROM messages m
         LEFT JOIN users u ON m.author_id = u.id
         LEFT JOIN message_tags mt ON m.id = mt.message_id
         LEFT JOIN tags t ON mt.tag_id = t.id
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

      return res.json(result.rows);
    } catch (err) {
      console.error("Error searching messages:", err);
      return res.status(500).json({ error: "Failed to search messages" });
    }
  });

  // 5. GET /:id - Einzelne Nachricht
  router.get("/:id", auth, async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;

    try {
      const result = await pool.query(
        `SELECT m.id, m.author_id AS "authorId", u.display_name AS "authorName",
                m.target_role AS "targetRole", m.title, m.body, m.created_at AS "createdAt",
                COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
         FROM messages m
         LEFT JOIN users u ON m.author_id = u.id
         LEFT JOIN message_tags mt ON m.id = mt.message_id
         LEFT JOIN tags t ON mt.tag_id = t.id
         WHERE m.id = $1::uuid AND (m.target_role = $2 OR m.target_role = 'ALL')
         GROUP BY m.id, u.display_name`,
        [id, userRole]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: "Message not found" });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Error fetching message:", err);
      return res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  return router;
};