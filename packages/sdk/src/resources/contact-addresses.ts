import { SevDeskError } from '../errors';
import type { ListOptions, ModelRef, ModelRefResponse } from '../types';
import { BaseResource } from './base';

export interface CreateContactAddressOptions {
  /** The contact this address belongs to. */
  contactId: number;
  /** The country of the address. For all countries, send a `GET` to `/StaticCountry`. */
  countryId: number;
  /**
   * The category of the address. For all categories, send a `GET` to
   * `/Category?objectType=ContactAddress`.
   */
  categoryId: number;
  street?: string;
  zip?: string;
  city?: string;
  /** Name in the address. */
  name?: string;
  /** Second name in the address. */
  name2?: string;
  /** Third name in the address. */
  name3?: string;
  /** Fourth name in the address. */
  name4?: string;
}

export interface UpdateContactAddressOptions extends Partial<CreateContactAddressOptions> {
  contactAddressId: number;
}

export interface ContactAddress {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  contact: ModelRefResponse;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: ModelRefResponse;
  category: ModelRefResponse | null;
  name: string | null;
  name2: string | null;
  name3: string | null;
  name4: string | null;
}

export class ContactAddressesResource extends BaseResource {
  /** Retrieves contact addresses via `GET /ContactAddress`. */
  public list(options: ListOptions = {}): Promise<ContactAddress[]> {
    return this.http.request<ContactAddress[]>({
      method: 'GET',
      path: '/ContactAddress',
      query: { limit: options.limit, offset: options.offset },
    });
  }

  /** Retrieves a single contact address via `GET /ContactAddress/{contactAddressId}`. */
  public async get(options: {
    contactAddressId: number;
  }): Promise<ContactAddress> {
    const addresses = await this.http.request<ContactAddress[]>({
      method: 'GET',
      path: `/ContactAddress/${options.contactAddressId}`,
    });
    const address = addresses[0];
    if (!address) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return address;
  }

  /** Creates a contact address via `POST /ContactAddress`. */
  public create(options: CreateContactAddressOptions): Promise<ContactAddress> {
    return this.http.request<ContactAddress>({
      method: 'POST',
      path: '/ContactAddress',
      body: toContactAddressBody(options),
    });
  }

  /** Updates a contact address via `PUT /ContactAddress/{contactAddressId}`. */
  public update(options: UpdateContactAddressOptions): Promise<ContactAddress> {
    const { contactAddressId, ...fields } = options;
    return this.http.request<ContactAddress>({
      method: 'PUT',
      path: `/ContactAddress/${contactAddressId}`,
      body: toContactAddressBody(fields),
    });
  }

  /** Deletes a contact address via `DELETE /ContactAddress/{contactAddressId}`. */
  public async delete(options: { contactAddressId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/ContactAddress/${options.contactAddressId}`,
    });
  }
}

function toContactAddressBody(
  fields: Partial<CreateContactAddressOptions>,
): Record<string, unknown> {
  return {
    objectName: 'ContactAddress',
    mapAll: true,
    contact: toRef(fields.contactId, 'Contact'),
    country: toRef(fields.countryId, 'StaticCountry'),
    category: toRef(fields.categoryId, 'Category'),
    street: fields.street,
    zip: fields.zip,
    city: fields.city,
    name: fields.name,
    name2: fields.name2,
    name3: fields.name3,
    name4: fields.name4,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}
