export function isInteractive(): boolean {
  return (
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true &&
    !process.env['CI']
  );
}
