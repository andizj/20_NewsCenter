const express = require("express");
const userService = require("../services/userService");
const { isUuid } = require("../utils/validators");
const { handleError } = require("../utils/errorHandler");

const router = express.Router();

/** POST /users – Register a new local user */
router.post("/", async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (err) {
    return handleError(res, err);
  }
});

/** POST /users/login – Hybrid login (local DB → LDAP fallback) */
router.post("/login", async (req, res) => {
  try {
    const result = await userService.login(req.body);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /users – List all users */
router.get("/", async (_req, res) => {
  try {
    return res.json(await userService.getAllUsers());
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /users/:id – Get a single user */
router.get("/:id", async (req, res) => {
  if (!isUuid(req.params.id))
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  try {
    return res.json(await userService.getUserById(req.params.id));
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /users/:id/subscriptions – Get subscribed tags for a user */
router.get("/:id/subscriptions", async (req, res) => {
  if (!isUuid(req.params.id))
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  try {
    return res.json(await userService.getSubscriptions(req.params.id));
  } catch (err) {
    return handleError(res, err);
  }
});

/** POST /users/:id/subscriptions – Subscribe a user to a tag */
router.post("/:id/subscriptions", async (req, res) => {
  const { id } = req.params;
  const { tagId } = req.body;

  if (!isUuid(id))
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  if (!tagId || !isUuid(tagId))
    return res.status(400).json({ error: "Invalid or missing tagId (UUID)" });

  try {
    const result = await userService.addSubscription(id, tagId);
    const status = result.info ? 200 : 201;
    return res.status(status).json(result);
  } catch (err) {
    return handleError(res, err);
  }
});

/** DELETE /users/:id/subscriptions/:tagId – Unsubscribe a user from a tag */
router.delete("/:id/subscriptions/:tagId", async (req, res) => {
  const { id, tagId } = req.params;

  if (!isUuid(id))
    return res.status(400).json({ error: "Invalid user id (must be UUID)" });
  if (!isUuid(tagId))
    return res.status(400).json({ error: "Invalid tag id (must be UUID)" });

  try {
    return res.json(await userService.removeSubscription(id, tagId));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;