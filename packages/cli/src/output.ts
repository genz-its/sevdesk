/**
 * A contact reference as returned by the API. The name fields are only present
 * when the reference was inflated with the `embed` query parameter.
 */
export interface ContactLike {
  id: string;
  name?: string | null;
  surename?: string | null;
  familyname?: string | null;
}

/** Formats a contact reference as its organization or person name. */
export function contactLabel(ref: ContactLike | null | undefined): string {
  if (!ref) {
    return '-';
  }
  const personName = [ref.surename, ref.familyname]
    .filter((part) => part)
    .join(' ');
  return ref.name || personName || ref.id || '-';
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printTable(rows: Array<Record<string, string>>): void {
  const first = rows[0];
  if (!first) {
    return;
  }
  const columns = Object.keys(first);
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (values: string[]): string =>
    values.map((value, index) => value.padEnd(widths[index] ?? 0)).join('  ');
  console.log(line(columns.map((column) => column.toUpperCase())));
  for (const row of rows) {
    console.log(line(columns.map((column) => row[column] ?? '')));
  }
}
