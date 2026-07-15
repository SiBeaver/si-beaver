/**
 * Key transformation utilities for API layer.
 * DB/operations use snake_case internally; REST API exposes camelCase.
 */

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
}

export function snakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamelKey(key)] = snakeToCamel(value);
    }
    return result;
  }
  return obj;
}

export function camelToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[camelToSnakeKey(key)] = camelToSnake(value);
    }
    return result;
  }
  return obj;
}

export function snakeToKebab(s: string): string {
  return s.replace(/_/g, '-');
}

export function kebabToSnake(s: string): string {
  return s.replace(/-/g, '_');
}
