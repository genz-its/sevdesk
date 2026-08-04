import { consola } from 'consola';
import { isInteractive } from './interactive';
import { promptConfirm, promptText } from './prompt';

interface RequiredOption<T> {
  value: T | undefined;
  /** Describes the missing option, for example `a voucher ID via --id`. */
  requirement: string;
  /** Question asked when the option is missing in an interactive environment. */
  question: string;
}

/**
 * Returns the option value, asking for it when it is missing. Exits when the
 * value is missing in a non-interactive environment.
 */
export async function requireStringOption(
  options: RequiredOption<string>,
): Promise<string> {
  const value = options.value?.trim();
  if (value) {
    return value;
  }
  requireInteractive(options.requirement);
  const answer = (await promptText(options.question)).trim();
  if (!answer) {
    consola.error('The value must not be empty.');
    process.exit(1);
  }
  return answer;
}

/**
 * Returns the option value, asking for it when it is missing. Exits when the
 * value is missing in a non-interactive environment or is not a number.
 */
export async function requireNumberOption(
  options: RequiredOption<number>,
): Promise<number> {
  if (options.value !== undefined) {
    return options.value;
  }
  requireInteractive(options.requirement);
  const answer = (await promptText(options.question)).trim();
  const value = Number(answer);
  if (!answer || !Number.isFinite(value)) {
    consola.error('The value must be a number.');
    process.exit(1);
  }
  return value;
}

/**
 * Asks for confirmation unless `yes` is set. Returns `false` when the user
 * declines, in which case the command must stop. Exits when the confirmation
 * is missing in a non-interactive environment.
 */
export async function confirmOrAbort(options: {
  message: string;
  yes: boolean;
  /** Preselected answer. Defaults to the answer preselected by the prompt. */
  initial?: boolean;
}): Promise<boolean> {
  if (options.yes) {
    return true;
  }
  if (!isInteractive()) {
    consola.error(
      'You must pass --yes to confirm this action when running in a non-interactive environment.',
    );
    process.exit(1);
  }
  const confirmed =
    options.initial === undefined
      ? await promptConfirm(options.message)
      : await promptConfirm(options.message, options.initial);
  if (!confirmed) {
    consola.info('Aborted.');
  }
  return confirmed;
}

function requireInteractive(requirement: string): void {
  if (!isInteractive()) {
    consola.error(
      `You must provide ${requirement} when running in a non-interactive environment.`,
    );
    process.exit(1);
  }
}
