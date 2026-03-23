import api from './api';

// Hilfsfunktion: User ID aus dem LocalStorage holen
function getCurrentUserId() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return user.id;
  } catch (e) {
    return null;
  }
}

export async function getSubscriptions() {
  const userId = getCurrentUserId();
  if (!userId) return []; // Wer nicht eingeloggt ist, hat keine Abos

  const response = await api.get(`/users/${userId}/subscriptions`);
  return response.data; 
}

export async function subscribe(tagId) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not logged in");

  return api.post(`/users/${userId}/subscriptions`, { tagId });
}

export async function unsubscribe(tagId) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not logged in");

  return api.delete(`/users/${userId}/subscriptions/${tagId}`);
}