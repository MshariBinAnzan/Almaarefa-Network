import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../../../shared/types/index.js';

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalCount: number
): PaginationMeta {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

  return {
    page: safePage,
    limit: safeLimit,
    totalCount,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message?: string
): Response {
  return sendSuccess(res, data, 201, message);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  totalCount: number
): Response {
  const payload: ApiResponse<T[]> = {
    success: true,
    data,
    meta: buildPaginationMeta(page, limit, totalCount),
  };
  return res.status(200).json(payload);
}

export function parsePaginationParams(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

