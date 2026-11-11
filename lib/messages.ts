// Busca solo claves propias: '__proto__' o 'constructor' no deben devolver objetos
export function messageFor(table: Record<string, string>, key: string, fallback: string): string {
  return Object.hasOwn(table, key) ? table[key] : fallback
}
