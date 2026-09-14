// Wrapper around the browser's built-in UUID generator.
// No `uuid` package needed — crypto.randomUUID() has been available
// in every browser we target since 2022.
export function generateId() {
  return crypto.randomUUID();
}
