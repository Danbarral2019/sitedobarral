/**
 * URL State Management Utilities
 *
 * Helper functions for managing application state via URL searchParams.
 * Part of the Hybrid Server Component refactoring strategy (Fase 7).
 *
 * @see FASE_7_PLANO.md
 */

import { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * Build a new URLSearchParams string by updating specific keys
 *
 * @param current - Current searchParams from useSearchParams()
 * @param updates - Object with keys to update (null/undefined/'' deletes the param)
 * @returns Query string (without leading '?')
 *
 * @example
 * ```typescript
 * const query = buildSearchParams(searchParams, {
 *   filter: 'active',
 *   page: null  // Removes 'page' param
 * });
 * router.replace(`${pathname}?${query}`);
 * ```
 */
export function buildSearchParams(
  current: ReadonlyURLSearchParams,
  updates: Record<string, string | number | boolean | null | undefined>
): string {
  const params = new URLSearchParams(current.toString());

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  });

  const result = params.toString();
  return result;
}

/**
 * Get a string parameter from searchParams with optional default
 *
 * @param searchParams - ReadonlyURLSearchParams from page props or useSearchParams()
 * @param key - Parameter key
 * @param defaultValue - Default value if param is not present
 * @returns String value
 *
 * @example
 * ```typescript
 * const filter = getSearchParam(searchParams, 'filter', 'all');
 * ```
 */
export function getSearchParam(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  key: string,
  defaultValue: string = ''
): string {
  return searchParams.get(key) || defaultValue;
}

/**
 * Get a number parameter from searchParams with optional default
 *
 * @param searchParams - ReadonlyURLSearchParams from page props or useSearchParams()
 * @param key - Parameter key
 * @param defaultValue - Default value if param is not present or invalid
 * @returns Number value
 *
 * @example
 * ```typescript
 * const page = getNumberParam(searchParams, 'page', 1);
 * const limit = getNumberParam(searchParams, 'limit', 50);
 * ```
 */
export function getNumberParam(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  key: string,
  defaultValue: number = 1
): number {
  const value = searchParams.get(key);
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a boolean parameter from searchParams with optional default
 * Treats 'true', '1', 'yes' as true, everything else as false
 *
 * @param searchParams - ReadonlyURLSearchParams from page props or useSearchParams()
 * @param key - Parameter key
 * @param defaultValue - Default value if param is not present
 * @returns Boolean value
 *
 * @example
 * ```typescript
 * const showArchived = getBooleanParam(searchParams, 'archived', false);
 * ```
 */
export function getBooleanParam(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  key: string,
  defaultValue: boolean = false
): boolean {
  const value = searchParams.get(key);
  if (!value) return defaultValue;

  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Get an array parameter from searchParams (comma-separated values)
 *
 * @param searchParams - ReadonlyURLSearchParams from page props or useSearchParams()
 * @param key - Parameter key
 * @param defaultValue - Default value if param is not present
 * @returns Array of strings
 *
 * @example
 * ```typescript
 * // URL: ?tags=javascript,typescript,react
 * const tags = getArrayParam(searchParams, 'tags', []);
 * // Result: ['javascript', 'typescript', 'react']
 * ```
 */
export function getArrayParam(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  key: string,
  defaultValue: string[] = []
): string[] {
  const value = searchParams.get(key);
  if (!value) return defaultValue;

  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Create a URL-safe query string from an object
 * Similar to buildSearchParams but doesn't merge with existing params
 *
 * @param params - Object with key-value pairs
 * @returns Query string (without leading '?')
 *
 * @example
 * ```typescript
 * const query = createQueryString({ page: 2, filter: 'active' });
 * // Result: 'page=2&filter=active'
 * ```
 */
export function createQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Parse all searchParams into a typed object
 * Useful for server components that need to pass all filters to data fetching
 *
 * @param searchParams - ReadonlyURLSearchParams from page props
 * @returns Object with all params
 *
 * @example
 * ```typescript
 * // In server component:
 * export default async function UsersPage({ searchParams }) {
 *   const filters = parseAllSearchParams(searchParams);
 *   const users = await fetchUsers(filters);
 *   // ...
 * }
 * ```
 */
export function parseAllSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): Record<string, string> {
  const result: Record<string, string> = {};

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = Array.isArray(value) ? value[0] : value;
    }
  });

  return result;
}
