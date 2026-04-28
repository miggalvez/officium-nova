export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function result(errors: string[]): ValidationResult {
  return {
    ok: errors.length === 0,
    errors
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function enumIncludes<const T extends readonly string[]>(
  allowed: T,
  value: unknown
): value is T[number] {
  return isString(value) && allowed.includes(value);
}
