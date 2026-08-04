import { SevDeskError } from '../errors';
import type { ListOptions, ModelRef, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/** The medium of a communication way. */
export type CommunicationWayType = 'EMAIL' | 'PHONE' | 'WEB' | 'MOBILE';

export interface ListCommunicationWaysOptions extends ListOptions {
  /** Only returns the communication ways of this contact. */
  contactId?: number;
  type?: CommunicationWayType;
  /** `'1'` returns only the main communication ways. */
  main?: '0' | '1';
}

export interface CreateCommunicationWayOptions {
  /** The contact this communication way belongs to. */
  contactId: number;
  type: CommunicationWayType;
  /** The phone number, e-mail address or website. */
  value: string;
  /**
   * The key of the communication way, e.g. `1` for private and `2` for work.
   * For all keys, send a `GET` to `/CommunicationWayKey`.
   */
  keyId: number;
  /** Defines if this is the main communication way of the contact. */
  main?: boolean;
}

export interface UpdateCommunicationWayOptions extends Partial<CreateCommunicationWayOptions> {
  communicationWayId: number;
}

export interface CommunicationWay {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  contact: ModelRefResponse;
  type: string;
  value: string;
  key: ModelRefResponse;
  main: string;
}

/** The key of a communication way, similar to the category of an address. */
export interface CommunicationWayKey {
  id: string;
  objectName: string;
  create: string;
  update: string;
  name: string;
  translationCode: string;
}

export class CommunicationWaysResource extends BaseResource {
  /** Retrieves communication ways via `GET /CommunicationWay`. */
  public list(
    options: ListCommunicationWaysOptions = {},
  ): Promise<CommunicationWay[]> {
    const { contactId, type, main, limit, offset } = options;
    return this.http.request<CommunicationWay[]>({
      method: 'GET',
      path: '/CommunicationWay',
      query: {
        'contact[id]': contactId,
        'contact[objectName]': contactId === undefined ? undefined : 'Contact',
        type,
        main,
        limit,
        offset,
      },
    });
  }

  /** Retrieves a single communication way via `GET /CommunicationWay/{communicationWayId}`. */
  public async get(options: {
    communicationWayId: number;
  }): Promise<CommunicationWay> {
    const communicationWays = await this.http.request<CommunicationWay[]>({
      method: 'GET',
      path: `/CommunicationWay/${options.communicationWayId}`,
    });
    const communicationWay = communicationWays[0];
    if (!communicationWay) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return communicationWay;
  }

  /** Creates a communication way via `POST /CommunicationWay`. */
  public create(
    options: CreateCommunicationWayOptions,
  ): Promise<CommunicationWay> {
    return this.http.request<CommunicationWay>({
      method: 'POST',
      path: '/CommunicationWay',
      body: toCommunicationWayBody(options),
    });
  }

  /** Updates a communication way via `PUT /CommunicationWay/{communicationWayId}`. */
  public update(
    options: UpdateCommunicationWayOptions,
  ): Promise<CommunicationWay> {
    const { communicationWayId, ...fields } = options;
    return this.http.request<CommunicationWay>({
      method: 'PUT',
      path: `/CommunicationWay/${communicationWayId}`,
      body: toCommunicationWayBody(fields),
    });
  }

  /** Deletes a communication way via `DELETE /CommunicationWay/{communicationWayId}`. */
  public async delete(options: { communicationWayId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/CommunicationWay/${options.communicationWayId}`,
    });
  }

  /** Retrieves all communication way keys via `GET /CommunicationWayKey`. */
  public listKeys(options: ListOptions = {}): Promise<CommunicationWayKey[]> {
    return this.http.request<CommunicationWayKey[]>({
      method: 'GET',
      path: '/CommunicationWayKey',
      query: { limit: options.limit, offset: options.offset },
    });
  }
}

function toCommunicationWayBody(
  fields: Partial<CreateCommunicationWayOptions>,
): Record<string, unknown> {
  return {
    objectName: 'CommunicationWay',
    mapAll: true,
    contact: toRef(fields.contactId, 'Contact'),
    type: fields.type,
    value: fields.value,
    key: toRef(fields.keyId, 'CommunicationWayKey'),
    main: fields.main,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}
