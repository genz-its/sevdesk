import { toIsoDateTime, toVoucherDate } from '../dates';
import { SevDeskError } from '../errors';
import type {
  DateInput,
  ListOptions,
  ModelRef,
  ModelRefResponse,
} from '../types';
import { BaseResource } from './base';

export type VoucherStatus = 50 | 100 | 150 | 750 | 1000;

export type VoucherBookingType =
  'FULL_PAYMENT' | 'N' | 'CB' | 'O' | 'OF' | 'MTC';

export interface VoucherInput {
  /** `50` for a draft voucher, `100` for an open one. */
  status: 50 | 100;
  /** `C` for a credit voucher, `D` for a debit voucher. */
  creditDebit: 'C' | 'D';
  /** Defines the vat regulation, for example `1` for "Umsatzsteuerpflichtige Umsätze". */
  taxRuleId: number;
  /** Defaults to `VOU`. */
  voucherType?: 'VOU' | 'RV';
  voucherDate?: DateInput;
  payDate?: DateInput;
  deliveryDate?: DateInput;
  deliveryDateUntil?: DateInput;
  supplierId?: number;
  /** Shown as the supplier of the voucher when no `supplierId` is given. */
  supplierName?: string;
  /** The voucher number. */
  description?: string;
  currency?: string;
  propertyExchangeRate?: number;
  costCentreId?: number;
}

export interface VoucherPositionInput {
  accountDatevId: number;
  taxRate: number;
  /** `true` if `sumNet` is authoritative, `false` if `sumGross` is. */
  net: boolean;
  sumNet?: number;
  sumGross?: number;
  isAsset?: boolean;
  comment?: string;
}

export interface SaveVoucherOptions {
  voucher: VoucherInput;
  positions: VoucherPositionInput[];
  /** Internal filename returned by `uploadFile`. */
  filename?: string;
}

export interface ListVouchersOptions extends ListOptions {
  status?: VoucherStatus;
  creditDebit?: 'C' | 'D';
  descriptionLike?: string;
  startDate?: DateInput;
  endDate?: DateInput;
  contactId?: number;
  /**
   * Filters vouchers by a linked object, for example a document the voucher
   * originated from. Payment bookings are not exposed as linked objects, so
   * this cannot look up the voucher booked against a bank transaction.
   */
  linkedObjectId?: number;
  linkedObjectName?: string;
  embed?: string[];
}

export interface ListVoucherPositionsOptions extends ListOptions {
  /** Only returns the positions of this voucher. */
  voucherId?: number;
  embed?: string[];
}

export interface UpdateVoucherOptions {
  voucherId: number;
  voucherDate?: DateInput;
  /** The voucher number. */
  description?: string;
  payDate?: DateInput;
  supplierName?: string;
}

export interface BookVoucherOptions {
  voucherId: number;
  /** Can also be a partial amount. */
  amount: number;
  date: DateInput;
  type: VoucherBookingType;
  checkAccountId: number;
  /**
   * Required for online check accounts. Must be omitted for offline check
   * accounts and cash registers, where the transaction is created automatically.
   */
  checkAccountTransactionId?: number;
  createFeed?: boolean;
}

export interface Voucher {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  voucherDate: string | null;
  supplier: ModelRefResponse | null;
  supplierName: string | null;
  description: string | null;
  payDate: string | null;
  status: string | null;
  sumNet: string;
  sumTax: string;
  sumGross: string;
  sumNetAccounting: string;
  sumTaxAccounting: string;
  sumGrossAccounting: string;
  sumDiscounts: string;
  paidAmount: number | null;
  taxRule: ModelRefResponse;
  creditDebit: string | null;
  voucherType: string | null;
  currency: string | null;
  propertyExchangeRate: string | null;
  enshrined: string | null;
  paymentDeadline: string | null;
  deliveryDate: string;
  deliveryDateUntil: string | null;
  document: ModelRefResponse | null;
  costCentre: ModelRefResponse | null;
}

export interface VoucherPosition {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  voucher: ModelRefResponse;
  accountDatev: ModelRefResponse;
  taxRate: string;
  net: boolean;
  isAsset: boolean;
  sumNet: string;
  sumTax: string;
  sumGross: string;
  sumNetAccounting: string;
  sumTaxAccounting: string;
  sumGrossAccounting: string;
  comment: string | null;
}

export interface SaveVoucherResult {
  voucher: Voucher;
  positions: VoucherPosition[];
  filename?: string;
}

export interface BookVoucherResult {
  id: string;
  objectName: string;
  create: string;
  voucher: ModelRefResponse;
  fromStatus: string;
  toStatus: string;
  amountPayed: string;
  bookingDate: string;
  sevClient: ModelRefResponse;
}

export interface UploadVoucherFileResult {
  pages: number;
  mimeType: string;
  originMimeType: string;
  /** The sevdesk internal filename to pass to `save`. */
  filename: string;
  contentHash: string;
}

export class VouchersResource extends BaseResource {
  /** Retrieves vouchers via `GET /Voucher`. */
  public list(options: ListVouchersOptions = {}): Promise<Voucher[]> {
    const {
      status,
      creditDebit,
      descriptionLike,
      startDate,
      endDate,
      contactId,
      linkedObjectId,
      linkedObjectName,
      limit,
      offset,
      embed,
    } = options;
    return this.http.request<Voucher[]>({
      method: 'GET',
      path: '/Voucher',
      query: {
        status,
        creditDebit,
        descriptionLike,
        startDate: toOptionalVoucherDate(startDate),
        endDate: toOptionalVoucherDate(endDate),
        'contact[id]': contactId,
        'contact[objectName]': contactId === undefined ? undefined : 'Contact',
        'object[id]': linkedObjectId,
        'object[objectName]':
          linkedObjectId === undefined ? undefined : linkedObjectName,
        limit,
        offset,
        embed,
      },
    });
  }

  /** Retrieves a single voucher via `GET /Voucher/{voucherId}`. */
  public async get(options: {
    voucherId: number;
    embed?: string[];
  }): Promise<Voucher> {
    const vouchers = await this.http.request<Voucher[]>({
      method: 'GET',
      path: `/Voucher/${options.voucherId}`,
      query: { embed: options.embed },
    });
    const voucher = vouchers[0];
    if (!voucher) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return voucher;
  }

  /** Uploads a voucher document via `POST /Voucher/Factory/uploadTempFile`. */
  public uploadFile(options: {
    file: Blob | Uint8Array;
    filename?: string;
  }): Promise<UploadVoucherFileResult> {
    const { file, filename = 'upload' } = options;
    const formData = new FormData();
    const blob =
      file instanceof Blob ? file : new Blob([file as Uint8Array<ArrayBuffer>]);
    formData.append('file', blob, filename);
    return this.http.request<UploadVoucherFileResult>({
      method: 'POST',
      path: '/Voucher/Factory/uploadTempFile',
      formData,
    });
  }

  /** Creates or updates a voucher with its positions via `POST /Voucher/Factory/saveVoucher`. */
  public async save(options: SaveVoucherOptions): Promise<SaveVoucherResult> {
    const { voucher, positions, filename } = options;
    const result = await this.http.request<{
      voucher: Voucher;
      voucherPos: VoucherPosition[];
      filename?: string;
    }>({
      method: 'POST',
      path: '/Voucher/Factory/saveVoucher',
      body: {
        voucher: toVoucherBody(voucher),
        voucherPosSave: positions.map(toVoucherPositionBody),
        voucherPosDelete: null,
        ...(filename === undefined ? {} : { filename }),
      },
    });
    return {
      voucher: result.voucher,
      positions: result.voucherPos,
      filename: result.filename,
    };
  }

  /** Uploads a document and creates a voucher with it attached. */
  public async createFromFile(options: {
    file: Blob | Uint8Array;
    filename?: string;
    voucher: VoucherInput;
    positions: VoucherPositionInput[];
  }): Promise<SaveVoucherResult> {
    const { file, filename, voucher, positions } = options;
    const upload = await this.uploadFile({ file, filename });
    return this.save({ voucher, positions, filename: upload.filename });
  }

  /** Updates simple fields of a draft voucher via `PUT /Voucher/{voucherId}`. */
  public update(options: UpdateVoucherOptions): Promise<Voucher> {
    const { voucherId, voucherDate, description, payDate, supplierName } =
      options;
    return this.http.request<Voucher>({
      method: 'PUT',
      path: `/Voucher/${voucherId}`,
      body: {
        voucherDate: toOptionalVoucherDate(voucherDate),
        description,
        payDate: toOptionalVoucherDate(payDate),
        supplierName,
      },
    });
  }

  /** Books an amount on a voucher via `PUT /Voucher/{voucherId}/bookAmount`. */
  public book(options: BookVoucherOptions): Promise<BookVoucherResult> {
    const {
      voucherId,
      amount,
      date,
      type,
      checkAccountId,
      checkAccountTransactionId,
      createFeed,
    } = options;
    return this.http.request<BookVoucherResult>({
      method: 'PUT',
      path: `/Voucher/${voucherId}/bookAmount`,
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

  /** Resets the voucher status to open via `PUT /Voucher/{voucherId}/resetToOpen`. */
  public resetToOpen(options: { voucherId: number }): Promise<Voucher> {
    return this.http.request<Voucher>({
      method: 'PUT',
      path: `/Voucher/${options.voucherId}/resetToOpen`,
    });
  }

  /** Resets the voucher status to draft via `PUT /Voucher/{voucherId}/resetToDraft`. */
  public resetToDraft(options: { voucherId: number }): Promise<Voucher> {
    return this.http.request<Voucher>({
      method: 'PUT',
      path: `/Voucher/${options.voucherId}/resetToDraft`,
    });
  }

  /** Enshrines a voucher via `PUT /Voucher/{voucherId}/enshrine`. This cannot be undone. */
  public async enshrine(options: { voucherId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'PUT',
      path: `/Voucher/${options.voucherId}/enshrine`,
    });
  }

  /** Retrieves voucher positions via `GET /VoucherPos`. */
  public listPositions(
    options: ListVoucherPositionsOptions = {},
  ): Promise<VoucherPosition[]> {
    const { voucherId, limit, offset, embed } = options;
    return this.http.request<VoucherPosition[]>({
      method: 'GET',
      path: '/VoucherPos',
      query: {
        'voucher[id]': voucherId,
        'voucher[objectName]': voucherId === undefined ? undefined : 'Voucher',
        limit,
        offset,
        embed,
      },
    });
  }
}

function toVoucherBody(voucher: VoucherInput): Record<string, unknown> {
  return {
    objectName: 'Voucher',
    mapAll: true,
    status: voucher.status,
    creditDebit: voucher.creditDebit,
    taxRule: { id: voucher.taxRuleId, objectName: 'TaxRule' },
    voucherType: voucher.voucherType ?? 'VOU',
    voucherDate: toOptionalVoucherDate(voucher.voucherDate),
    payDate: toOptionalVoucherDate(voucher.payDate),
    deliveryDate: toOptionalVoucherDate(voucher.deliveryDate),
    deliveryDateUntil: toOptionalVoucherDate(voucher.deliveryDateUntil),
    supplier: toRef(voucher.supplierId, 'Contact'),
    supplierName: voucher.supplierName,
    description: voucher.description,
    currency: voucher.currency,
    propertyExchangeRate: voucher.propertyExchangeRate,
    costCentre: toRef(voucher.costCentreId, 'CostCentre'),
  };
}

function toVoucherPositionBody(
  position: VoucherPositionInput,
): Record<string, unknown> {
  return {
    objectName: 'VoucherPos',
    mapAll: true,
    voucher: null,
    accountDatev: {
      id: position.accountDatevId,
      objectName: 'AccountDatev',
    },
    taxRate: position.taxRate,
    net: position.net,
    sumNet: position.sumNet,
    sumGross: position.sumGross,
    isAsset: position.isAsset,
    comment: position.comment,
  };
}

function toRef(
  id: number | undefined,
  objectName: string,
): ModelRef | undefined {
  return id === undefined ? undefined : { id, objectName };
}

function toOptionalVoucherDate(
  value: DateInput | undefined,
): string | number | undefined {
  return value === undefined ? undefined : toVoucherDate(value);
}
