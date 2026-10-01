import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api', // Point to our backend container
  withCredentials: true, // IMPORTANT: This tells the browser to always attach the HttpOnly cookie
});

export default apiClient;
