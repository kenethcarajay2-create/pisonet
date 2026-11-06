
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('pisonet_admin_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login')
    ) {
      sessionStorage.removeItem('pisonet_admin_token');
      window.location.assign('/login');
    }

    return Promise.reject(error);
  }
);

export function errorMessage(error) {
  return (
    error.response?.data?.error ||
    error.message ||
    'Something went wrong'
  );
}
