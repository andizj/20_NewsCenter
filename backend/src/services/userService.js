const userRepository = require("../repositories/userRepository");
const tagRepository = require("../repositories/tagRepository");
const authService = require("./authService");
const { normalizeEmail } = require("../utils/validators");

const ALLOWED_ROLES = ["STUDENT", "EMPLOYEE"];
// Placeholder hash that signals the user is LDAP-only (no local login allowed).
const LDAP_DUMMY_HASH = "$2b$10$INVALID_LOCAL_LOGIN_FOR_LDAP_USER_0000000";
// Regex that matches Technikum Wien student IDs (e.g. "if22b001").
const STUDENT_ID_REGEX = /^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$/;

/**
 * Creates a new local user account.
 * Throws { status, message } for expected validation / conflict errors.
 */
async function createUser({ displayName, email, password, role }) {
  const normalizedRole = (role || "STUDENT").trim().toUpperCase();

  if (!ALLOWED_ROLES.includes(normalizedRole))
    throw { status: 400, message: "Invalid role" };

  if (!displayName?.trim() || !email || !password)
    throw { status: 400, message: "displayName, email and password are required" };

  if (password.length < 8)
    throw { status: 400, message: "Password must be at least 8 characters long" };

  const passwordHash = await authService.hashPassword(password);

  try {
    return await userRepository.create({
      displayName: displayName.trim(),
      email: normalizeEmail(email),
      passwordHash,
      role: normalizedRole,
    });
  } catch (err) {
    if (err.code === "23505") throw { status: 409, message: "Email already exists" };
    throw err;
  }
}

/**
 * Returns all users (public fields only).
 */
async function getAllUsers() {
  return userRepository.findAll();
}

/**
 * Returns a single user by UUID.
 * Throws 404 if not found.
 */
async function getUserById(id) {
  const user = await userRepository.findById(id);
  if (!user) throw { status: 404, message: "User not found" };
  return user;
}

/**
 * Hybrid login: tries local DB first, then LDAP as fallback.
 * LDAP users are provisioned Just-in-Time on first successful login.
 * Returns { message, token, user } on success.
 * Throws { status, message } on failure.
 */
async function login({ email: emailInput, password }) {
  if (!process.env.JWT_SECRET)
    throw { status: 500, message: "JWT_SECRET is not set" };

  const normalizedEmail = normalizeEmail(emailInput);
  if (!normalizedEmail || !password)
    throw { status: 400, message: "email and password are required" };

  // Ensure we always look up by a full email address in the DB.
  const userEmail = normalizedEmail.includes("@")
    ? normalizedEmail
    : `${normalizedEmail}@technikum-wien.at`;

  let isAuthenticated = false;
  let authUser = null;

  // --- Step 1: Local DB check (bcrypt) ---
  const dbUser = await userRepository.findByEmail(userEmail);
  const isLocalUser = dbUser && !dbUser.password_hash.includes("INVALID_LOCAL_LOGIN");

  if (isLocalUser) {
    const valid = await authService.comparePassword(password, dbUser.password_hash);
    if (valid) {
      isAuthenticated = true;
      authUser = dbUser;
      console.log("[Auth] Local login:", authUser.email);
    }
  }

  // --- Step 2: LDAP fallback ---
  if (!isAuthenticated) {
    const ldapUsername = normalizedEmail.includes("@")
      ? normalizedEmail.split("@")[0]
      : normalizedEmail;

    try {
      await authService.authenticateLDAP(ldapUsername, password);
      isAuthenticated = true;
      console.log("[Auth] LDAP login:", ldapUsername);

      // JIT provisioning: create DB record on first LDAP login.
      if (!dbUser) {
        const role = STUDENT_ID_REGEX.test(ldapUsername) ? "STUDENT" : "EMPLOYEE";
        authUser = await userRepository.create({
          displayName: ldapUsername,
          email: userEmail,
          passwordHash: LDAP_DUMMY_HASH,
          role,
        });
      } else {
        authUser = dbUser;
      }
    } catch (ldapErr) {
      console.error("[Auth] LDAP failed:", ldapErr.message);
    }
  }

  // --- Step 3: Final verdict ---
  if (!isAuthenticated)
    throw { status: 401, message: "Ungültige Anmeldedaten (Lokal & LDAP fehlgeschlagen)" };

  const token = authService.generateToken({
    id: authUser.id,
    email: authUser.email,
    role: authUser.role,
  });

  return {
    message: "Login erfolgreich",
    token,
    user: {
      id: authUser.id,
      email: authUser.email,
      displayName: authUser.display_name || authUser.displayName,
      role: authUser.role,
    },
  };
}

/**
 * Returns all tags a user has subscribed to.
 * Throws 404 if the user does not exist.
 */
async function getSubscriptions(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  return userRepository.findSubscriptions(userId);
}

/**
 * Subscribes a user to a tag.
 * Throws 404 if user or tag not found.
 * Returns the new subscription or an info object if it already existed.
 */
async function addSubscription(userId, tagId) {
  const user = await userRepository.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };

  const tag = await tagRepository.findById(tagId);
  if (!tag) throw { status: 404, message: "Tag not found" };

  const result = await userRepository.addSubscription(userId, tagId);
  if (!result) return { userId, tagId, info: "User is already subscribed to this tag" };
  return result;
}

/**
 * Removes a user's subscription to a tag.
 * Returns a success or "already gone" message.
 */
async function removeSubscription(userId, tagId) {
  const rowCount = await userRepository.removeSubscription(userId, tagId);
  if (rowCount === 0) return { message: "Subscription not found or already deleted" };
  return { success: true, message: "Unsubscribed successfully" };
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  login,
  getSubscriptions,
  addSubscription,
  removeSubscription,
};
