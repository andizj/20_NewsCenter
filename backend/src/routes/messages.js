const express = require("express");
const { pool } = require("../db");
const auth = require("../middleware/auth");

module.exports = (broadcaster) => {
  const router = express.Router();

  // ---------------------------------------------------------
  // 1. POST / - Nachricht erstellen (Nur eingeloggte User)
  // ---------------------------------------------------------
  router.post("/", auth, async (req, res) => {
    try {
      // WICHTIG: Die ID kommt jetzt sicher aus dem Token (req.user)
      // Das 'auth' Middleware hat den Token geprüft und den User hier angehängt.
      const authorId = req.user.id; 
      const { title, body,targetRole } = req.body;

      // Validierung
      if (!authorId) {
        return res.status(401).json({ error: "Unauthorized: User ID missing in token" });
      }
      if (!title || !body) {
        return res.status(400).json({ error: "Bitte Titel und Text angeben." });
      }

      const allowedRoles = ["ALL", "STUDENT", "EMPLOYEE"];

      if (targetRole && !allowedRoles.includes(targetRole)) {
        return res.status(400).json({ error: "Ungültige Zielgruppe." });
      }

      const finalTargetRole = targetRole || "ALL";

      // Datenbank Insert
      // Wir speichern author_id, target_role, title und body
      const result = await pool.query(
        `INSERT INTO messages (author_id, target_role, title, body)
         VALUES ($1::uuid, $2, $3,$4)
         RETURNING id, author_id AS "authorId",target_role AS "targetRole", title, body, created_at AS "createdAt"`,
        [authorId,finalTargetRole, title, body]
      );

      const newMessage = result.rows[0];

      // Real-Time Update senden (falls Broadcaster existiert)
      if (typeof broadcaster === "function") {
        broadcaster(newMessage);
      }

      return res.status(201).json(newMessage);

    } catch (err) {
      console.error("Error creating message:", err);
      return res.status(500).json({
        error: "Failed to create message",
        details: err.message
      });
    }
  });

  // ---------------------------------------------------------
  // 2. POST /:id/tags - Tags hinzufügen (Nur eingeloggte User)
  // ---------------------------------------------------------
  router.post("/:id/tags", auth, async (req, res) => {
    const { id } = req.params;   // Message ID
    const { tagId } = req.body;  // Tag ID aus dem Body

    if (!tagId) {
      return res.status(400).json({ error: "tagId is required" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO message_tags (message_id, tag_id)
         VALUES ($1::uuid, $2::uuid)
         RETURNING message_id AS "messageId", tag_id AS "tagId"`,
        [id, tagId]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      // Unique Constraint Verletzung abfangen (Tag schon vorhanden)
      if (err.code === '23505') { 
         return res.status(409).json({ error: "Message already has this tag" });
      }
      console.error("Error tagging message:", err);
      return res.status(500).json({ error: "Failed to tag message" });
    }
  });

  // ---------------------------------------------------------
  // 3. GET / - Alle Nachrichten lesen (Öffentlich oder Auth?)
  // ---------------------------------------------------------
  // Aktuell öffentlich. Falls nur für User, füge 'auth' hinzu.
  // GET / - Nachrichten lesen (Optional mit ?tag=Name Filter)
  router.get("/", auth, async (req, res) => {
    const { tag } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
      let query;
      let params = [];

      if (tag) {
        // Manueller Themenfilter aus der UI bleibt erhalten
        query = `
        SELECT DISTINCT m.id,
               m.author_id AS "authorId",
               u.display_name AS "authorName",
               m.target_role AS "targetRole",
               m.title,
               m.body,
               m.created_at AS "createdAt"
        FROM messages m
        LEFT JOIN users u ON m.author_id = u.id
        JOIN message_tags mt ON m.id = mt.message_id
        JOIN tags t ON mt.tag_id = t.id
        WHERE t.name = $1
          AND (m.target_role = $2 OR m.target_role = 'ALL')
        ORDER BY m.created_at DESC
      `;
        params = [tag, userRole];
      } else {
        // Prüfen, ob der User Subscriptions hat
        const subResult = await pool.query(
            `SELECT tag_id
         FROM subscriptions
         WHERE user_id = $1::uuid`,
            [userId]
        );

        if (subResult.rows.length > 0) {
          // Personalisierter Feed: Rolle + abonnierte Tags
          query = `
          SELECT DISTINCT m.id,
                 m.author_id AS "authorId",
                 u.display_name AS "authorName",
                 m.target_role AS "targetRole",
                 m.title,
                 m.body,
                 m.created_at AS "createdAt"
          FROM messages m
          LEFT JOIN users u ON m.author_id = u.id
          JOIN message_tags mt ON m.id = mt.message_id
          JOIN subscriptions s ON mt.tag_id = s.tag_id
          WHERE s.user_id = $1::uuid
            AND (m.target_role = $2 OR m.target_role = 'ALL')
          ORDER BY m.created_at DESC
        `;
          params = [userId, userRole];
        } else {
          // Fallback: normaler Rollen-Feed, wenn keine Abos vorhanden sind
          query = `
          SELECT m.id,
                 m.author_id AS "authorId",
                 u.display_name AS "authorName",
                 m.target_role AS "targetRole",
                 m.title,
                 m.body,
                 m.created_at AS "createdAt"
          FROM messages m
          LEFT JOIN users u ON m.author_id = u.id
          WHERE m.target_role = $1 OR m.target_role = 'ALL'
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
  // ---------------------------------------------------------
  // 4. GET /:id - Einzelne Nachricht
  // ---------------------------------------------------------
  router.get("/:id", auth, async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;

    try {
      const result = await pool.query(
        `SELECT m.id,
                m.author_id AS "authorId",
                u.display_name AS "authorName",
                m.target_role AS "targetRole",
                m.title,
                m.body,
                m.created_at AS "createdAt"
         FROM messages m
         LEFT JOIN users u ON m.author_id = u.id
         WHERE m.id = $1::uuid
         AND (m.target_role = $2 OR m.target_role = 'ALL')`,
        [id,userRole]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Error fetching message:", err);
      return res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  return router;
};