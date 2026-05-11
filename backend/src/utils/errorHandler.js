/**
 * Centralized HTTP error responder.
 * Services throw plain objects with { status, message } for expected errors.
 * Unexpected errors fall back to 500.
 *
 * @param {import('express').Response} res
 * @param {Error | { status?: number, message?: string }} err
 */
const handleError = (res, err) => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  return res.status(status).json({ error: message });
};

module.exports = { handleError };
