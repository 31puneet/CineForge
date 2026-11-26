import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // IMPORTANT: This tells the browser to always attach the HttpOnly cookie
});

export default apiClient;
