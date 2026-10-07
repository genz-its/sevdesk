import { describe, expect, it } from 'vitest';
import { DocumentsResource } from '../src/resources/documents';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): DocumentsResource {
  return new DocumentsResource(createHttpClient(fetch));
}

describe('DocumentsResource.download', () => {
  it('returns the unwrapped file', async () => {
    const fetch = createMockFetch({
      objects: {
        filename: 'receipt.pdf',
        mimeType: 'application/pdf',
        base64Encoded: true,
        content: 'JVBERi0xLjQ=',
      },
    });

    const file = await createResource(fetch).download({ documentId: 7 });

    expect(file.filename).toBe('receipt.pdf');
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Document/7/download`);
    expect(init.method).toBe('GET');
  });
});
