export function log(message: string): void {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`)
}
