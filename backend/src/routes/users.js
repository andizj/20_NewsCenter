const express = require("express");
const { pool } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const ldap = require("ldapjs");

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
 * HILFSFUNKTION: LDAP Authentifizierung
 * Baut via StartTLS (-ZZ) eine sichere Verbindung zum LDAP Server auf.
 */
function authenticateLDAP(username, password) {
  return new Promise((resolve, reject) => {
    if (!password) {
      return reject(new Error("Empty password"));
    }

    const client = ldap.createClient({
      url: process.env.LDAP_URL // z.B. ldap://ldap.technikum-wien.at
    });

    client.on('error', (err) => {
      reject(err);
    });

    // Technikum-Wien Format: uid=if22b...,ou=people,dc=technikum-wien,dc=at
    const bindDN = `uid=${username},${process.env.LDAP_BASE_DN}`;

    // Wegen dem -ZZ im ldapsearch müssen wir zwingend StartTLS aktivieren
    client.starttls({}, null, (tlsErr) => {
      if (tlsErr) {
        client.unbind();
        return reject(new Error("StartTLS failed: " + tlsErr.message));
      }

      // Erst NACH erfolgreichem TLS versuchen wir den Login (Bind)
      client.bind(bindDN, password, (err) => {
        if (err) {
          client.unbind();
          return reject(err);
        }
        
        client.unbind();
        resolve(true);
      });
    });
  });
}

/**
 * POST /users
 * Neuen User anlegen (lokal, mit sicherem Passwort-Hashing)
 */
router.post("/", async (req, res) => {
  const displayName =
    typeof req.body.displayName === "string" ? req.body.displayName.trim() : "";
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role = typeof req.body.role === "string" ? req.body.role.trim().toUpperCase() : "STUDENT";

  const allowedRoles = ["STUDENT", "EMPLOYEE"];

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
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (display_name, email, password_hash,role)
       VALUES ($1, $2, $3,$4)
       RETURNING id,
                 display_name AS "displayName",
                 email,
                 role,
                 created_at AS "createdAt"`,
      [displayName, email, passwordHash, role]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating user:", err.message);
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

    if (result.rowCount === 0) {
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
 * Hybrid Login: Versucht zuerst lokale Datenbank (bcrypt), 
 * fällt dann auf LDAP + Just-in-Time Provisioning zurück.
 */
router.post("/login", async (req, res) => {
  const emailInput = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!emailInput || !password) {
    return res.status(400).json({ error: "email/username and password are required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not set" });
  }

  try {
    let isAuthenticated = false;
    let authUser = null;

    // E-Mail für die DB-Suche vorbereiten
    const userEmail = emailInput.includes('@') ? emailInput : `${emailInput}@technikum-wien.at`;

    // ---------------------------------------------------------
    // 1. LOKALER CHECK (Datenbank & bcrypt)
    // ---------------------------------------------------------
    const result = await pool.query(
      `SELECT id, email, display_name, role, password_hash
       FROM users
       WHERE email = $1`,
      [userEmail]
    );

    const dbUser = result.rows[0];

    // Wenn User in DB existiert UND ein echtes lokales Passwort hat
    if (dbUser && !dbUser.password_hash.includes("INVALID_LOCAL_LOGIN")) {
      const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
      if (isPasswordValid) {
        isAuthenticated = true;
        authUser = dbUser;
        console.log("Hybrid-Login: Erfolgreich LOKAL angemeldet:", authUser.email);
      }
    }

    // ---------------------------------------------------------
    // 2. LDAP CHECK (Fallback, wenn lokal nicht geklappt hat)
    // ---------------------------------------------------------
    if (!isAuthenticated) {
      const ldapUsername = emailInput.includes('@') ? emailInput.split('@')[0] : emailInput;
      
      try {
        await authenticateLDAP(ldapUsername, password);
        isAuthenticated = true; // LDAP sagt "Ja!"
        console.log("Hybrid-Login: Erfolgreich via LDAP angemeldet:", ldapUsername);
        
        // JIT (Just-in-Time) Provisioning für den LDAP-User
        if (!dbUser) {
          // Prüft auf exaktes Muster: 2 Buchstaben, 2 Zahlen, 1 Buchstabe, 3 Zahlen (z.B. if24b123)
          const isStudent = /^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$/.test(ldapUsername); 
          const role = isStudent ? "STUDENT" : "EMPLOYEE";
          const displayName = ldapUsername; 
          // Dieser Dummy-Hash zeigt uns später, dass dieser User über LDAP reinkommt
          const dummyPasswordHash = "$2b$10$INVALID_LOCAL_LOGIN_FOR_LDAP_USER_0000000"; 

          const insertResult = await pool.query(
            `INSERT INTO users (display_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, display_name AS "displayName", email, role`,
            [displayName, userEmail, dummyPasswordHash, role]
          );
          authUser = insertResult.rows[0];
        } else {
          authUser = dbUser; // User existierte schon als LDAP-Nutzer in der DB
        }
        
      } catch (ldapErr) {
        console.error("LDAP Login fehlgeschlagen:", ldapErr.message);
        // isAuthenticated bleibt auf false
      }
    }

    // ---------------------------------------------------------
    // 3. FINALES ERGEBNIS
    // ---------------------------------------------------------
    if (!isAuthenticated) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten (Lokal & LDAP fehlgeschlagen)" });
    }

    // 4. JWT Token generieren
    const token = jwt.sign(
      { userId: authUser.id, email: authUser.email, role: authUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
    );

    return res.json({
      message: "Login erfolgreich",
      token,
      user: {
        id: authUser.id,
        email: authUser.email,
        displayName: authUser.display_name || authUser.displayName,
        role: authUser.role,
      },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Login failed", details: err.message });
  }
});

module.exports = router;