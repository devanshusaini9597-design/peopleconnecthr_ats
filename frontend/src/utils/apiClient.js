/**
 * Unified API client — HttpOnly cookie auth + silent refresh.
 * Prefer this over ad-hoc fetch; authenticatedFetch also supports cookies.
 */
import axios from 'axios';
import { BASE_API_URL } from '../config';

const apiClient = axios.create({
  baseURL: BASE_API_URL,
  timeout: 60000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const orgId = localStorage.getItem('orgId');
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId;
    }
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      config.headers['X-Request-ID'] = crypto.randomUUID();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes('/api/auth/refresh') ||
        originalRequest.url?.includes('/api/login')
      ) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/api/auth/refresh');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized', {
            detail: {
              code: error.response?.data?.code,
              message: error.response?.data?.message,
            },
          })
        );
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

export const api = {
  get: (url, config) => apiClient.get(url, config).then((r) => r.data),
  post: (url, data, config) => apiClient.post(url, data, config).then((r) => r.data),
  put: (url, data, config) => apiClient.put(url, data, config).then((r) => r.data),
  patch: (url, data, config) => apiClient.patch(url, data, config).then((r) => r.data),
  delete: (url, config) => apiClient.delete(url, config).then((r) => r.data),
};
