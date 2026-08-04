import type { ExportJobDownloadInfo, SevDesk } from '@genz-its/sevdesk-sdk';
import { SevDeskError } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireStringOption } from '../../options';
import { printJson } from '../../output';

const POLL_INTERVAL = 3_000;

export default defineCommand({
  description: 'Export accounting data in the DATEV format as a ZIP archive.',
  options: defineOptions(
    z.object({
      startDate: z
        .string()
        .optional()
        .describe(
          'Start of the export period as dd.mm.yyyy or Unix timestamp. If omitted, you will be prompted.',
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          'End of the export period as dd.mm.yyyy or Unix timestamp. If omitted, you will be prompted.',
        ),
      format: z
        .enum(['csv', 'xml'])
        .default('csv')
        .describe('The DATEV export format. Supported values are csv and xml.'),
      scope: z
        .string()
        .default('EXTCD')
        .describe(
          'The models to include as a string of letters: E (earnings), X (expenditure), T (transactions), C (cash register) and D (assets). XML exports support only E and X.',
        ),
      output: z
        .string()
        .optional()
        .describe(
          'Path to write the ZIP archive to. Defaults to the filename of the export.',
        ),
      timeout: z.coerce
        .number()
        .default(300)
        .describe('Maximum number of seconds to wait for the export job.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const startDate = await requireStringOption({
      value: options.startDate,
      requirement: 'a start date via --start-date',
      question: 'Enter the start date (dd.mm.yyyy):',
    });
    const endDate = await requireStringOption({
      value: options.endDate,
      requirement: 'an end date via --end-date',
      question: 'Enter the end date (dd.mm.yyyy):',
    });
    const jobOptions = { startDate, endDate, scope: options.scope };
    const jobId =
      options.format === 'csv'
        ? await client.exports.createDatevCsvZipExportJob(jobOptions)
        : await client.exports.createDatevXmlZipExportJob(jobOptions);
    if (!options.json) {
      consola.start('Waiting for the export job to finish...');
    }
    const info = await waitForDownloadInfo(client, jobId, options.timeout);
    if (!info) {
      consola.error(
        `The export job did not finish within ${options.timeout} seconds.`,
      );
      process.exit(1);
    }
    const response = await fetch(info.link);
    if (!response.ok) {
      consola.error(
        `The export file could not be downloaded (status ${response.status}).`,
      );
      process.exit(1);
    }
    const path = options.output ?? info.filename;
    await writeFile(path, new Uint8Array(await response.arrayBuffer()));
    if (options.json) {
      printJson({ jobId, filename: info.filename, path });
      return;
    }
    consola.success(`Saved ${path}.`);
  },
});

async function waitForDownloadInfo(
  client: SevDesk,
  jobId: string,
  timeoutSeconds: number,
): Promise<ExportJobDownloadInfo | undefined> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const info = await getDownloadInfo(client, jobId);
    if (info) {
      return info;
    }
    await delay(POLL_INTERVAL);
  }
  return undefined;
}

async function getDownloadInfo(
  client: SevDesk,
  jobId: string,
): Promise<ExportJobDownloadInfo | undefined> {
  try {
    const [info] = await client.exports.getJobDownloadInfo({ jobId });
    return info?.link ? info : undefined;
  } catch (error) {
    if (error instanceof SevDeskError) {
      return undefined;
    }
    throw error;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
