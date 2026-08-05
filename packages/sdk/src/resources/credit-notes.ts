import { toIsoDateTime, toVoucherDate } from '../dates';
import { SevDeskError } from '../errors';
import type {
  DateInput,
  ListOptions,
  ModelRef,
  ModelRefResponse,
} from '../types';
import { BaseResource } from './base';

/**
 * Status of a credit note.
 *
 * - `100` draft
 * - `200` open / delivered
 * - `750` partially paid
 * - `1000` paid
 */
export type CreditNoteStatus = 100 | 200 | 750 | 1000;

/**
 * Reason why the credit note was created. `ACCOUNTING_TYPE` is not supported
 * by bookkeeping system 2.0 and therefore not available.
 */
export type CreditNoteBookingCategory =
  'PROVISION' | 'ROYALTY_ASSIGNED' | 'ROYALTY_UNASSIGNED' | 'UNDERACHIEVEMENT';

/**
 * Way in which a credit note was sent to the end-customer: `VPR` printed,
 * `VP` postal, `VM` mailed, `VPDF` downloaded pdf.
 */
export type CreditNoteSendType = 'VPR' | 'VP' | 'VM' | 'VPDF';

export type CreditNoteBookingType =
  'FULL_PAYMENT' | 'N' | 'CB' | 'O' | 'OF' | 'MTC';

export interface CreditNoteInput {
  creditNoteNumber: string;
  creditNoteDate: DateInput;
  contactId: number;
  status: CreditNoteStatus;
  /** Usually consists of a prefix and the credit note number. */
  header: string;
  bookingCategory: CreditNoteBookingCategory;
  /** The sevdesk user acting as the contact person. */
  contactPersonId: number;
  /** Defines the vat regulation, for example `1` for "Umsatzsteuerpflichtige Umsätze". */
  taxRuleId: number;
  /** Not used anymore, the tax rate of the positions is used instead. */
  taxRate: number;
  /** Text describing the vat regulation, for example `Umsatzsteuer 19%`. */
  taxText: string;
  /** Currency code according to ISO-4217. */
  currency: string;
  deliveryDate: DateInput;
  /** Can be omitted as the complete address is defined in `address`. */
  addressCountryId?: number;
  headText?: string;
  footText?: string;
  /** Complete address of the recipient. Line breaks are kept in the pdf. */
  address?: string;
  smallSettlement?: boolean;
  /** `true` if the position prices are net, `false` if they are gross. */
  showNet?: boolean;
  customerInternalNote?: string;
  sendDate?: DateInput;
  sendType?: CreditNoteSendType;
}

export interface CreditNotePositionInput {
  unityId: number;
  quantity: number;
  taxRate: number;
  name?: string;
  /** Price of one unit. Is either net or gross, depending on `showNet`. */
  price?: number;
  text?: string;
  partId?: number;
  /** Starts at zero and is incremented for every further position. */
  positionNumber?: number;
  discount?: number;
  optional?: boolean;
}

export interface SaveCreditNoteOptions {
  creditNote: CreditNoteInput;
  positions: CreditNotePositionInput[];
}

export interface ListCreditNotesOptions extends ListOptions {
  status?: CreditNoteStatus;
  creditNoteNumber?: string;
  startDate?: DateInput;
  endDate?: DateInput;
  contactId?: number;
  embed?: string[];
}

export interface UpdateCreditNoteOptions {
  creditNoteId: number;
  creditNoteNumber?: string;
  creditNoteDate?: DateInput;
  status?: CreditNoteStatus;
  header?: string;
  headText?: string;
  footText?: string;
  address?: string;
  customerInternalNote?: string;
  deliveryDate?: DateInput;
}

export interface SendCreditNoteViaEmailOptions {
  creditNoteId: number;
  toEmail: string;
  subject: string;
  /** Can contain html. */
  text: string;
  /** Send a copy of the email to yourself. */
  copy?: boolean;
  /** Ids of existing documents in your sevdesk account, separated by `,`. */
  additionalAttachments?: string;
  /** Mail addresses to be put as cc, separated by `,`. */
  ccEmail?: string;
  /** Mail addresses to be put as bcc, separated by `,`. */
  bccEmail?: string;
}

export interface SendCreditNoteByOptions {
  creditNoteId: number;
  sendType: CreditNoteSendType;
  /**
   * Creates a draft for internal use. Neither the status of the credit note
   * nor the bookings for reports are changed.
   */
  sendDraft: boolean;
}

export interface BookCreditNoteOptions {
  creditNoteId: number;
  /**
   * Can also be a partial amount. sevdesk reads this as the amount flowing over
   * the check account and derives the stored `paidAmount` from it. A wrongly
   * signed amount is accepted without an error and leaves the document
   * partially paid, so verify the resulting `paidAmount`.
   */
  amount: number;
  date: DateInput;
  type: CreditNoteBookingType;
  checkAccountId: number;
  /**
   * Required for online check accounts. Must be omitted for offline check
   * accounts and cash registers, where the transaction is created automatically.
   */
  checkAccountTransactionId?: number;
  createFeed?: boolean;
}

export interface ListCreditNotePositionsOptions extends ListOptions {
  creditNoteId?: number;
  embed?: string[];
}

export interface CreditNote {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  createUser: ModelRefResponse;
  creditNoteNumber: string | null;
  contact: ModelRefResponse | null;
  creditNoteDate: string;
  status: string;
  header: string | null;
  headText: string | null;
  footText: string | null;
  addressCountry: ModelRefResponse | null;
  deliveryDate: string;
  smallSettlement: boolean | null;
  contactPerson: ModelRefResponse | null;
  taxRate: string | null;
  taxRule: ModelRefResponse;
  taxText: string | null;
  sendDate: string | null;
  address: string | null;
  currency: string | null;
  sumNet: string;
  sumTax: string;
  sumGross: string;
  sumDiscounts: string;
  sumNetForeignCurrency: string;
  sumTaxForeignCurrency: string;
  sumGrossForeignCurrency: string;
  sumDiscountsForeignCurrency: string;
  customerInternalNote: string | null;
  showNet: boolean;
  sendType: string | null;
}

export interface CreditNotePosition {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  creditNote: ModelRefResponse;
  part: ModelRefResponse | null;
  quantity: string;
  price: string | null;
  priceNet: string | null;
  priceTax: string | null;
  priceGross: string | null;
  name: string | null;
  unity: ModelRefResponse;
  positionNumber: string | null;
  text: string | null;
  discount: string | null;
  optional: boolean | null;
  taxRate: string;
  sumDiscount: string | null;
}

export interface CreditNoteDiscount {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: string;
  /** `1` for a discount, `0` for a surcharge. */
  discount: string;
  text: string;
  /** `1` if `value` is a percentage, `0` if it is an absolute amount. */
  percentage: string;
  value: string;
  /** `0` if the discount is net, `1` if it is gross. */
  isNet: string;
}

export interface CreditNoteMail {
  id: string;
  objectName: string;
  additionalInformation: string | null;
  create: string;
  update: string;
  object: CreditNote;
  from: string;
  to: string;
  subject: string;
  text: string;
  sevClient: ModelRefResponse;
}

export interface CreditNotePdf {
  filename: string;
  mimeType: string;
  base64encoded: boolean;
  /** The pdf document, base64 encoded. */
  content: string;
}

export interface SaveCreditNoteResult {
  creditNote: CreditNote;
  positions: CreditNotePosition[];
}

export interface CreateCreditNoteFromInvoiceResult extends SaveCreditNoteResult {
  discounts: CreditNoteDiscount[];
}

export interface BookCreditNoteResult {
  id: string;
  objectName: string;
  additionalInformation: string | null;
  create: string;
  creditNote: ModelRefResponse;
  fromStatus: string;
  toStatus: string;
  /** Spelled with two `m` by the sevdesk API. */
  ammountPayed: string;
  bookingDate: string;
  sevClient: ModelRefResponse;
}

export class CreditNotesResource extends BaseResource {
  /** Retrieves credit notes via `GET /CreditNote`. */
  public list(options: ListCreditNotesOptions = {}): Promise<CreditNote[]> {
    const {
      status,
      creditNoteNumber,
      startDate,
      endDate,
      contactId,
      limit,
      offset,
      embed,
    } = options;
    return this.http.request<CreditNote[]>({
      method: 'GET',
      path: '/CreditNote',
      query: {
        status,
        creditNoteNumber,
        startDate: toOptionalDate(startDate),
        endDate: toOptionalDate(endDate),
        'contact[id]': contactId,
        'contact[objectName]': contactId === undefined ? undefined : 'Contact',
        limit,
        offset,
        embed,
      },
    });
  }

  /** Retrieves a single credit note via `GET /CreditNote/{creditNoteId}`. */
  public async get(options: {
    creditNoteId: number;
    embed?: string[];
  }): Promise<CreditNote> {
    const creditNotes = await this.http.request<CreditNote[]>({
      method: 'GET',
      path: `/CreditNote/${options.creditNoteId}`,
      query: { embed: options.embed },
    });
    const creditNote = creditNotes[0];
    if (!creditNote) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return creditNote;
  }

  /** Creates or updates a credit note with its positions via `POST /CreditNote/Factory/saveCreditNote`. */
  public async save(
    options: SaveCreditNoteOptions,
  ): Promise<SaveCreditNoteResult> {
    const { creditNote, positions } = options;
    const result = await this.http.request<{
      creditNote: CreditNote;
      creditNotePos: CreditNotePosition[];
    }>({
      method: 'POST',
      path: '/CreditNote/Factory/saveCreditNote',
      body: {
        creditNote: toCreditNoteBody(creditNote),
        creditNotePosSave: positions.map(toCreditNotePositionBody),
        creditNotePosDelete: null,
        discountSave: null,
        discountDelete: null,
      },
    });
    return {
      creditNote: result.creditNote,
      positions: result.creditNotePos,
    };
  }

  /** Creates a credit note from an invoice via `POST /CreditNote/Factory/createFromInvoice`. */
  public async createFromInvoice(options: {
    invoiceId: number;
  }): Promise<CreateCreditNoteFromInvoiceResult> {
    const result = await this.http.request<{
      creditNote: CreditNote;
      creditNotePos: CreditNotePosition[];
      discount: CreditNoteDiscount[];
    }>({
      method: 'POST',
      path: '/CreditNote/Factory/createFromInvoice',
      body: { invoice: { id: options.invoiceId, objectName: 'Invoice' } },
    });
    return {
      creditNote: result.creditNote,
      positions: result.creditNotePos,
      discounts: result.discount,
    };
  }

  /** Updates a credit note via `PUT /CreditNote/{creditNoteId}`. */
  public update(options: UpdateCreditNoteOptions): Promise<CreditNote> {
    const { creditNoteId, creditNoteDate, deliveryDate, ...rest } = options;
    return this.http.request<CreditNote>({
      method: 'PUT',
      path: `/CreditNote/${creditNoteId}`,
      body: {
        ...rest,
        creditNoteDate: toOptionalDate(creditNoteDate),
        deliveryDate: toOptionalDate(deliveryDate),
      },
    });
  }

  /** Deletes a credit note via `DELETE /CreditNote/{creditNoteId}`. */
  public async delete(options: { creditNoteId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/CreditNote/${options.creditNoteId}`,
    });
  }

  /** Sends a credit note via email using `POST /CreditNote/{creditNoteId}/sendViaEmail`. */
  public sendViaEmail(
    options: SendCreditNoteViaEmailOptions,
  ): Promise<CreditNoteMail[]> {
    const { creditNoteId, ...body } = options;
    return this.http.request<CreditNoteMail[]>({
      method: 'POST',
      path: `/CreditNote/${creditNoteId}/sendViaEmail`,
      body,
    });
  }

  /** Retrieves the pdf of a credit note via `GET /CreditNote/{creditNoteId}/getPdf`. */
  public getPdf(options: {
    creditNoteId: number;
    /** Prevents the credit note from being marked as sent. */
    preventSendBy?: boolean;
  }): Promise<CreditNotePdf> {
    return this.http.request<CreditNotePdf>({
      method: 'GET',
      path: `/CreditNote/${options.creditNoteId}/getPdf`,
      query: { preventSendBy: options.preventSendBy },
    });
  }

  /** Marks a credit note as sent via `PUT /CreditNote/{creditNoteId}/sendBy`. */
  public sendBy(options: SendCreditNoteByOptions): Promise<CreditNote> {
    const { creditNoteId, sendType, sendDraft } = options;
    return this.http.request<CreditNote>({
      method: 'PUT',
      path: `/CreditNote/${creditNoteId}/sendBy`,
      body: { sendType, sendDraft },
    });
  }

  /** Books an amount on a credit note via `PUT /CreditNote/{creditNoteId}/bookAmount`. */
  public book(options: BookCreditNoteOptions): Promise<BookCreditNoteResult> {
    const {
      creditNoteId,
      amount,
      date,
      type,
      checkAccountId,
      checkAccountTransactionId,
      createFeed,
    } = options;
    return this.http.request<BookCreditNoteResult>({
      method: 'PUT',
      path: `/CreditNote/${creditNoteId}/bookAmount`,
      body: {
        amount,
        date: toIsoDateTime(date),
        type,
        checkAccount: { id: checkAccountId, objectName: 'CheckAccount' },
        checkAccountTransaction: toRef(
          checkAccountTransactionId,
          'CheckAccountTransaction',
        ),
        createFeed,
      },
    });
  }

  /** Enshrines a credit note via `PUT /CreditNote/{creditNoteId}/enshrine`. This cannot be undone. */
  public async enshrine(options: { creditNoteId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'PUT',
      path: `/CreditNote/${options.creditNoteId}/enshrine`,
    });
  }

  /** Resets the credit note status to open via `PUT /CreditNote/{creditNoteId}/resetToOpen`. */
  public resetToOpen(options: { creditNoteId: number }): Promise<CreditNote> {
    return this.http.request<CreditNote>({
      method: 'PUT',
      path: `/CreditNote/${options.creditNoteId}/resetToOpen`,
    });
  }

  /** Resets the credit note status to draft via `PUT /CreditNote/{creditNoteId}/resetToDraft`. */
  public resetToDraft(options: { creditNoteId: number }): Promise<CreditNote> {
    return this.http.request<CreditNote>({
      method: 'PUT',
      path: `/CreditNote/${options.creditNoteId}/resetToDraft`,
    });
  }

  /** Retrieves credit note positions via `GET /CreditNotePos`. */
  public listPositions(
    options: ListCreditNotePositionsOptions = {},
  ): Promise<CreditNotePosition[]> {
    const { creditNoteId, limit, offset, embed } = options;
    return this.http.request<CreditNotePosition[]>({
      method: 'GET',
      path: '/CreditNotePos',
      query: {
        'creditNote[id]': creditNoteId,
        'creditNote[objectName]':
          creditNoteId === undefined ? undefined : 'CreditNote',
        limit,
        offset,
        embed,
      },
    });
  }
}

function toCreditNoteBody(
  creditNote: CreditNoteInput,
): Record<string, unknown> {
  return {
    objectName: 'CreditNote',
    mapAll: true,
    creditNoteNumber: creditNote.creditNoteNumber,
    creditNoteDate: toVoucherDate(creditNote.creditNoteDate),
    contact: { id: creditNote.contactId, objectName: 'Contact' },
    status: creditNote.status,
    header: creditNote.header,
    bookingCategory: creditNote.bookingCategory,
    contactPerson: { id: creditNote.contactPersonId, objectName: 'SevUser' },
    taxRule: { id: creditNote.taxRuleId, objectName: 'TaxRule' },
    taxRate: creditNote.taxRate,
    taxText: creditNote.taxText,
    currency: creditNote.currency,
    deliveryDate: toVoucherDate(creditNote.deliveryDate),
    addressCountry: toRef(creditNote.addressCountryId, 'StaticCountry'),
    headText: creditNote.headText,
    footText: creditNote.footText,
    address: creditNote.address,
    smallSettlement: creditNote.smallSettlement,
    showNet: creditNote.showNet,
    customerInternalNote: creditNote.customerInternalNote,
    sendDate: toOptionalDate(creditNote.sendDate),
    sendType: creditNote.sendType,
  };
}

function toCreditNotePositionBody(
  position: CreditNotePositionInput,
): Record<string, unknown> {
  return {
    objectName: 'CreditNotePos',
    mapAll: true,
    unity: { id: position.unityId, objectName: 'Unity' },
    quantity: position.quantity,
    taxRate: position.taxRate,
    name: position.name,
    price: position.price,
    text: position.text,
    part: toRef(position.partId, 'Part'),
    positionNumber: position.positionNumber,
    discount: position.discount,
    optional: position.optional,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}

function toOptionalDate(
  value: DateInput | undefined,
): string | number | undefined {
  return value === undefined ? undefined : toVoucherDate(value);
}
