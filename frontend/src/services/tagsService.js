import api from "./api";

export async function getTags() {
  const res = await api.get("/tags");
  return res.data;
}

export async function createTag(name) {
  const response = await api.post('/tags', { name });
  return response.data;
}

/**
 * Case-insensitive lookup of an existing tag by name.
 * Returns the tag or null.
 */
export async function findTagByName(name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;

  const tags = await getTags();
  return tags.find((tag) => String(tag.name).trim().toLowerCase() === wanted) || null;
}

/**
 * Returns the id of the tag with the given name and creates it first when it
 * does not exist yet – so a message can be published with a brand new tag.
 * Never creates a duplicate: existing tags (incl. race conditions) are reused.
 *
 * @param {string} name
 * @returns {Promise<string>} tag id
 */
export async function ensureTag(name) {
  const cleaned = String(name || "").trim().replace(/^#+/, "").trim();
  if (!cleaned) throw new Error("Tag name is required");

  const existing = await findTagByName(cleaned);
  if (existing) return existing.id;

  try {
    const created = await createTag(cleaned);
    return created.id;
  } catch (err) {
    // Tag was created in the meantime (409) → reuse it instead of duplicating.
    if (err?.response?.status === 409) {
      const raced = await findTagByName(cleaned);
      if (raced) return raced.id;
    }
    throw err;
  }
}