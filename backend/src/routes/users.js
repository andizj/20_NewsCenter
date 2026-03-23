const express = require("express");
const { pool } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const router = express.Router();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

/**
 * POST /users
 * Neuen User anlegen (mit sicherem Passwort-Hashing)
 */
router.post("/", async (req, res) => {
  const displayName =
    typeof req.body.displayName === "string" ? req.body.displayName.trim() : "";
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role = typeof req.body.role === "string" ? req.body.role.trim().toUpperCase() : "STUDENT";

  const allowedRoles = ["STUDENT", "EMPLOYEE"];

  // Validation

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  if (!displayName || !email || !password) {
    return res.status(400).json({
      error: "displayName, email and password are required",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long",
    });
  }

  try {
    // Hash password (never store plaintext)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (display_name, email, password_hash,role)
       VALUES ($1, $2, $3,$4)
       RETURNING id,
                 display_name AS "displayName",
                 email,
                 role,
                 created_at AS "createdAt"`,
      [displayName, email, passwordHash,role]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating user:", err.message);

    // Duplicate email (unique constraint) -> nicer message
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }

    return res.status(500).json({
      error: "Failed to create user",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * GET /users
 * Alle User holen
 */
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              display_name AS "displayName",
              email,
              created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    return res.status(500).json({
      error: "Failed to fetch users",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * GET /users/:id
 * Einen User nach ID holen
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  }

  try {
    const result = await pool.query(
      `SELECT id,
              display_name AS "displayName",
              email,
              created_at AS "createdAt"
       FROM users
       WHERE id = $1::uuid`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err.message);
    return res.status(500).json({
      error: "Failed to fetch user",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * POST /users/:id/subscriptions
 * User-Tag-Subscription anlegen
 */
router.post("/:id/subscriptions", async (req, res) => {
  const { id } = req.params;
  const { tagId } = req.body;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  }
  if (!tagId || !isUuid(tagId)) {
    return res.status(400).json({ error: "Invalid or missing tagId (UUID)" });
  }

  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE id = $1::uuid`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const tagResult = await pool.query(
      `SELECT id FROM tags WHERE id = $1::uuid`,
      [tagId]
    );
    if (tagResult.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, tag_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (user_id, tag_id) DO NOTHING
       RETURNING user_id AS "userId", tag_id AS "tagId"`,
      [id, tagId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        userId: id,
        tagId,
        info: "User is already subscribed to this tag",
      });
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating subscription:", err.message);
    return res.status(500).json({
      error: "Failed to create subscription",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * DELETE /users/:id/subscriptions/:tagId
 * Subscription löschen (Unsubscribe)
 */
router.delete("/:id/subscriptions/:tagId", async (req, res) => {
  const { id, tagId } = req.params;

  // Validierung der UUIDs
  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  }
  if (!tagId || !isUuid(tagId)) {
    return res.status(400).json({ error: "Invalid tag id (must be UUID)" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM subscriptions 
       WHERE user_id = $1::uuid AND tag_id = $2::uuid`,
      [id, tagId]
    );

    // Optional: Prüfen, ob überhaupt was gelöscht wurde
    if (result.rowCount === 0) {
      // Man könnte 404 senden, oder einfach 200 (idempotent)
      // Hier senden wir 200 mit Info, das ist okay für die UI.
      return res.status(200).json({ message: "Subscription not found or already deleted" });
    }

    return res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Error deleting subscription:", err.message);
    return res.status(500).json({
      error: "Failed to delete subscription",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * GET /users/:id/subscriptions
 * Abonnierte Tags eines Users holen
 */
router.get("/:id/subscriptions", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  }

  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE id = $1::uuid`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await pool.query(
      `SELECT t.id,
              t.name,
              t.description,
              t.created_at AS "createdAt"
       FROM subscriptions s
       JOIN tags t ON t.id = s.tag_id
       WHERE s.user_id = $1::uuid
       ORDER BY t.name ASC`,
      [id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user subscriptions:", err.message);
    return res.status(500).json({
      error: "Failed to fetch user subscriptions",
      details: err.message,
      code: err.code || null,
    });
  }
});

/**
 * POST /users/login
 * Login mit bcrypt + JWT
 */
router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not set" });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, display_name, password_hash, role
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const user = result.rows[0];

    // Must be a bcrypt hash
    if (!user.password_hash || !user.password_hash.startsWith("$2")) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email , role: user.role},
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
    );

    return res.json({
      message: "Login erfolgreich",
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Login failed", details: err.message });
  }
});

module.exports = router;
