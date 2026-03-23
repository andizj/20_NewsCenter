import axios from 'axios';

// Create an Axios instance with the base URL from your environment variable
const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL, // This reads from .env
  timeout: 5000, // Optional: Set timeout if API takes too long
});

// You can add methods to interact with the backend API here, like:
export const getNews = async () => {
  try {
    const response = await api.get('/news');  // Example endpoint
    return response.data; // Return the data from the backend
  } catch (error) {
    throw error; // Handle error
  }
};

export default api;
