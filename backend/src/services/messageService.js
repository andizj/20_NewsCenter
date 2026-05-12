const axios = require("axios");
const messageRepository = require("../repositories/messageRepository");

const ALLOWED_TARGET_ROLES = ["ALL", "STUDENT", "EMPLOYEE"];
const THESAURUS_API = "https://www.openthesaurus.de/synonyme/search";

/**
 * Creates a new message and returns it.
 * Broadcasting to SSE clients happens AFTER the tag is assigned (in the route layer),
 * so the full message including tags is available at that point.
 *
 * @param {{ authorId: string, targetRole: string, title: string, body: string }} payload
 */
async function createMessage({ authorId, targetRole, title, body }) {
  if (!title || !body)
    throw { status: 400, message: "Bitte Titel und Text angeben." };

  const finalTargetRole = ALLOWED_TARGET_ROLES.includes(targetRole) ? targetRole : "ALL";
  return messageRepository.create({ authorId, targetRole: finalTargetRole, title, body });
}

/**
 * Assigns a tag to an existing message.
 * Throws 400 if tagId is missing, 409 if the tag is already assigned.
 *
 * @param {string} messageId
 * @param {string} tagId
 */
async function addTagToMessage(messageId, tagId) {
  if (!tagId) throw { status: 400, message: "tagId is required" };
  try {
    return await messageRepository.addTag(messageId, tagId);
  } catch (err) {
    if (err.code === "23505") throw { status: 409, message: "Message already has this tag" };
    throw err;
  }
}

async function getMessageForBroadcast(id) {
  return messageRepository.findByIdAdmin(id);
}

/**
 * Returns the message feed for a user, optionally filtered by tag.
 *
 * @param {{ userRole: string, userId: string, tag?: string, filter?: string }} param0
 */
async function getMessages({ userRole, userId, tag, filter }) {
  return messageRepository.findFiltered({ userRole, userId, tag, filter });
}

/**
 * Searches messages by a query term, expanding it with synonyms from the
 * openthesaurus.de API. Falls back to the raw term if the API is unavailable.
 *
 * @param {{ query: string, userRole: string }} param0
 */
async function searchMessages({ query, userRole }) {
  if (!query) throw { status: 400, message: "Search query is required" };

  let terms = [query.toLowerCase()];

  try {
    const response = await axios.get(THESAURUS_API, {
      params: { q: query, format: "application/json" },
    });
    const synsets = response.data?.synsets ?? [];
    synsets.forEach((synset) =>
      synset.terms.forEach((t) => terms.push(t.term.toLowerCase()))
    );
  } catch (apiErr) {
    console.error("[Thesaurus] API unavailable:", apiErr.message);
  }

  terms = [...new Set(terms)];
  return messageRepository.search({ terms, userRole });
}

/**
 * Returns a single message by UUID, checking the user's role.
 * Throws 404 if not found or not visible for this role.
 *
 * @param {{ id: string, userRole: string }} param0
 */
async function getMessageById({ id, userRole }) {
  const message = await messageRepository.findById(id, userRole);
  if (!message) throw { status: 404, message: "Message not found" };
  return message;
}

module.exports = {
  createMessage,
  addTagToMessage,
  getMessageForBroadcast,
  getMessages,
  searchMessages,
  getMessageById,
};
