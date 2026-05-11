const tagRepository = require("../repositories/tagRepository");

/**
 * Returns all tags.
 */
async function getAllTags() {
  return tagRepository.findAll();
}

/**
 * Returns a single tag by UUID.
 * Throws 404 if not found.
 */
async function getTagById(id) {
  const tag = await tagRepository.findById(id);
  if (!tag) throw { status: 404, message: "Tag not found" };
  return tag;
}

/**
 * Creates a new tag.
 * Throws 400 if name is missing, 409 if it already exists.
 */
async function createTag({ name, description }) {
  if (!name) throw { status: 400, message: "name is required" };
  try {
    return await tagRepository.create({ name, description });
  } catch (err) {
    if (err.code === "23505") throw { status: 409, message: "Tag name already exists" };
    throw err;
  }
}

module.exports = { getAllTags, getTagById, createTag };
