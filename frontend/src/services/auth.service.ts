import { AxiosError } from 'axios';
import {
  ApiErrorResponse,
  ApiResponse,
  AuthUser,
  Department,
  LoginRequest,
  LoginResponseData,
  RegisterRequest,
  RegisterResponseData,
} from '@/types';
import { MOCK_DEPARTMENTS, MOCK_USERS } from '@/mocks/data';
import { apiClient, TOKEN_STORAGE_KEYS } from './apiClient';
import { validateUniversityEmail } from '@/utils/validators';

export const isMockMode = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
};

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes the user object returned by `/auth/login` or `/auth/me`
 * so `universityEmail` is always populated even if backend sends `email`.
 */
function normalizeAuthUser(rawUser: AuthUser): AuthUser {
  return {
    ...rawUser,
    universityEmail: rawUser.universityEmail || rawUser.email || '',
  };
}

export const authService = {
  /**
   * POST /api/v1/auth/login
   */
  async login(payload: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
    if (isMockMode()) {
      await delay(400);
      const emailErr = validateUniversityEmail(payload.universityEmail);
      if (emailErr) {
        const err: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid university email format or credentials.',
            details: [{ field: 'universityEmail', issue: emailErr }],
          },
        };
        throw err;
      }

      const emailLower = payload.universityEmail.trim().toLowerCase();
      let matchedUser: AuthUser = MOCK_USERS.studentVerified;

      if (emailLower.includes('admin')) {
        matchedUser = MOCK_USERS.admin;
      } else if (emailLower.includes('leader')) {
        matchedUser = MOCK_USERS.clubLeader;
      } else if (emailLower.includes('new')) {
        matchedUser = MOCK_USERS.studentUnverified;
      } else {
        matchedUser = {
          ...MOCK_USERS.studentVerified,
          universityEmail: emailLower,
        };
      }

      return {
        success: true,
        data: {
          accessToken: 'mock-jwt-access-token-' + Date.now(),
          refreshToken: 'mock-jwt-refresh-token-' + Date.now(),
          expiresIn: 3600,
          user: matchedUser,
        },
      };
    }

    try {
      const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', payload);
      response.data.data.user = normalizeAuthUser(response.data.data.user);
      return response.data;
    } catch (err) {
      throw normalizeAxiosError(err);
    }
  },

  /**
   * POST /api/v1/auth/register
   */
  async register(payload: RegisterRequest): Promise<ApiResponse<RegisterResponseData>> {
    if (isMockMode()) {
      await delay(500);
      const emailErr = validateUniversityEmail(payload.universityEmail);
      if (emailErr) {
        const err: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid registration details.',
            details: [{ field: 'universityEmail', issue: emailErr }],
          },
        };
        throw err;
      }

      const username = payload.universityEmail.split('@')[0].toLowerCase();
      return {
        success: true,
        data: {
          userId: 'new-user-' + Date.now(),
          universityEmail: payload.universityEmail.trim().toLowerCase(),
          role: 'STUDENT',
          emailVerified: false,
          isVerified: false,
          profile: {
            fullName: payload.fullName.trim(),
            studentId: payload.studentId.trim(),
            username,
          },
        },
      };
    }

    try {
      const response = await apiClient.post<ApiResponse<RegisterResponseData>>(
        '/auth/register',
        payload
      );
      return response.data;
    } catch (err) {
      throw normalizeAxiosError(err);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(): Promise<ApiResponse<AuthUser>> {
    if (isMockMode()) {
      await delay(200);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
        if (cached) {
          return {
            success: true,
            data: JSON.parse(cached) as AuthUser,
          };
        }
      }
      return {
        success: true,
        data: MOCK_USERS.studentVerified,
      };
    }

    try {
      const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
      response.data.data = normalizeAuthUser(response.data.data);
      return response.data;
    } catch (err) {
      throw normalizeAxiosError(err);
    }
  },

  /**
   * GET /api/v1/departments
   */
  async getDepartments(): Promise<ApiResponse<Department[]>> {
    if (isMockMode()) {
      await delay(150);
      return {
        success: true,
        data: MOCK_DEPARTMENTS,
      };
    }

    try {
      const response = await apiClient.get<ApiResponse<Department[]>>('/departments');
      return response.data;
    } catch (err) {
      throw normalizeAxiosError(err);
    }
  },
};

function normalizeAxiosError(err: unknown): ApiErrorResponse {
  if (err && typeof err === 'object' && 'success' in err && (err as ApiErrorResponse).success === false) {
    return err as ApiErrorResponse;
  }

  const axiosErr = err as AxiosError<ApiErrorResponse>;
  if (axiosErr.response?.data?.error) {
    return axiosErr.response.data;
  }

  return {
    success: false,
    error: {
      code: 'NETWORK_ERROR',
      message:
        axiosErr.message ||
        'Unable to reach the Almaarefa Network server. Check your connection or enable Mock Mode.',
    },
  };
}

