export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
  };
}

export function parsePagination(query: PaginationQuery, maxLimit = 100) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(maxLimit, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;
  const sortOrder = query.sortOrder ?? 'desc';
  return { page, limit, skip, sortOrder, sortBy: query.sortBy, cursor: query.cursor };
}
