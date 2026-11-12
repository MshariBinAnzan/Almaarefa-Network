import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse, ApiResponse } from '@/types';

export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'almaarefa_access_token',
  REFRESH_TOKEN: 'almaarefa_refresh_token',
  USER: 'almaarefa_user',
} as const;

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach JWT Bearer token to every outgoing request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Automatically refresh accessToken on 401 Unauthorized per Section 7 of Integration Plan
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      typeof window !== 'undefined'
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);

      if (refreshToken) {
        try {
          const res = await axios.post<ApiResponse<{ accessToken: string; expiresIn: number }>>(
            `${apiClient.defaults.baseURL}/auth/refresh-token`,
            { refreshToken }
          );
          const newAccessToken = res.data.data.accessToken;
          localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return apiClient(originalRequest);
        } catch {
          localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(TOKEN_STORAGE_KEYS.USER);
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

