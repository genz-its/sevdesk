import type { DateInput } from './types';

/**
 * Serializes a date for voucher endpoints, which accept a Unix timestamp
 * or a `dd.mm.yyyy` string.
 */
export function toVoucherDate(value: DateInput): string | number {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  return value;
}

/** Serializes a date as ISO 8601, as expected by transaction endpoints. */
export function toIsoDateTime(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }
  return value;
}

/** Serializes a date as `YYYY-MM-DD`. */
export function toPlainDate(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }
  return value;
}
