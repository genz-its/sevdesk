import type { SevDesk } from '@genz-its/sevdesk-sdk';
import { fetchAll } from '../pagination';

/** getPositions ignores offset on live accounts; use the paginated InvoicePos resource. */
export async function fetchInvoicePositions(
  client: SevDesk,
  invoiceId: number,
) {
  const seen = new Set<string>();
  return fetchAll(async (page) => {
    const positions = await client.invoices.listPositions({
      invoiceId,
      ...page,
    });
    for (const position of positions) {
      if (!/^[1-9]\d*$/.test(position.id) || seen.has(position.id))
        throw new Error(
          'Invoice position pagination did not advance or returned an invalid ID. Refusing an incomplete position replacement.',
        );
      if (position.invoice && position.invoice.id !== String(invoiceId))
        throw new Error(
          'Invoice position belongs to another invoice; refusing replacement.',
        );
      seen.add(position.id);
    }
    return positions;
  });
}
