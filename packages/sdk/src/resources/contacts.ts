import { SevDeskError } from '../errors';
import type { ListOptions, ModelRef, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/** `100` for a lead, `500` for a pending and `1000` for an active contact. */
export type ContactStatus = 100 | 500 | 1000;

export interface ListContactsOptions extends ListOptions {
  /**
   * `'0'` returns only organizations, `'1'` organizations and persons.
   * Defaults to `'0'`.
   */
  depth?: '0' | '1';
  customerNumber?: string;
  /** Matches the `name`, `surename` or `familyname` of a contact. */
  name?: string;
  categoryId?: number;
  /** Only returns contacts belonging to this organization. */
  parentId?: number;
  embed?: string[];
}

export interface CreateContactOptions {
  /**
   * The category of the contact. The sevdesk default categories are `2` for a
   * supplier, `3` for a customer, `4` for a partner and `28` for a prospect
   * customer.
   */
  categoryId: number;
  /**
   * The organization name. A contact holding a name is regarded as an
   * organization, one holding a `surename` or `familyname` as a person.
   */
  name?: string;
  /** The **first** name of a person. Not to be used for organizations. */
  surename?: string;
  /** The last name of a person. Not to be used for organizations. */
  familyname?: string;
  /** The middle name or name suffix of a person. */
  name2?: string;
  /** A non-academic title, e.g. the position the person holds. */
  titel?: string;
  academicTitle?: string;
  gender?: string;
  /** The organization this person belongs to. */
  parentId?: number;
  customerNumber?: string;
  status?: ContactStatus;
  description?: string;
  vatNumber?: string;
  taxNumber?: string;
  /** Defines if the contact is freed from paying vat. */
  exemptVat?: boolean;
  /** Bank account number (IBAN) of the contact. */
  bankAccount?: string;
  bankNumber?: string;
  /** The payment goal in days which is set for every invoice of the contact. */
  defaultTimeToPay?: number;
  /** Buyer reference of the contact, required for e-invoices. */
  buyerReference?: string;
  governmentAgency?: boolean;
}

export interface UpdateContactOptions extends Partial<CreateContactOptions> {
  contactId: number;
}

export interface FindContactsByCustomFieldValueOptions {
  /** The value to be checked. */
  value: string;
  /** The name of the contact custom field setting. */
  customFieldName: string;
  /** Restricts the lookup to a single contact custom field setting. */
  customFieldSettingId?: number;
}

export interface Contact {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  name: string | null;
  status: string | null;
  customerNumber: string | null;
  parent: ModelRefResponse | null;
  surename: string | null;
  familyname: string | null;
  titel: string | null;
  category: ModelRefResponse;
  description: string | null;
  academicTitle: string | null;
  gender: string | null;
  name2: string | null;
  birthday: string | null;
  vatNumber: string | null;
  bankAccount: string | null;
  bankNumber: string | null;
  defaultCashbackTime: string | null;
  defaultCashbackPercent: string | null;
  defaultTimeToPay: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  exemptVat: string | null;
  defaultDiscountAmount: string | null;
  defaultDiscountPercentage: string | null;
  buyerReference: string | null;
  governmentAgency: string | null;
}

/** Number of documents of a contact, grouped by document type. */
export interface ContactTabsItemCount {
  orders: number;
  invoices: number;
  creditNotes: number;
  documents: number;
  persons: number;
  vouchers: number;
  letters: number;
  parts: string;
  invoicePos: number;
}

export class ContactsResource extends BaseResource {
  /** Retrieves contacts via `GET /Contact`. */
  public list(options: ListContactsOptions = {}): Promise<Contact[]> {
    const {
      depth,
      customerNumber,
      name,
      categoryId,
      parentId,
      limit,
      offset,
      embed,
    } = options;
    return this.http.request<Contact[]>({
      method: 'GET',
      path: '/Contact',
      query: {
        depth,
        customerNumber,
        name,
        'category[id]': categoryId,
        'category[objectName]':
          categoryId === undefined ? undefined : 'Category',
        'parent[id]': parentId,
        'parent[objectName]': parentId === undefined ? undefined : 'Contact',
        limit,
        offset,
        embed,
      },
    });
  }

  /** Retrieves a single contact via `GET /Contact/{contactId}`. */
  public async get(options: { contactId: number }): Promise<Contact> {
    const contacts = await this.http.request<Contact[]>({
      method: 'GET',
      path: `/Contact/${options.contactId}`,
    });
    const contact = contacts[0];
    if (!contact) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return contact;
  }

  /** Creates a contact via `POST /Contact`. */
  public create(options: CreateContactOptions): Promise<Contact> {
    return this.http.request<Contact>({
      method: 'POST',
      path: '/Contact',
      body: toContactBody(options),
    });
  }

  /** Updates a contact via `PUT /Contact/{contactId}`. */
  public update(options: UpdateContactOptions): Promise<Contact> {
    const { contactId, ...fields } = options;
    return this.http.request<Contact>({
      method: 'PUT',
      path: `/Contact/${contactId}`,
      body: toContactBody(fields),
    });
  }

  /** Deletes a contact via `DELETE /Contact/{contactId}`. */
  public async delete(options: { contactId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/Contact/${options.contactId}`,
    });
  }

  /** Retrieves the next free customer number via `GET /Contact/Factory/getNextCustomerNumber`. */
  public getNextCustomerNumber(): Promise<string> {
    return this.http.request<string>({
      method: 'GET',
      path: '/Contact/Factory/getNextCustomerNumber',
    });
  }

  /** Retrieves contacts by a custom field value via `GET /Contact/Factory/findContactsByCustomFieldValue`. */
  public findByCustomFieldValue(
    options: FindContactsByCustomFieldValueOptions,
  ): Promise<Contact[]> {
    const { value, customFieldName, customFieldSettingId } = options;
    return this.http.request<Contact[]>({
      method: 'GET',
      path: '/Contact/Factory/findContactsByCustomFieldValue',
      query: {
        value,
        customFieldName,
        'customFieldSetting[id]': customFieldSettingId,
        'customFieldSetting[objectName]':
          customFieldSettingId === undefined
            ? undefined
            : 'ContactCustomFieldSetting',
      },
    });
  }

  /** Checks if a customer number is still free via `GET /Contact/Mapper/checkCustomerNumberAvailability`. */
  public checkCustomerNumberAvailability(options: {
    customerNumber: string;
  }): Promise<boolean> {
    return this.http.request<boolean>({
      method: 'GET',
      path: '/Contact/Mapper/checkCustomerNumberAvailability',
      query: { customerNumber: options.customerNumber },
    });
  }

  /** Retrieves the document counts of a contact via `GET /Contact/{contactId}/getTabsItemCount`. */
  public getTabsItemCount(options: {
    contactId: number;
  }): Promise<ContactTabsItemCount> {
    return this.http.request<ContactTabsItemCount>({
      method: 'GET',
      path: `/Contact/${options.contactId}/getTabsItemCount`,
    });
  }
}

function toContactBody(
  fields: Partial<CreateContactOptions>,
): Record<string, unknown> {
  return {
    objectName: 'Contact',
    mapAll: true,
    category: toRef(fields.categoryId, 'Category'),
    parent: toRef(fields.parentId, 'Contact'),
    name: fields.name,
    surename: fields.surename,
    familyname: fields.familyname,
    name2: fields.name2,
    titel: fields.titel,
    academicTitle: fields.academicTitle,
    gender: fields.gender,
    customerNumber: fields.customerNumber,
    status: fields.status,
    description: fields.description,
    vatNumber: fields.vatNumber,
    taxNumber: fields.taxNumber,
    exemptVat: fields.exemptVat,
    bankAccount: fields.bankAccount,
    bankNumber: fields.bankNumber,
    defaultTimeToPay: fields.defaultTimeToPay,
    buyerReference: fields.buyerReference,
    governmentAgency: fields.governmentAgency,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}
