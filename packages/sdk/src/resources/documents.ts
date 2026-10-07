import { BaseResource } from './base';

export interface DocumentFile {
  filename: string | null;
  mimeType: string;
  base64Encoded: boolean;
  /** The file content, base64 encoded. */
  content: string;
}

/**
 * `/Document` is **undocumented** in the current OpenAPI spec. It holds the
 * files attached to vouchers, referenced by `Voucher.document`.
 */
export class DocumentsResource extends BaseResource {
  /** Downloads the file of a document via `GET /Document/{documentId}/download`. */
  public download(options: { documentId: number }): Promise<DocumentFile> {
    return this.http.request<DocumentFile>({
      method: 'GET',
      path: `/Document/${options.documentId}/download`,
    });
  }
}
