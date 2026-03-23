import api from "./api";

export async function getTags() {
  const res = await api.get("/tags");
  return res.data;
}

export async function createTag(name) {
  const response = await api.post('/tags', { name });
  return response.data;
}