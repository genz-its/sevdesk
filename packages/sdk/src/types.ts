/**
 * Accepted date representations for request options. Numbers are interpreted
 * as Unix timestamps in seconds, strings are passed through unchanged.
 */
export type DateInput = Date | string | number;

export interface ListOptions {
  limit?: number;
  offset?: number;
}

/** Reference to a related object in request bodies. */
export interface ModelRef {
  id: number;
  objectName: string;
}

/**
 * Reference to a related object in responses. The sevdesk API returns all
 * scalar values in responses as strings, including ids.
 */
export interface ModelRefResponse {
  id: string;
  objectName: string;
}
