const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ldap = require("ldapjs");

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Signs a JWT for the given user payload.
 * @param {{ id: string, email: string, role: string }} user
 * @returns {string}
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
  );
}

/**
 * Authenticates a user against the Technikum Wien LDAP server via StartTLS.
 * Resolves true on success, rejects with an Error on failure.
 * @param {string} username  - LDAP uid (e.g. "if22b001")
 * @param {string} password
 * @returns {Promise<true>}
 */
function authenticateLDAP(username, password) {
  return new Promise((resolve, reject) => {
    if (!password) return reject(new Error("Empty password"));

    const client = ldap.createClient({ url: process.env.LDAP_URL });

    client.on("error", (err) => reject(err));

    const bindDN = `uid=${username},${process.env.LDAP_BASE_DN}`;

    client.starttls({}, null, (tlsErr) => {
      if (tlsErr) {
        client.unbind();
        return reject(new Error("StartTLS failed: " + tlsErr.message));
      }

      client.bind(bindDN, password, (err) => {
        client.unbind();
        if (err) return reject(err);
        resolve(true);
      });
    });
  });
}

module.exports = { hashPassword, comparePassword, generateToken, authenticateLDAP };
