import api from './api';

export async function getMyProfile() {
  const res = await api.get('/api/v1/users/me');
  return res.data;
}
