const BASE_URL = process.env.VUE_APP_API_URL || "http://localhost:3000";

// Singleton – one SSE connection for the whole app lifetime
let source = null;
const listeners = new Set();

/**
 * Opens an SSE connection to /subscribe.
 * Closes any existing connection first.
 */
function connect() {
  disconnect();

  const token = sessionStorage.getItem("token");
  if (!token) {
    console.error("[SSE] Cannot connect without a token");
    return;
  }

  const url = `${BASE_URL}/subscribe?token=${encodeURIComponent(token)}`;

  source = new EventSource(url);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // The backend sends an initial handshake with { message, clientId } – no "id" field.
      // Real message objects always have an UUID "id". Ignore the handshake.
      if (!data.id) return;

      listeners.forEach((fn) => fn(data));
    } catch (e) {
      console.error("[SSE] Parse error:", e);
    }
  };

  source.onerror = () => {
    // EventSource reconnects automatically after ~3s – no manual handling needed.
    console.warn("[SSE] Connection lost – browser is retrying automatically.");
  };
}

/**
 * Registers a callback that is called whenever a new message arrives via SSE.
 * Returns an unsubscribe function.
 * @param {(data: object) => void} fn
 * @returns {() => void}
 */
function onMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Closes the SSE connection and removes all listeners.
 */
function disconnect() {
  if (source) {
    source.close();
    source = null;
  }
  listeners.clear();
}

export default { connect, onMessage, disconnect };
