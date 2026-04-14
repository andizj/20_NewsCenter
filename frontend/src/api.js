import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 5000,
});

export const getNews = async () => {
  try {
    const response = await api.get('/news');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;
