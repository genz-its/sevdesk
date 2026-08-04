import { toVoucherDate } from '../dates';
import { SevDeskError } from '../errors';
import type {
  DateInput,
  ListOptions,
  ModelRef,
  ModelRefResponse,
} from '../types';
import { BaseResource } from './base';

/**
 * Status of an order.
 *
 * - `100` draft
 * - `200` delivered
 * - `300` rejected / cancelled
 * - `500` accepted
 * - `750` partially calculated
 * - `1000` calculated
 */
export type OrderStatus = 100 | 200 | 300 | 500 | 750 | 1000;

/**
 * Type of an order: `AN` estimate / proposal, `AB` order confirmation,
 * `LI` delivery note.
 */
export type OrderType = 'AN' | 'AB' | 'LI';

/**
 * Way in which an order was sent to the end-customer: `VPR` printed,
 * `VP` postal, `VM` mailed, `VPDF` downloaded pdf.
 */
export type OrderSendType = 'VPR' | 'VP' | 'VM' | 'VPDF';

export interface OrderInput {
  orderNumber: string;
  orderDate: DateInput;
  contactId: number;
  status: OrderStatus;
  orderType: OrderType;
  /** Usually consists of a prefix and the order number. */
  header: string;
  /** Version of the order, used for multiple drafts. Starts at `0`. */
  version: number;
  addressCountryId: number;
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
  headText?: string;
  footText?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  smallSettlement?: boolean;
  /** `true` if the position prices are net, `false` if they are gross. */
  showNet?: boolean;
  /** Complete address of the recipient. Line breaks are kept in the pdf. */
  address?: string;
  customerInternalNote?: string;
  sendDate?: DateInput;
  sendType?: OrderSendType;
}

export interface OrderPositionInput {
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

export interface SaveOrderOptions {
  order: OrderInput;
  positions: OrderPositionInput[];
}

export interface ListOrdersOptions extends ListOptions {
  status?: OrderStatus;
  orderNumber?: string;
  startDate?: DateInput;
  endDate?: DateInput;
  contactId?: number;
  embed?: string[];
}

export interface UpdateOrderOptions {
  orderId: number;
  orderNumber?: string;
  orderDate?: DateInput;
  status?: OrderStatus;
  header?: string;
  headText?: string;
  footText?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  address?: string;
  customerInternalNote?: string;
  version?: number;
}

export interface GetOrderRelatedObjectsOptions {
  orderId: number;
  /** Include the order itself in the result. */
  includeItself?: boolean;
  sortByType?: boolean;
  embed?: string[];
}

export interface SendOrderViaEmailOptions {
  orderId: number;
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

export interface SendOrderByOptions {
  orderId: number;
  sendType: OrderSendType;
  /**
   * Creates a draft for internal use. The status of the order is not changed.
   */
  sendDraft: boolean;
}

export interface ListOrderPositionsOptions extends ListOptions {
  orderId?: number;
  embed?: string[];
}

export interface UpdateOrderPositionOptions {
  orderPosId: number;
  quantity?: number;
  price?: number;
  priceTax?: number;
  priceGross?: number;
  name?: string;
  text?: string;
  positionNumber?: number;
  discount?: number;
  optional?: boolean;
  taxRate?: number;
  unityId?: number;
  partId?: number;
}

export interface Order {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  createUser: ModelRefResponse;
  orderNumber: string;
  contact: ModelRefResponse;
  orderDate: string;
  status: string;
  header: string;
  headText: string | null;
  footText: string | null;
  addressCountry: ModelRefResponse | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  origin: ModelRefResponse | null;
  version: string;
  smallSettlement: boolean;
  contactPerson: ModelRefResponse;
  taxRate: string;
  taxRule: ModelRefResponse;
  taxText: string;
  orderType: string;
  sendDate: string | null;
  address: string | null;
  currency: string;
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

export interface OrderPosition {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  order: ModelRefResponse;
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

export interface OrderDiscount {
  id: string;
  objectName: string;
  create: string;
  update: string;
  /** The order the discount belongs to. */
  object: ModelRefResponse;
  sevClient: string;
  text: string;
  /** `1` if `value` is a percentage, `0` if it is an absolute amount. */
  percentage: string;
  value: string;
  /** `0` if the discount is gross, `1` if it is net. */
  isNet: string;
}

/**
 * An object related to an order, for example an invoice or another order.
 * Only `id` and `objectName` are guaranteed, all further fields depend on the
 * type of the related object.
 */
export interface OrderRelatedObject {
  id: string;
  objectName: string;
  [key: string]: unknown;
}

export interface OrderMail {
  id: string;
  objectName: string;
  create: string;
  update: string;
  object: Order;
  from: string;
  to: string;
  subject: string;
  text: string | null;
  sevClient: ModelRefResponse;
  cc: string | null;
  bcc: string | null;
  arrived: string | null;
}

export interface OrderPdf {
  filename: string;
  mimeType: string;
  base64encoded: boolean;
  /** The pdf document, base64 encoded. */
  content: string;
}

export interface SaveOrderResult {
  order: Order;
  positions: OrderPosition[];
}

export class OrdersResource extends BaseResource {
  /** Retrieves orders via `GET /Order`. */
  public list(options: ListOrdersOptions = {}): Promise<Order[]> {
    const {
      status,
      orderNumber,
      startDate,
      endDate,
      contactId,
      limit,
      offset,
      embed,
    } = options;
    return this.http.request<Order[]>({
      method: 'GET',
      path: '/Order',
      query: {
        status,
        orderNumber,
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

  /** Retrieves a single order via `GET /Order/{orderId}`. */
  public async get(options: {
    orderId: number;
    embed?: string[];
  }): Promise<Order> {
    const orders = await this.http.request<Order[]>({
      method: 'GET',
      path: `/Order/${options.orderId}`,
      query: { embed: options.embed },
    });
    const order = orders[0];
    if (!order) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return order;
  }

  /** Creates or updates an order with its positions via `POST /Order/Factory/saveOrder`. */
  public async save(options: SaveOrderOptions): Promise<SaveOrderResult> {
    const { order, positions } = options;
    const result = await this.http.request<{
      order: Order;
      orderPos: OrderPosition[];
    }>({
      method: 'POST',
      path: '/Order/Factory/saveOrder',
      body: {
        order: toOrderBody(order),
        orderPosSave: positions.map(toOrderPositionBody),
        orderPosDelete: null,
      },
    });
    return { order: result.order, positions: result.orderPos };
  }

  /** Updates an order via `PUT /Order/{orderId}`. */
  public update(options: UpdateOrderOptions): Promise<Order> {
    const { orderId, orderDate, ...rest } = options;
    return this.http.request<Order>({
      method: 'PUT',
      path: `/Order/${orderId}`,
      body: { ...rest, orderDate: toOptionalDate(orderDate) },
    });
  }

  /** Deletes an order via `DELETE /Order/{orderId}`. */
  public async delete(options: { orderId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/Order/${options.orderId}`,
    });
  }

  /** Retrieves the positions of an order via `GET /Order/{orderId}/getPositions`. */
  public getPositions(
    options: { orderId: number; embed?: string[] } & ListOptions,
  ): Promise<OrderPosition[]> {
    const { orderId, limit, offset, embed } = options;
    return this.http.request<OrderPosition[]>({
      method: 'GET',
      path: `/Order/${orderId}/getPositions`,
      query: { limit, offset, embed },
    });
  }

  /** Retrieves the discounts of an order via `GET /Order/{orderId}/getDiscounts`. */
  public getDiscounts(
    options: { orderId: number; embed?: string[] } & ListOptions,
  ): Promise<OrderDiscount[]> {
    const { orderId, limit, offset, embed } = options;
    return this.http.request<OrderDiscount[]>({
      method: 'GET',
      path: `/Order/${orderId}/getDiscounts`,
      query: { limit, offset, embed },
    });
  }

  /** Retrieves the objects related to an order via `GET /Order/{orderId}/getRelatedObjects`. */
  public getRelatedObjects(
    options: GetOrderRelatedObjectsOptions,
  ): Promise<OrderRelatedObject[]> {
    const { orderId, includeItself, sortByType, embed } = options;
    return this.http.request<OrderRelatedObject[]>({
      method: 'GET',
      path: `/Order/${orderId}/getRelatedObjects`,
      query: { includeItself, sortByType, embed },
    });
  }

  /** Sends an order via email using `POST /Order/{orderId}/sendViaEmail`. */
  public sendViaEmail(options: SendOrderViaEmailOptions): Promise<OrderMail[]> {
    const { orderId, ...body } = options;
    return this.http.request<OrderMail[]>({
      method: 'POST',
      path: `/Order/${orderId}/sendViaEmail`,
      body,
    });
  }

  /** Creates a packing list from an order via `POST /Order/Factory/createPackingListFromOrder`. */
  public createPackingList(options: { orderId: number }): Promise<Order> {
    return this.http.request<Order>({
      method: 'POST',
      path: '/Order/Factory/createPackingListFromOrder',
      query: {
        'order[id]': options.orderId,
        'order[objectName]': 'Order',
      },
      body: { id: options.orderId, objectName: 'Order' },
    });
  }

  /** Creates a contract note from an order via `POST /Order/Factory/createContractNoteFromOrder`. */
  public createContractNote(options: { orderId: number }): Promise<Order> {
    return this.http.request<Order>({
      method: 'POST',
      path: '/Order/Factory/createContractNoteFromOrder',
      query: {
        'order[id]': options.orderId,
        'order[objectName]': 'Order',
      },
      body: { id: options.orderId, objectName: 'Order' },
    });
  }

  /** Retrieves the pdf of an order via `GET /Order/{orderId}/getPdf`. */
  public getPdf(options: {
    orderId: number;
    /** Prevents the order from being marked as sent. */
    preventSendBy?: boolean;
  }): Promise<OrderPdf> {
    return this.http.request<OrderPdf>({
      method: 'GET',
      path: `/Order/${options.orderId}/getPdf`,
      query: { preventSendBy: options.preventSendBy },
    });
  }

  /** Marks an order as sent via `PUT /Order/{orderId}/sendBy`. */
  public sendBy(options: SendOrderByOptions): Promise<Order> {
    const { orderId, sendType, sendDraft } = options;
    return this.http.request<Order>({
      method: 'PUT',
      path: `/Order/${orderId}/sendBy`,
      body: { sendType, sendDraft },
    });
  }

  /** Retrieves order positions via `GET /OrderPos`. */
  public listPositions(
    options: ListOrderPositionsOptions = {},
  ): Promise<OrderPosition[]> {
    const { orderId, limit, offset, embed } = options;
    return this.http.request<OrderPosition[]>({
      method: 'GET',
      path: '/OrderPos',
      query: {
        'order[id]': orderId,
        'order[objectName]': orderId === undefined ? undefined : 'Order',
        limit,
        offset,
        embed,
      },
    });
  }

  /** Retrieves a single order position via `GET /OrderPos/{orderPosId}`. */
  public async getPosition(options: {
    orderPosId: number;
  }): Promise<OrderPosition> {
    const positions = await this.http.request<OrderPosition[]>({
      method: 'GET',
      path: `/OrderPos/${options.orderPosId}`,
    });
    const position = positions[0];
    if (!position) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return position;
  }

  /** Updates an order position via `PUT /OrderPos/{orderPosId}`. */
  public updatePosition(
    options: UpdateOrderPositionOptions,
  ): Promise<OrderPosition> {
    const { orderPosId, unityId, partId, ...rest } = options;
    return this.http.request<OrderPosition>({
      method: 'PUT',
      path: `/OrderPos/${orderPosId}`,
      body: {
        ...rest,
        unity: toRef(unityId, 'Unity'),
        part: toRef(partId, 'Part'),
      },
    });
  }

  /** Deletes an order position via `DELETE /OrderPos/{orderPosId}`. */
  public async deletePosition(options: { orderPosId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/OrderPos/${options.orderPosId}`,
    });
  }
}

function toOrderBody(order: OrderInput): Record<string, unknown> {
  return {
    objectName: 'Order',
    mapAll: true,
    orderNumber: order.orderNumber,
    orderDate: toVoucherDate(order.orderDate),
    contact: { id: order.contactId, objectName: 'Contact' },
    status: order.status,
    orderType: order.orderType,
    header: order.header,
    version: order.version,
    addressCountry: { id: order.addressCountryId, objectName: 'StaticCountry' },
    contactPerson: { id: order.contactPersonId, objectName: 'SevUser' },
    taxRule: { id: order.taxRuleId, objectName: 'TaxRule' },
    taxRate: order.taxRate,
    taxText: order.taxText,
    currency: order.currency,
    headText: order.headText,
    footText: order.footText,
    deliveryTerms: order.deliveryTerms,
    paymentTerms: order.paymentTerms,
    smallSettlement: order.smallSettlement,
    showNet: order.showNet,
    address: order.address,
    customerInternalNote: order.customerInternalNote,
    sendDate: toOptionalDate(order.sendDate),
    sendType: order.sendType,
  };
}

function toOrderPositionBody(
  position: OrderPositionInput,
): Record<string, unknown> {
  return {
    objectName: 'OrderPos',
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
