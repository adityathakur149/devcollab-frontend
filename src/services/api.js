import axios from 'axios';

/**
 * Axios instance with base URL pointing to the backend API.
 * In dev, Vite proxies /api requests to http://localhost:5000.
 */
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor: automatically attach JWT token from localStorage
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('devcollab_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor: handle 401 errors (expired/invalid token)
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('devcollab_token');
      // Don't redirect here — let the components handle it via AuthContext
    }
    return Promise.reject(error);
  }
);

// ---- Auth API ----
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });

export const registerUser = (username, email, password) =>
  api.post('/auth/register', { username, email, password });

export const getProfile = (token) =>
  api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

// ---- Projects API ----
export const getProjects = () => api.get('/projects');

export const getProject = (id) => api.get(`/projects/${id}`);

export const createProject = (name, language) =>
  api.post('/projects', { name, language });

export const updateProject = (id, data) =>
  api.put(`/projects/${id}`, data);

export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const joinProjectByRoomId = (roomId) =>
  api.post(`/projects/join/${roomId}`);

export const executeCode = (language, code, stdin = '') =>
  api.post('/projects/execute', { language, code, stdin });

export default api;
