const missing = new Set<string>();

type SchemaError = { code?: string; message?: string } | null | undefined;

export function isSchemaMiss(error: SchemaError): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /schema cache|Could not find the (table|function|view)/i.test(error.message ?? "")
  );
}

export function skipMissing(name: string): boolean {
  return missing.has(name);
}

export function noteSchemaMiss(name: string, error: SchemaError): boolean {
  if (!isSchemaMiss(error)) return false;
  missing.add(name);
  return true;
}
