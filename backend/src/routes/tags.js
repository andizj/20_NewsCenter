const express = require("express");
const { pool } = require("../db");

const router = express.Router();

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

// Create new tag
router.post("/", async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tags (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at AS "createdAt"`,
      [name, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating tag:", err);
    res.status(500).json({
      error: "Failed to create tag",
      details: err.message,
      code: err.code || null,
    });
  }
});

// Get all tags
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at AS "createdAt"
       FROM tags
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).json({
      error: "Failed to fetch tags",
      details: err.message,
      code: err.code || null,
    });
  }
});

// Get single tag
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid tag id (must be UUID)" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at AS "createdAt"
       FROM tags
       WHERE id = $1::uuid`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching tag:", err);
    res.status(500).json({
      error: "Failed to fetch tag",
      details: err.message,
      code: err.code || null,
    });
  }
});

module.exports = router;
