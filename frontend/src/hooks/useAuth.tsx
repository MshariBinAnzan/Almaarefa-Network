'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '@/types';
import { authService } from '@/services/auth.service';
import { TOKEN_STORAGE_KEYS } from '@/services/apiClient';
import { MOCK_DEPARTMENTS, MOCK_USERS } from '@/mocks/data';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
  switchMockPersona: (personaKey: keyof typeof MOCK_USERS) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
        const token = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        if (storedUser && token) {
          setUser(JSON.parse(storedUser) as AuthUser);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(TOKEN_STORAGE_KEYS.USER);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (payload: LoginRequest) => {
    const res = await authService.login(payload);
    const { accessToken, refreshToken, user: loggedInUser } = res.data;
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    router.push('/');
  };

  const register = async (payload: RegisterRequest) => {
    const res = await authService.register(payload);
    const department = MOCK_DEPARTMENTS.find((d) => d.departmentId === payload.departmentId);

    const newAuthUser: AuthUser = {
      userId: res.data.userId,
      universityEmail: res.data.universityEmail,
      role: res.data.role,
      emailVerified: res.data.emailVerified,
      isVerified: res.data.isVerified,
      profile: {
        fullName: res.data.profile.fullName,
        studentId: res.data.profile.studentId,
        username: res.data.profile.username,
        departmentId: payload.departmentId,
        departmentName: department?.name || 'Computer Science',
        avatarUrl: null,
      },
    };

    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, 'mock-jwt-refresh-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(newAuthUser));
    setUser(newAuthUser);
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.USER);
    setUser(null);
    router.push('/login');
  };

  const switchMockPersona = (personaKey: keyof typeof MOCK_USERS) => {
    const selected = MOCK_USERS[personaKey];
    if (!selected) return;
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(selected));
    setUser(selected);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchMockPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

