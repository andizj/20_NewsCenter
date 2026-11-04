// Settings of the agents (persisted in localStorage so they survive reloads
// and are shared between the Settings view and the views that use them).

const PUBLISH_AGENT_AUTOTAG_KEY = "newscenter_publish_agent_autotagging";
const PUBLISH_AGENT_AUTOTAG_EVENT = "newscenter:publish-agent-changed";

/** Publish Agent: auto tag suggestions while writing a message. */
export function isAutoTaggingEnabled() {
  return localStorage.getItem(PUBLISH_AGENT_AUTOTAG_KEY) !== "false";
}

export function setAutoTaggingEnabled(enabled) {
  localStorage.setItem(PUBLISH_AGENT_AUTOTAG_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(PUBLISH_AGENT_AUTOTAG_EVENT));
}

/** Subscribe to toggle changes (returns an unsubscribe function). */
export function onAutoTaggingChange(handler) {
  window.addEventListener(PUBLISH_AGENT_AUTOTAG_EVENT, handler);
  return () => window.removeEventListener(PUBLISH_AGENT_AUTOTAG_EVENT, handler);
}
