const axios = require("axios");
const llmService = require("./llmService");
const messageRepository = require("../repositories/messageRepository");

const ALLOWED_TARGET_ROLES = ["ALL", "STUDENT", "EMPLOYEE"];
const THESAURUS_API = "https://www.openthesaurus.de/synonyme/search";


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

async function addTagToMessage(messageId, tagId) {
  if (!tagId) throw { status: 400, message: "tagId is required" };
  await assertTagLimit(messageId, 1);
  try {
    return await messageRepository.addTag(messageId, tagId);
  } catch (err) {
    throw mapTagInsertError(err);
  }
}

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

async function getMessages({ userRole, userId, tag, filter }) {
  return messageRepository.findFiltered({ userRole, userId, tag, filter });
}

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

  const summary = await llmService.generateText(prompt);

  return { summary };
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
