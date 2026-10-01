const axios = require("axios");
const tagRepository = require("../repositories/tagRepository");

const THESAURUS_API = "https://www.openthesaurus.de/synonyme/search";
const THESAURUS_TIMEOUT_MS = 3000;
const MAX_THESAURUS_TERMS = 6;
const MAX_SUGGESTIONS = 6;
const MAX_NEW_SUGGESTIONS = 3;
const MIN_THESAURUS_TERM_LENGTH = 3;
const MIN_TITLE_BODY_TOKEN_LENGTH = 4;

/**
 * Curated keyword catalog for NEW tag suggestions.
 * Only words from this list (plus words that appear in title AND body)
 * can become a new tag – this keeps suggestions meaningful and avoids
 * noise like filler words.
 */
const KEYWORD_CATALOG = [
  // English
  "exam",
  "workshop",
  "deadline",
  "maintenance",
  "event",
  "registration",
  "study",
  "security",
  "it",
  "lecture",
  "seminar",
  "course",
  "internship",
  "job",
  "career",
  "scholarship",
  "holiday",
  "outage",
  "network",
  "wifi",
  "library",
  "canteen",
  "sports",
  "lab",
  "tutorial",
  "policy",
  "booking",
  "support",
  "construction",
  // German
  "prüfung",
  "anmeldung",
  "frist",
  "wartung",
  "veranstaltung",
  "vorlesung",
  "semester",
  "ferien",
  "ausfall",
  "bibliothek",
  "mensa",
  "werkstatt",
  "sicherheit",
];

/**
 * Filler words that must never become a tag suggestion.
 */
const STOP_WORDS = new Set([
  // English
  "the", "and", "for", "you", "your", "with", "this", "that", "from", "are",
  "was", "were", "will", "would", "shall", "should", "can", "could", "have",
  "has", "had", "not", "but", "all", "any", "our", "out", "get", "got", "new",
  "one", "two", "now", "here", "there", "when", "what", "who", "how", "why",
  "about", "into", "over", "after", "before", "during", "above", "below",
  "between", "them", "they", "their", "these", "those", "his", "her", "its",
  "be", "is", "in", "on", "at", "to", "of", "as", "by", "or", "if", "do",
  "does", "did", "we", "us", "i", "he", "she", "me", "my", "than", "then",
  "too", "very", "also", "just", "only", "more", "most", "some", "such",
  "no", "nor", "own", "same", "so", "because", "until", "while", "up", "down",
  "again", "further", "once", "each", "other", "though", "via", "per", "may",
  "might", "must", "need", "make", "made", "come", "go", "going", "today",
  "tomorrow", "yesterday", "week", "weeks", "month", "months", "year",
  "years", "day", "days", "time", "times", "please", "note", "info",
  "everyone", "everybody", "hello", "hi", "best", "regards", "kind",
  "message", "messages", "announce", "announcement", "announcements",
  // German
  "der", "die", "das", "und", "ist", "sind", "war", "werden", "wird",
  "fur", "für", "von", "mit", "auf", "im", "in", "den", "dem", "zu", "zum",
  "zur", "ein", "eine", "einer", "eines", "einem", "einen", "auch", "noch",
  "nur", "bereits", "heute", "morgen", "gestern", "woche", "wochen", "monat",
  "monate", "jahr", "jahre", "bitte", "sehr", "mehr", "alle", "alles",
  "diese", "dieser", "dieses", "diesem", "damit", "dabei", "darum", "wenn",
  "dann", "oder", "aber", "nicht", "kein", "keine", "unsere", "unser",
  "euch", "ihr", "sie", "wir", "ich", "du", "er", "es", "nach", "vor",
  "uber", "über", "unter", "zwischen", "durch", "bei", "aus", "am", "vom",
  "bis", "seit", "um", "bzw", "usw", "ggf",
]);

const normalize = (value) =>
  typeof value === "string" ? value.toLowerCase().trim() : "";

/**
 * Light plural normalization so singular/plural variants match
 * (e.g. thesaurus "Event" matches the existing tag "events").
 * @param {string} token
 */
function stem(token) {
  if (token.length >= 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Splits a text into lowercase, plural-normalized word tokens (keeps umlauts).
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9äöüß]+/)
    .filter((token) => token.length >= 2)
    .map(stem);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

/**
 * Expands the given terms with synonyms from the openthesaurus.de API.
 * Returns a Set of normalized synonym tokens. Falls back to an empty set
 * if the API is unavailable (same fallback as the message search).
 *
 * @param {string[]} terms
 * @returns {Promise<Set<string>>}
 */
async function fetchSynonymTokens(terms) {
  const synonymTokens = new Set();
  const candidates = terms
    .filter((term) => term.length >= MIN_THESAURUS_TERM_LENGTH)
    .slice(0, MAX_THESAURUS_TERMS);

  if (candidates.length === 0) return synonymTokens;

  const results = await Promise.allSettled(
    candidates.map((term) =>
      axios.get(THESAURUS_API, {
        params: { q: term, format: "application/json" },
        timeout: THESAURUS_TIMEOUT_MS,
      })
    )
  );

  const fulfilled = results.filter(
    (result) => result.status === "fulfilled" && result.value
  );

  if (fulfilled.length === 0) {
    console.error("[Thesaurus] API unavailable, suggestions use direct matches only");
    return synonymTokens;
  }

  fulfilled.forEach((result) => {
    const synsets = result.value.data?.synsets ?? [];
    synsets.forEach((synset) => {
      (synset.terms || []).forEach((entry) => {
        tokenize(entry?.term).forEach((token) => synonymTokens.add(token));
      });
    });
  });

  return synonymTokens;
}

/**
 * Scores a single tag against the draft text.
 * Returns { score, reason, matchScore } with score 0 when there is no match.
 *
 * Match rules (scores are summed, the strongest rule provides the reason):
 *  - tag name appears as a phrase in the text      -> 6
 *  - all tag words appear in the text              -> 4
 *  - some tag words appear in the text             -> 2
 *  - tag word matches a thesaurus synonym          -> 3 (+1 if also direct)
 *  - tag word appears in the tag description       -> 1
 *
 * @param {{ id: string, name: string, description?: string, subscriberCount: number }} tag
 * @param {{ text: string, terms: Set<string>, synonymTokens: Set<string> }} context
 */
function scoreTag(tag, { text, terms, synonymTokens }) {
  const name = normalize(tag.name);
  const nameTokens = tokenize(name);
  const contributions = [];

  if (name.length > 0) {
    const phrasePattern = new RegExp(
      `(?:^|[^a-z0-9äöüß])${escapeRegExp(name)}(?:[^a-z0-9äöüß]|$)`
    );
    if (phrasePattern.test(text)) {
      contributions.push({ score: 6, reason: "Matched by name in message text" });
    }
  }

  const directTokens = nameTokens.filter((token) => terms.has(token));

  if (nameTokens.length > 0 && directTokens.length === nameTokens.length) {
    contributions.push({ score: 4, reason: "Matched by related words in message text" });
  } else if (directTokens.length > 0) {
    contributions.push({ score: 2, reason: "Partially matched in message text" });
  }

  const synonymOnlyTokens = nameTokens.filter(
    (token) => synonymTokens.has(token) && !terms.has(token)
  );

  if (synonymOnlyTokens.length > 0) {
    contributions.push({
      score: directTokens.length > 0 ? 4 : 3,
      reason:
        directTokens.length > 0
          ? "Matched in message text and by synonym"
          : "Matched by synonym or related term",
    });
  }

  const description = normalize(tag.description);
  if (description && directTokens.some((token) => description.includes(token))) {
    contributions.push({ score: 1, reason: "Matches tag description" });
  }

  const score = contributions.reduce((sum, entry) => sum + entry.score, 0);
  if (score === 0) return { score: 0, reason: null, matchScore: 0 };

  const strongest = contributions.reduce((best, entry) =>
    entry.score > best.score ? entry : best
  );

  return { score, reason: strongest.reason, matchScore: score };
}

/**
 * A catalog keyword counts as "found" when it appears as a word in the text.
 * Short keywords (e.g. "it", "lab") need a stronger signal, otherwise almost
 * every English sentence would suggest the tag "it":
 *  - written uppercase in the text (IT, FAQ, LAB), or
 *  - used as a word in the title (authors write titles deliberately).
 *
 * @param {string} keyword
 * @param {{ rawText: string, rawTitle: string, terms: Set<string> }} context
 */
function keywordFound(keyword, { rawText, rawTitle, terms }) {
  const key = normalize(keyword);

  if (key.length > 3) {
    return terms.has(key) || terms.has(stem(key));
  }

  const uppercasePattern = new RegExp(
    `\\b${escapeRegExp(keyword.toUpperCase())}\\b`
  );
  if (uppercasePattern.test(rawText)) return true;

  const titlePattern = new RegExp(
    `(?:^|[^a-z0-9äöüß])${escapeRegExp(key)}(?:[^a-z0-9äöüß]|$)`,
    "i"
  );
  return titlePattern.test(asText(rawTitle));
}

/**
 * Collects NEW tag suggestions from the draft text.
 *
 * Sources (both derived from title + body):
 *  1. curated keywords ("exam", "workshop", "deadline", …)
 *  2. meaningful words that appear in the title AND in the body
 *
 * Filler words and names that already exist as tags are skipped.
 *
 * @param {{ rawText: string, title: string, body: string, terms: Set<string>, tags: Array }} param0
 * @returns {Array<{ type: "new", name: string, subscriberCount: number, reason: string }>}
 */
function deriveNewTags({ rawText, title, body, terms, tags }) {
  // Names / words that are already covered by an existing tag.
  const taken = new Set();
  tags.forEach((tag) => {
    taken.add(normalize(tag.name));
    tokenize(tag.name).forEach((token) => taken.add(token));
  });

  const used = new Set();
  const suggestions = [];

  const push = (name, reason) => {
    const key = normalize(name);
    if (!key || used.has(key) || taken.has(key)) return;
    if (STOP_WORDS.has(key) || STOP_WORDS.has(stem(key))) return;
    if (taken.has(stem(key))) return;

    used.add(key);
    suggestions.push({
      type: "new",
      name: key,
      subscriberCount: 0,
      reason,
    });
  };

  // 1) curated keywords found in title/body
  KEYWORD_CATALOG.forEach((keyword) => {
    if (suggestions.length >= MAX_NEW_SUGGESTIONS) return;
    if (keywordFound(keyword, { rawText, rawTitle: title, terms })) {
      push(keyword, "Detected relevant keyword");
    }
  });

  // 2) words that appear in the title AND in the body (strong topical signal)
  if (suggestions.length < MAX_NEW_SUGGESTIONS) {
    const titleTerms = new Set(tokenize(title));
    const bodyTerms = new Set(tokenize(body));

    tokenize(title)
      .filter((token) => titleTerms.has(token) && bodyTerms.has(token))
      .filter((token) => token.length >= MIN_TITLE_BODY_TOKEN_LENGTH)
      .forEach((token) => {
        if (suggestions.length >= MAX_NEW_SUGGESTIONS) return;
        push(token, "Recurring keyword in title and body");
      });
  }

  return suggestions.slice(0, MAX_NEW_SUGGESTIONS);
}

/**
 * Publish agent: suggests tags for a message draft (title + body).
 *
 * Existing tags always come first (matched by text, tag descriptions and
 * OpenThesaurus synonyms). Only when no existing tag fits, new tag
 * suggestions derived from the draft text are returned.
 *
 * @param {{ title?: string, body?: string }} param0
 * @returns {Promise<Array>}
 */
async function suggestTags({ title, body }) {
  const rawTitle = asText(title);
  const rawBody = asText(body);
  const rawText = `${rawTitle} ${rawBody}`.trim();

  if (!rawText) throw { status: 400, message: "Bitte Titel oder Text angeben." };

  const tags = await tagRepository.findAllWithSubscriberCount();
  if (!tags || tags.length === 0) return [];

  const text = normalize(rawText);
  const terms = new Set(tokenize(text));
  const synonymTokens = await fetchSynonymTokens([...terms]);

  const existingSuggestions = tags
    .map((tag) => ({ tag, ...scoreTag(tag, { text, terms, synonymTokens }) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.tag.subscriberCount || 0) - (a.tag.subscriberCount || 0) ||
        a.tag.name.localeCompare(b.tag.name)
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ tag, reason, matchScore }) => ({
      type: "existing",
      id: tag.id,
      name: tag.name,
      description: tag.description || null,
      subscriberCount: tag.subscriberCount || 0,
      reason,
      matchScore,
    }));

  // Existing tags are always preferred – new ones only fill the gap.
  if (existingSuggestions.length > 0) return existingSuggestions;

  return deriveNewTags({ rawText, title: rawTitle, body: rawBody, terms, tags });
}

module.exports = { suggestTags };
