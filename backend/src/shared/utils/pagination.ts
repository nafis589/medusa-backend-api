export interface PaginationResult {
  offset: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Returns offset and sanitised limit from page/limit query params.
 * Page is 1-indexed. Limit capped at 100.
 */
export function getPagination(page: number, limit: number): PaginationResult {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return { offset: (safePage - 1) * safeLimit, limit: safeLimit };
}

/**
 * Builds the pagination metadata block for API responses.
 */
export function getPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return {
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
