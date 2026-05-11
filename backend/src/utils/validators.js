/**
 * Validates whether a string is a valid UUID v1-v5.
 * @param {*} value
 * @returns {boolean}
 */
const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/**
 * Trims and lowercases an email string.
 * @param {*} email
 * @returns {string}
 */
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

module.exports = { isUuid, normalizeEmail };
