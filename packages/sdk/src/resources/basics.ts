import { BaseResource } from './base';

export type BookkeepingSystemVersion = '1.0' | '2.0';

export class BasicsResource extends BaseResource {
  /** Retrieves the bookkeeping system version via `GET /Tools/bookkeepingSystemVersion`. */
  public async getBookkeepingSystemVersion(): Promise<BookkeepingSystemVersion> {
    const result = await this.http.request<{
      version: BookkeepingSystemVersion;
    }>({
      method: 'GET',
      path: '/Tools/bookkeepingSystemVersion',
    });
    return result.version;
  }
}
