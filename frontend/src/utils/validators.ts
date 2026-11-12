import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiErrorDetail } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ALMAAREFA_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@mcst\.edu\.sa$/i;

export function validateUniversityEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'University email is required.';
  }
  if (!ALMAAREFA_EMAIL_REGEX.test(trimmed)) {
    return 'Email must belong to the official @mcst.edu.sa domain.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  return null;
}

export function validateStudentId(studentId: string): string | null {
  const trimmed = studentId.trim();
  if (!trimmed) {
    return 'Student ID is required.';
  }
  if (!/^\d{7,10}$/.test(trimmed)) {
    return 'Student ID must be 7 to 10 digits (e.g., 202110234).';
  }
  return null;
}

export function extractFieldErrors(details?: ApiErrorDetail[]): Record<string, string> {
  if (!details || !Array.isArray(details)) return {};
  return details.reduce<Record<string, string>>((acc, item) => {
    if (item.field && item.issue) {
      acc[item.field] = item.issue;
    }
    return acc;
  }, {});
}

