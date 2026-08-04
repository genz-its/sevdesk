import { consola } from 'consola';

export async function promptText(message: string): Promise<string> {
  const response = await consola.prompt(message, {
    type: 'text',
    cancel: 'symbol',
  });
  if (typeof response === 'symbol') {
    process.exit(0);
  }
  return response;
}

export async function promptConfirm(
  message: string,
  initial = true,
): Promise<boolean> {
  const response = await consola.prompt(message, {
    type: 'confirm',
    initial,
    cancel: 'symbol',
  });
  if (typeof response === 'symbol') {
    process.exit(0);
  }
  return response;
}
