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
 * Status of an invoice.
 *
 * - `50` deactivated recurring invoice, only relevant for recurring invoices
 * - `100` draft, not sent to the end-customer yet and still changeable
 * - `200` open if the pay date is not exceeded, due if it is
 * - `750` partially paid, only set for invoices partially paid after
 *   release 4.181 (June 13, 2024). Older ones stay at `200`, use
 *   `isPartiallyPaid` for them.
 * - `1000` paid
 */
export type InvoiceStatus = 50 | 100 | 200 | 750 | 1000;

/**
 * Type of an invoice.
 *
 * - `RE` normal invoice
 * - `WKR` recurring invoice
 * - `SR` cancellation invoice
 * - `MA` invoice reminder
 * - `TR` partial invoice
 * - `AR` advance invoice
 * - `ER` final invoice
 */
export type InvoiceType = 'RE' | 'WKR' | 'SR' | 'MA' | 'TR' | 'AR' | 'ER';

/** `VPR` printed, `VPDF` downloaded, `VM` mailed, `VP` postal. */
export type InvoiceSendType = 'VPR' | 'VPDF' | 'VM' | 'VP';

export type InvoiceBookingType =
  'FULL_PAYMENT' | 'N' | 'CB' | 'O' | 'OF' | 'MTC';

export interface InvoiceInput {
  /**
   * `100` for a draft invoice. Invoices can only be created as drafts, the
   * status is advanced by the dedicated endpoints.
   */
  status: 100;
  invoiceDate: DateInput;
  contactId: number;
  /** The sevdesk user acting as contact person for this invoice. */
  contactPersonId: number;
  invoiceType: InvoiceType;
  /** Currency code according to ISO-4217, for example `EUR`. */
  currency: string;
  /** Defines the vat regulation, for example `1` for "Umsatzsteuerpflichtige Umsätze". */
  taxRuleId: number;
  /** Text describing the chosen vat regulation, for example `Umsatzsteuer 19%`. */
  taxText: string;
  invoiceNumber?: string;
  /** Usually consists of a prefix and the invoice number. */
  header?: string;
  headText?: string;
  footText?: string;
  /** The complete recipient address, line breaks are kept on the pdf. */
  address?: string;
  /** Can be omitted when the complete address is given in `address`. */
  addressCountryId?: number;
  /** Percentage the end-customer gets when paying early. Defaults to `0`. */
  discount?: number;
  /** Days the end-customer has to pay the invoice. */
  timeToPay?: number;
  deliveryDate?: DateInput;
  deliveryDateUntil?: DateInput;
  payDate?: DateInput;
  paymentMethodId?: number;
  /** `true` if the sevdesk account falls under the small entrepreneur scheme. */
  smallSettlement?: boolean;
  /** `true` if the position prices are net values, `false` if they are gross. */
  showNet?: boolean;
  /** Shown as "Referenz/Bestellnummer" in sevdesk. */
  customerInternalNote?: string;
  propertyIsEInvoice?: boolean;
}

export interface InvoicePositionInput {
  quantity: number;
  taxRate: number;
  /** The unit in which the position is measured. */
  unityId: number;
  name?: string;
  /** Net or gross price of one unit, depending on the invoice `showNet`. */
  price?: number;
  /** Part from the sevdesk inventory used in the position. */
  partId?: number;
  text?: string;
  /** Starts at zero and orders the positions of an invoice. */
  positionNumber?: number;
  discount?: number;
}

export interface SaveInvoiceOptions {
  invoice: InvoiceInput;
  positions: InvoicePositionInput[];
  /** Takes the first address of the contact as the invoice address. */
  takeDefaultAddress?: boolean;
}

export interface ListInvoicesOptions extends ListOptions {
  status?: InvoiceStatus;
  invoiceNumber?: string;
  startDate?: DateInput;
  endDate?: DateInput;
  contactId?: number;
  embed?: string[];
}

export interface CreateInvoiceFromOrderOptions {
  orderId: number;
  /** Defines how `amount` is interpreted. */
  type?: 'percentage' | 'net' | 'gross';
  amount?: number;
  /** `RE` final invoice, `TR` partial invoice, `AR` advance invoice. */
  partialType?: 'RE' | 'TR' | 'AR';
}

export interface SendInvoiceViaEmailOptions {
  invoiceId: number;
  toEmail: string;
  subject: string;
  /** Can contain html. */
  text: string;
  /** Sends a copy of the email to yourself. */
  copy?: boolean;
  /** Ids of existing sevdesk documents, separated by `,`. */
  additionalAttachments?: string;
  /** Mail addresses separated by `,`. */
  ccEmail?: string;
  /** Mail addresses separated by `,`. */
  bccEmail?: string;
  /** Attaches the xml of the e-invoice instead of the pdf. */
  sendXml?: boolean;
}

export interface SendInvoiceByOptions {
  invoiceId: number;
  sendType: InvoiceSendType;
  /** Creates a draft for internal use without changing the status. */
  sendDraft?: boolean;
}

export interface BookInvoiceOptions {
  invoiceId: number;
  /** Can also be a partial amount. */
  amount: number;
  date: DateInput;
  type: InvoiceBookingType;
  checkAccountId: number;
  /**
   * Required for online check accounts. Must be omitted for offline check
   * accounts and cash registers, where the transaction is created automatically.
   */
  checkAccountTransactionId?: number;
  createFeed?: boolean;
}

export interface Invoice {
  id: string;
  objectName: string;
  invoiceNumber: string | null;
  contact: ModelRefResponse | null;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  invoiceDate: string;
  header: string | null;
  headText: string | null;
  footText: string | null;
  timeToPay: string | null;
  discountTime: string | null;
  discount: string;
  address: string | null;
  addressCountry: ModelRefResponse | null;
  payDate: string | null;
  createUser: ModelRefResponse;
  deliveryDate: string | null;
  deliveryDateUntil: string | null;
  status: string;
  smallSettlement: boolean;
  contactPerson: ModelRefResponse;
  taxRate: string;
  taxRule: ModelRefResponse;
  taxText: string;
  dunningLevel: string | null;
  paymentMethod: ModelRefResponse | null;
  costCentre: ModelRefResponse | null;
  sendDate: string | null;
  origin: ModelRefResponse | null;
  invoiceType: string;
  accountIntervall: string | null;
  accountNextInvoice: string | null;
  reminderTotal: string | null;
  reminderDebit: string | null;
  reminderDeadline: string | null;
  reminderCharge: string | null;
  currency: string;
  sumNet: string;
  sumTax: string;
  sumGross: string;
  sumDiscounts: string;
  sumNetForeignCurrency: string;
  sumTaxForeignCurrency: string;
  sumGrossForeignCurrency: string;
  sumDiscountsForeignCurrency: string;
  sumNetAccounting: string;
  sumTaxAccounting: string;
  sumGrossAccounting: string;
  paidAmount: number | null;
  customerInternalNote: string | null;
  showNet: boolean;
  enshrined: string | null;
  sendType: string | null;
}

export interface InvoicePosition {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  invoice: ModelRefResponse;
  part: ModelRefResponse | null;
  quantity: string;
  price: string | null;
  name: string | null;
  unity: ModelRefResponse;
  positionNumber: string;
  text: string | null;
  discount: string | null;
  taxRate: string;
  sumDiscount: string | null;
  sumNetAccounting: string;
  sumTaxAccounting: string;
  sumGrossAccounting: string;
  priceNet: string;
  priceGross: string;
  priceTax: string;
}

export interface SaveInvoiceResult {
  invoice: Invoice;
  positions: InvoicePosition[];
}

export interface RenderInvoiceResult {
  thumbs: unknown[];
  pages: number;
  /** Internal id of the rendered document. */
  docId: string;
  parameters: InvoiceRenderParameter[];
}

export interface InvoiceRenderParameter {
  key: string;
  name: string;
  values: { name: string; translationCade: string; value: string }[];
  visible: boolean;
  value: string;
}

export interface InvoicePdf {
  filename: string;
  mimeType: string;
  base64encoded: boolean;
  /** The base64 encoded pdf document. */
  content: string;
}

export interface InvoiceEmail {
  id: string;
  objectName: string;
  create: string;
  update: string;
  /** The invoice the email was sent for. */
  object: Invoice;
  from: string;
  to: string;
  subject: string;
  text: string | null;
  sevClient: ModelRefResponse;
}

export interface BookInvoiceResult {
  id: string;
  objectName: string;
  additionalInformation: string | null;
  create: string;
  invoice: ModelRefResponse;
  fromStatus: string;
  toStatus: string;
  /** Spelled `ammountPayed` by the sevdesk API. */
  ammountPayed: string;
  bookingDate: string;
  sevClient: ModelRefResponse;
}

export class InvoicesResource extends BaseResource {
  /** Retrieves invoices via `GET /Invoice`. */
  public list(options: ListInvoicesOptions = {}): Promise<Invoice[]> {
    const {
      status,
      invoiceNumber,
      startDate,
      endDate,
      contactId,
      limit,
      offset,
      embed,
    } = options;
    return this.http.request<Invoice[]>({
      method: 'GET',
      path: '/Invoice',
      query: {
        status,
        invoiceNumber,
        startDate: toOptionalInvoiceDate(startDate),
        endDate: toOptionalInvoiceDate(endDate),
        'contact[id]': contactId,
        'contact[objectName]': contactId === undefined ? undefined : 'Contact',
        limit,
        offset,
        embed,
      },
    });
  }

  /** Retrieves a single invoice via `GET /Invoice/{invoiceId}`. */
  public async get(options: { invoiceId: number }): Promise<Invoice> {
    const invoices = await this.http.request<Invoice[]>({
      method: 'GET',
      path: `/Invoice/${options.invoiceId}`,
    });
    const invoice = invoices[0];
    if (!invoice) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return invoice;
  }

  /**
   * Creates or updates an invoice with its positions via
   * `POST /Invoice/Factory/saveInvoice`.
   *
   * Invoices can only be created as drafts. Use `sendViaEmail`, `sendBy` and
   * `book` to advance the status afterwards.
   */
  public async save(options: SaveInvoiceOptions): Promise<SaveInvoiceResult> {
    const { invoice, positions, takeDefaultAddress } = options;
    const result = await this.http.request<{
      invoice: Invoice;
      invoicePos: InvoicePosition[];
    }>({
      method: 'POST',
      path: '/Invoice/Factory/saveInvoice',
      body: {
        invoice: toInvoiceBody(invoice),
        invoicePosSave: positions.map(toInvoicePositionBody),
        invoicePosDelete: null,
        discountSave: null,
        discountDelete: null,
        ...(takeDefaultAddress === undefined ? {} : { takeDefaultAddress }),
      },
    });
    return { invoice: result.invoice, positions: result.invoicePos };
  }

  /** Creates an invoice from an order via `POST /Invoice/Factory/createInvoiceFromOrder`. */
  public createFromOrder(
    options: CreateInvoiceFromOrderOptions,
  ): Promise<Invoice> {
    const { orderId, type, amount, partialType } = options;
    return this.http.request<Invoice>({
      method: 'POST',
      path: '/Invoice/Factory/createInvoiceFromOrder',
      body: {
        order: { id: orderId, objectName: 'Order' },
        type,
        amount,
        partialType,
      },
    });
  }

  /** Creates a reminder for an invoice via `POST /Invoice/Factory/createInvoiceReminder`. */
  public createReminder(options: { invoiceId: number }): Promise<Invoice> {
    return this.http.request<Invoice>({
      method: 'POST',
      path: '/Invoice/Factory/createInvoiceReminder',
      body: {
        invoice: { id: options.invoiceId, objectName: 'Invoice' },
      },
    });
  }

  /** Retrieves the positions of an invoice via `GET /Invoice/{invoiceId}/getPositions`. */
  public getPositions(
    options: { invoiceId: number; embed?: string[] } & ListOptions,
  ): Promise<InvoicePosition[]> {
    const { invoiceId, limit, offset, embed } = options;
    return this.http.request<InvoicePosition[]>({
      method: 'GET',
      path: `/Invoice/${invoiceId}/getPositions`,
      query: { limit, offset, embed },
    });
  }

  /**
   * Checks if an invoice is partially paid via
   * `GET /Invoice/{invoiceId}/getIsPartiallyPaid`.
   *
   * Fully paid invoices are regarded as not partially paid.
   */
  public isPartiallyPaid(options: { invoiceId: number }): Promise<boolean> {
    return this.http.request<boolean>({
      method: 'GET',
      path: `/Invoice/${options.invoiceId}/getIsPartiallyPaid`,
    });
  }

  /**
   * Cancels an invoice via `POST /Invoice/{invoiceId}/cancelInvoice` and
   * returns the created cancellation invoice.
   */
  public cancel(options: { invoiceId: number }): Promise<Invoice> {
    return this.http.request<Invoice>({
      method: 'POST',
      path: `/Invoice/${options.invoiceId}/cancelInvoice`,
    });
  }

  /** Renders the pdf document of an invoice via `POST /Invoice/{invoiceId}/render`. */
  public render(options: {
    invoiceId: number;
    forceReload?: boolean;
  }): Promise<RenderInvoiceResult> {
    return this.http.request<RenderInvoiceResult>({
      method: 'POST',
      path: `/Invoice/${options.invoiceId}/render`,
      body: { forceReload: options.forceReload },
    });
  }

  /**
   * Sends an invoice to the end-customer via
   * `POST /Invoice/{invoiceId}/sendViaEmail`. This marks the invoice as sent.
   */
  public sendViaEmail(
    options: SendInvoiceViaEmailOptions,
  ): Promise<InvoiceEmail> {
    const { invoiceId, ...body } = options;
    return this.http.request<InvoiceEmail>({
      method: 'POST',
      path: `/Invoice/${invoiceId}/sendViaEmail`,
      body,
    });
  }

  /** Retrieves the pdf document of an invoice via `GET /Invoice/{invoiceId}/getPdf`. */
  public getPdf(options: {
    invoiceId: number;
    /** Prevents marking the invoice as sent. */
    preventSendBy?: boolean;
  }): Promise<InvoicePdf> {
    return this.http.request<InvoicePdf>({
      method: 'GET',
      path: `/Invoice/${options.invoiceId}/getPdf`,
      query: { preventSendBy: options.preventSendBy },
    });
  }

  /** Retrieves the xml of an e-invoice via `GET /Invoice/{invoiceId}/getXml`. */
  public getXml(options: { invoiceId: number }): Promise<string> {
    return this.http.request<string>({
      method: 'GET',
      path: `/Invoice/${options.invoiceId}/getXml`,
    });
  }

  /** Marks an invoice as sent via `PUT /Invoice/{invoiceId}/sendBy`. */
  public sendBy(options: SendInvoiceByOptions): Promise<Invoice> {
    const { invoiceId, sendType, sendDraft } = options;
    return this.http.request<Invoice>({
      method: 'PUT',
      path: `/Invoice/${invoiceId}/sendBy`,
      body: { sendType, sendDraft },
    });
  }

  /** Books an amount on an invoice via `PUT /Invoice/{invoiceId}/bookAmount`. */
  public book(options: BookInvoiceOptions): Promise<BookInvoiceResult> {
    const {
      invoiceId,
      amount,
      date,
      type,
      checkAccountId,
      checkAccountTransactionId,
      createFeed,
    } = options;
    return this.http.request<BookInvoiceResult>({
      method: 'PUT',
      path: `/Invoice/${invoiceId}/bookAmount`,
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

  /**
   * Enshrines an invoice via `PUT /Invoice/{invoiceId}/enshrine`.
   *
   * Requires a status of at least `200` and cannot be undone.
   */
  public async enshrine(options: { invoiceId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'PUT',
      path: `/Invoice/${options.invoiceId}/enshrine`,
    });
  }

  /**
   * Resets the invoice status to open via `PUT /Invoice/{invoiceId}/resetToOpen`.
   *
   * Linked transactions are unlinked. Not possible for enshrined invoices.
   */
  public resetToOpen(options: { invoiceId: number }): Promise<Invoice> {
    return this.http.request<Invoice>({
      method: 'PUT',
      path: `/Invoice/${options.invoiceId}/resetToOpen`,
    });
  }

  /**
   * Resets the invoice status to draft via `PUT /Invoice/{invoiceId}/resetToDraft`.
   *
   * Only possible for invoices with the status `200`.
   */
  public resetToDraft(options: { invoiceId: number }): Promise<Invoice> {
    return this.http.request<Invoice>({
      method: 'PUT',
      path: `/Invoice/${options.invoiceId}/resetToDraft`,
    });
  }
}

function toInvoiceBody(invoice: InvoiceInput): Record<string, unknown> {
  return {
    objectName: 'Invoice',
    mapAll: true,
    invoiceNumber: invoice.invoiceNumber,
    contact: { id: invoice.contactId, objectName: 'Contact' },
    contactPerson: { id: invoice.contactPersonId, objectName: 'SevUser' },
    invoiceDate: toVoucherDate(invoice.invoiceDate),
    header: invoice.header,
    headText: invoice.headText,
    footText: invoice.footText,
    timeToPay: invoice.timeToPay,
    discount: invoice.discount ?? 0,
    address: invoice.address,
    addressCountry: toRef(invoice.addressCountryId, 'StaticCountry'),
    payDate: toOptionalInvoiceDate(invoice.payDate),
    deliveryDate: toOptionalInvoiceDate(invoice.deliveryDate),
    deliveryDateUntil: toOptionalInvoiceDate(invoice.deliveryDateUntil),
    status: invoice.status,
    smallSettlement: invoice.smallSettlement,
    taxRate: 0,
    taxRule: { id: invoice.taxRuleId, objectName: 'TaxRule' },
    taxText: invoice.taxText,
    paymentMethod: toRef(invoice.paymentMethodId, 'PaymentMethod'),
    invoiceType: invoice.invoiceType,
    currency: invoice.currency,
    showNet: invoice.showNet,
    customerInternalNote: invoice.customerInternalNote,
    propertyIsEInvoice: invoice.propertyIsEInvoice,
  };
}

function toInvoicePositionBody(
  position: InvoicePositionInput,
): Record<string, unknown> {
  return {
    objectName: 'InvoicePos',
    mapAll: true,
    invoice: null,
    part: toRef(position.partId, 'Part'),
    quantity: position.quantity,
    price: position.price,
    name: position.name,
    unity: { id: position.unityId, objectName: 'Unity' },
    positionNumber: position.positionNumber,
    text: position.text,
    discount: position.discount,
    taxRate: position.taxRate,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}

function toOptionalInvoiceDate(
  value: DateInput | undefined,
): string | number | undefined {
  return value === undefined ? undefined : toVoucherDate(value);
}
