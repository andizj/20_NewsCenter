const express = require("express");
const tagService = require("../services/tagService");
const { isUuid } = require("../utils/validators");
const { handleError } = require("../utils/errorHandler");

const router = express.Router();

/** POST /tags – Create a new tag */
router.post("/", async (req, res) => {
  try {
    const tag = await tagService.createTag(req.body);
    return res.status(201).json(tag);
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /tags – List all tags */
router.get("/", async (_req, res) => {
  try {
    return res.json(await tagService.getAllTags());
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /tags/:id – Get a single tag */
router.get("/:id", async (req, res) => {
  if (!isUuid(req.params.id))
    return res.status(400).json({ error: "Invalid tag id (must be UUID)" });
  try {
    return res.json(await tagService.getTagById(req.params.id));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
