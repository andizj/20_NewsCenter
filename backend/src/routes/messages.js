const express = require("express");
const messageService = require("../services/messageService");
const auth = require("../middleware/auth");
const { handleError } = require("../utils/errorHandler");

/**
 * @param {Function} broadcaster  - SSE broadcast function injected from index.js
 */
module.exports = (broadcaster) => {
  const router = express.Router();

  /** POST /messages – Create a new message (auth required) */
  router.post("/", auth, async (req, res) => {
    try {
      const message = await messageService.createMessage(
        { authorId: req.user.id, ...req.body },
        broadcaster
      );
      return res.status(201).json(message);
    } catch (err) {
      return handleError(res, err);
    }
  });

  /** POST /messages/:id/tags – Assign a tag to a message (auth required) */
  router.post("/:id/tags", auth, async (req, res) => {
    try {
      const result = await messageService.addTagToMessage(req.params.id, req.body.tagId);
      return res.status(201).json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  /**
   * GET /messages/search?q=... – Thesaurus-powered search (auth required)
   * IMPORTANT: this route must be declared BEFORE /:id to avoid "search" being
   * treated as a UUID parameter.
   */
  router.get("/search", auth, async (req, res) => {
    try {
      const results = await messageService.searchMessages({
        query: (req.query.q || "").trim().toLowerCase(),
        userRole: req.user.role,
      });
      return res.json(results);
    } catch (err) {
      return handleError(res, err);
    }
  });

  /** GET /messages – Get feed (role + subscription filtered, auth required) */
  router.get("/", auth, async (req, res) => {
    try {
      const messages = await messageService.getMessages({
        userRole: req.user.role,
        userId: req.user.id,
        tag: req.query.tag,
      });
      return res.json(messages);
    } catch (err) {
      return handleError(res, err);
    }
  });

  /** GET /messages/:id – Get a single message (auth required) */
  router.get("/:id", auth, async (req, res) => {
    try {
      const message = await messageService.getMessageById({
        id: req.params.id,
        userRole: req.user.role,
      });
      return res.json(message);
    } catch (err) {
      return handleError(res, err);
    }
  });

  return router;
};