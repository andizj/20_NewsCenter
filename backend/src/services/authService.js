const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ldap = require("ldapjs");
const { readOwnProfile, unavailableProfile } = require("./ldapProfileService");

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

/** Close gracefully, with a bounded forced disconnect even if unbind hangs. */
function closeLDAPClient(client) {
  if (!client) return Promise.resolve();
  return new Promise(resolve => {
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      try { client.destroy(); } catch { /* cleanup must not expose LDAP details */ }
      resolve();
    };
    const timer = setTimeout(finish, 1000);
    try { client.unbind(finish); } catch { finish(); }
  });
}

/**
 * Authenticates via StartTLS, then reads the name before closing the connection.
 * Only authentication failures reject; profile-read failures return no name.
 * @param {string} username  - LDAP uid (e.g. "if22b001")
 * @param {string} password
 * @returns {Promise<{ authenticated: true, displayName: string|null, profileReadStatus: string }>}
 */
function authenticateLDAP(username, password) {
  return new Promise((resolve, reject) => {
    if (typeof username !== "string" || !username.trim() || !password) {
      return reject(new Error("LDAP credentials are required"));
    }
    let client;
    let settled = false;
    let authenticated = false;
    let timer;
    const profileRead = new AbortController();
    const finish = (error, profile) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      profileRead.abort();
      closeLDAPClient(client).then(() => {
        if (error) reject(error);
        else resolve({ authenticated: true, ...profile });
      });
    };
    const authenticationError = () => new Error("LDAP authentication failed");
    const onConnectionError = () => authenticated
      ? finish(null, unavailableProfile("connection_error"))
      : finish(authenticationError());

    try {
      if (!process.env.LDAP_URL || !process.env.LDAP_BASE_DN) throw authenticationError();
      const base = ldap.parseDN(process.env.LDAP_BASE_DN);
      if (!base.length) throw authenticationError();
      // RDN serialization escapes the username without changing its identity.
      const bindDN = new ldap.DN({ rdns: [
        new ldap.RDN({ uid: username }),
        ...Array.from({ length: base.length }, (_, index) => base.rdnAt(index)),
      ] }).toString();
      client = ldap.createClient({
        url: process.env.LDAP_URL, connectTimeout: 8000, timeout: 10000, reconnect: false,
      });
      client.on("error", onConnectionError);
      timer = setTimeout(() => authenticated
        ? finish(null, unavailableProfile("timeout"))
        : finish(authenticationError()), 20000);
      client.starttls({}, null, tlsError => {
        if (settled) return;
        if (tlsError) return finish(authenticationError());
        try {
          client.bind(bindDN, password, error => {
            if (settled) return;
            if (error) return finish(authenticationError());
            authenticated = true;
            readOwnProfile(client, bindDN, username, { signal: profileRead.signal }).then(
              profile => finish(null, profile),
              () => finish(null, unavailableProfile("query_failed"))
            );
          });
        } catch { finish(authenticationError()); }
      });
    } catch { finish(authenticationError()); }
  });
}

module.exports = { hashPassword, comparePassword, generateToken, authenticateLDAP };
