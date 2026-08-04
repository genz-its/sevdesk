import { SevDeskError } from '../errors';
import type { ListOptions, ModelRef, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/** `50` for an inactive and `100` for an active part. */
export type PartStatus = 50 | 100;

export interface ListPartsOptions extends ListOptions {
  partNumber?: string;
  name?: string;
  embed?: string[];
}

export interface CreatePartOptions {
  name: string;
  partNumber: string;
  /** The unit in which the part is measured. `1` is the "piece" unit. */
  unityId: number;
  /** In sevdesk-Update 2.0 only `0`, `7` and `19` are allowed. */
  taxRate: number;
  stock: number;
  /** A text describing the part. */
  text?: string;
  /** Send a `GET /Category?objectType=Part` for all available categories. */
  categoryId?: number;
  stockEnabled?: boolean;
  /**
   * Net price for which the part is sold. sevdesk will change this parameter
   * so that the gross price is calculated automatically, until then
   * `priceGross` must be used.
   */
  price?: number;
  priceNet?: number;
  priceGross?: number;
  pricePurchase?: number;
  status?: PartStatus;
  /** An internal comment which does not appear on invoices and orders. */
  internalComment?: string;
}

export interface UpdatePartOptions extends Partial<CreatePartOptions> {
  partId: number;
}

export interface Part {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  name: string;
  partNumber: string;
  text: string | null;
  category: ModelRefResponse | null;
  stock: string;
  stockEnabled: string;
  unity: ModelRefResponse;
  price: string | null;
  priceNet: string | null;
  priceGross: string | null;
  pricePurchase: string | null;
  taxRate: string;
  status: string | null;
  internalComment: string | null;
}

export class PartsResource extends BaseResource {
  /** Retrieves parts via `GET /Part`. */
  public list(options: ListPartsOptions = {}): Promise<Part[]> {
    const { partNumber, name, limit, offset, embed } = options;
    return this.http.request<Part[]>({
      method: 'GET',
      path: '/Part',
      query: { partNumber, name, limit, offset, embed },
    });
  }

  /** Retrieves a single part via `GET /Part/{partId}`. */
  public async get(options: { partId: number }): Promise<Part> {
    const parts = await this.http.request<Part[]>({
      method: 'GET',
      path: `/Part/${options.partId}`,
    });
    const part = parts[0];
    if (!part) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return part;
  }

  /** Creates a part via `POST /Part`. */
  public create(options: CreatePartOptions): Promise<Part> {
    return this.http.request<Part>({
      method: 'POST',
      path: '/Part',
      body: toPartBody(options),
    });
  }

  /** Updates a part via `PUT /Part/{partId}`. */
  public update(options: UpdatePartOptions): Promise<Part> {
    const { partId, ...fields } = options;
    return this.http.request<Part>({
      method: 'PUT',
      path: `/Part/${partId}`,
      body: toPartBody(fields),
    });
  }

  /** Retrieves the current stock amount of a part via `GET /Part/{partId}/getStock`. */
  public getStock(options: { partId: number }): Promise<number> {
    return this.http.request<number>({
      method: 'GET',
      path: `/Part/${options.partId}/getStock`,
    });
  }
}

function toPartBody(
  fields: Partial<CreatePartOptions>,
): Record<string, unknown> {
  return {
    objectName: 'Part',
    mapAll: true,
    name: fields.name,
    partNumber: fields.partNumber,
    unity: toRef(fields.unityId, 'Unity'),
    taxRate: fields.taxRate,
    stock: fields.stock,
    text: fields.text,
    category: toRef(fields.categoryId, 'Category'),
    stockEnabled: fields.stockEnabled,
    price: fields.price,
    priceNet: fields.priceNet,
    priceGross: fields.priceGross,
    pricePurchase: fields.pricePurchase,
    status: fields.status,
    internalComment: fields.internalComment,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}
