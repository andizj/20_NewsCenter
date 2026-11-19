const axios = require("axios");
const { Ollama } = require("ollama");
const ollama = new Ollama({
  host: "http://host.docker.internal:11434",
});
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

const MAX_TAGS_PER_MESSAGE = 3;
const TAG_LIMIT_MESSAGE = `Eine Nachricht kann maximal ${MAX_TAGS_PER_MESSAGE} Themen haben.`;

/** Throws 400 if adding `count` tags would exceed the per-message limit. */
async function assertTagLimit(messageId, count) {
  const existing = await messageRepository.countTags(messageId);
  if (existing + count > MAX_TAGS_PER_MESSAGE) throw { status: 400, message: TAG_LIMIT_MESSAGE };
}

function mapTagInsertError(err) {
  if (err.code === "23505") return { status: 409, message: "Message already has this tag" };
  return err;
}

/**
 * Assigns a tag to an existing message.
 * Throws 400 if tagId is missing or the message already has the maximum
 * number of tags, 409 if the tag is already assigned.
 *
 * @param {string} messageId
 * @param {string} tagId
 */
async function addTagToMessage(messageId, tagId) {
  if (!tagId) throw { status: 400, message: "tagId is required" };
  await assertTagLimit(messageId, 1);
  try {
    return await messageRepository.addTag(messageId, tagId);
  } catch (err) {
    throw mapTagInsertError(err);
  }
}

/**
 * Assigns up to MAX_TAGS_PER_MESSAGE tags to a message in one step.
 * Duplicates in the list are ignored. Throws 400 for an empty/invalid list or
 * when the limit would be exceeded, 409 if one of the tags is already assigned.
 *
 * @param {string} messageId
 * @param {string[]} tagIds
 */
async function addTagsToMessage(messageId, tagIds) {
  if (!Array.isArray(tagIds) || tagIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw { status: 400, message: "tagIds must be a list of tag ids" };
  }
  const uniqueIds = [...new Set(tagIds.map((id) => id.trim()))];
  if (!uniqueIds.length) throw { status: 400, message: "tagIds is required" };
  if (uniqueIds.length > MAX_TAGS_PER_MESSAGE) throw { status: 400, message: TAG_LIMIT_MESSAGE };

  await assertTagLimit(messageId, uniqueIds.length);
  try {
    return await messageRepository.addTags(messageId, uniqueIds);
  } catch (err) {
    throw mapTagInsertError(err);
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

async function summarizeMessage({ id, userRole }) {
  const message = await messageRepository.findById(id, userRole);

  if (!message) {
    throw { status: 404, message: "Message not found" };
  }

  const prompt = `
Erstelle eine kurze Zusammenfassung der folgenden Nachricht.

Regeln:
- Maximal 3 Sätze
- Nur die wichtigsten Informationen
- Keine Einleitung wie "Hier ist die Zusammenfassung"
- Keine Aufzählungen
- Keine Interpretation oder eigene Meinung
- Antworte ausschließlich mit der Zusammenfassung

Titel:
${message.title}

Nachricht:
${message.body}
`;

  const response = await ollama.chat({
    model: process.env.OLLAMA_MODEL || "llama3",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    summary: response.message.content,
  };
}


module.exports = {
  createMessage,
  addTagToMessage,
  addTagsToMessage,
  MAX_TAGS_PER_MESSAGE,
  getMessageForBroadcast,
  getMessages,
  searchMessages,
  getMessageById,
  summarizeMessage,
};
