import { BaseResource } from './base';
import type {
  ExportContactFilter,
  ExportDocumentFilter,
  ExportFile,
  ExportInvoiceFilter,
  ExportSevQueryOptions,
  ExportVoucherFilter,
} from './exports';
import {
  toExportContactFilter,
  toExportDocumentFilter,
  toExportInvoiceFilter,
  toExportSevQueryParams,
  toExportVoucherFilter,
} from './exports';

/** `AN` (quotation), `AB` (order confirmation) and `LI` (delivery note). */
export type ReportOrderType = 'AN' | 'AB' | 'LI';

export interface ReportOrderFilter extends ExportDocumentFilter {
  orderType?: ReportOrderType;
}

export interface ReportInvoiceListOptions {
  download?: boolean;
  /** Defaults to `all`. */
  view?: string;
  limit?: number;
  filter?: ExportInvoiceFilter;
}

export interface ReportOrderListOptions {
  download?: boolean;
  /** Defaults to `all`. */
  view?: string;
  limit?: number;
  filter?: ReportOrderFilter;
}

export interface ReportContactListOptions {
  download?: boolean;
  limit?: number;
  filter?: ExportContactFilter;
}

export interface ReportVoucherListOptions {
  download?: boolean;
  limit?: number;
  filter?: ExportVoucherFilter;
}

export class ReportsResource extends BaseResource {
  /** Creates an invoice list report as PDF via `GET /Report/invoicelist`. */
  public invoiceList(
    options: ReportInvoiceListOptions = {},
  ): Promise<ExportFile> {
    return this.requestReport(
      '/Report/invoicelist',
      { download: options.download, view: options.view ?? 'all' },
      {
        modelName: 'Invoice',
        limit: options.limit,
        filter: toExportInvoiceFilter(options.filter),
      },
    );
  }

  /** Creates an order list report as PDF via `GET /Report/orderlist`. */
  public orderList(options: ReportOrderListOptions = {}): Promise<ExportFile> {
    return this.requestReport(
      '/Report/orderlist',
      { download: options.download, view: options.view ?? 'all' },
      {
        modelName: 'Order',
        limit: options.limit,
        filter: {
          ...toExportDocumentFilter(options.filter),
          orderType: options.filter?.orderType,
        },
      },
    );
  }

  /** Creates a contact list report as PDF via `GET /Report/contactlist`. */
  public contactList(
    options: ReportContactListOptions = {},
  ): Promise<ExportFile> {
    return this.requestReport('/Report/contactlist', options, {
      modelName: 'Contact',
      limit: options.limit,
      filter: toExportContactFilter(options.filter),
    });
  }

  /** Creates a voucher list report as PDF via `GET /Report/voucherlist`. */
  public voucherList(
    options: ReportVoucherListOptions = {},
  ): Promise<ExportFile> {
    return this.requestReport('/Report/voucherlist', options, {
      modelName: 'Voucher',
      limit: options.limit,
      filter: toExportVoucherFilter(options.filter),
    });
  }

  private requestReport(
    path: string,
    options: { download?: boolean; view?: string },
    sevQuery: ExportSevQueryOptions,
  ): Promise<ExportFile> {
    return this.http.request<ExportFile>({
      method: 'GET',
      path,
      query: {
        download: options.download,
        view: options.view,
        ...toExportSevQueryParams(sevQuery),
      },
    });
  }
}
