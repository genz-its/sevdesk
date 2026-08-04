import { SevDeskError } from '../errors';
import type { ListOptions, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/** The document types a tag can be attached to. */
export type TagObjectType = 'Invoice' | 'Voucher' | 'Order' | 'CreditNote';

export interface ListTagsOptions extends ListOptions {
  name?: string;
}

export interface CreateTagOptions {
  name: string;
  /** The document the tag is attached to. */
  objectId: number;
  objectName: TagObjectType;
}

export interface Tag {
  id: string;
  objectName: string;
  create: string;
  name: string;
  sevClient: ModelRefResponse;
}

/** The link between a tag and the document it is attached to. */
export interface TagRelation {
  id: string;
  objectName: string;
  create: string;
  tag: ModelRefResponse;
  object: ModelRefResponse;
  sevClient: ModelRefResponse;
}

export class TagsResource extends BaseResource {
  /** Retrieves tags via `GET /Tag`. */
  public list(options: ListTagsOptions = {}): Promise<Tag[]> {
    const { name, limit, offset } = options;
    return this.http.request<Tag[]>({
      method: 'GET',
      path: '/Tag',
      query: { name, limit, offset },
    });
  }

  /** Retrieves a single tag via `GET /Tag/{tagId}`. */
  public async get(options: { tagId: number }): Promise<Tag> {
    const tags = await this.http.request<Tag[]>({
      method: 'GET',
      path: `/Tag/${options.tagId}`,
    });
    const tag = tags[0];
    if (!tag) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return tag;
  }

  /**
   * Creates a tag and attaches it to a document via `POST /Tag/Factory/create`.
   * Returns the created tag relation.
   */
  public create(options: CreateTagOptions): Promise<TagRelation> {
    const { name, objectId, objectName } = options;
    return this.http.request<TagRelation>({
      method: 'POST',
      path: '/Tag/Factory/create',
      body: { name, object: { id: objectId, objectName } },
    });
  }

  /** Renames a tag via `PUT /Tag/{tagId}`. */
  public update(options: { tagId: number; name: string }): Promise<Tag> {
    return this.http.request<Tag>({
      method: 'PUT',
      path: `/Tag/${options.tagId}`,
      body: { name: options.name },
    });
  }

  /** Deletes a tag via `DELETE /Tag/{tagId}`. */
  public async delete(options: { tagId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/Tag/${options.tagId}`,
    });
  }

  /** Retrieves tag relations via `GET /TagRelation`. */
  public listRelations(options: ListOptions = {}): Promise<TagRelation[]> {
    return this.http.request<TagRelation[]>({
      method: 'GET',
      path: '/TagRelation',
      query: { limit: options.limit, offset: options.offset },
    });
  }
}
