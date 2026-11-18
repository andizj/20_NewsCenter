import api from './api';

export async function getMyProfile() {
  const res = await api.get('/users/me');
  return res.data;
}
