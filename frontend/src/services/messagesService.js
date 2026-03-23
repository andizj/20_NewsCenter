import api from "./api";

export async function getMessages() {
  const res = await api.get("/messages");
  return res.data;
}

export async function createMessage(payload) {
  const res = await api.post("/messages", payload);
  return res.data;
}
