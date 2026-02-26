/**
 * Removes top-level fields from an object that start with '__'
 * @param obj The input object to process
 * @returns A new object with internal fields (starting with '__') removed
 */
export function strip_internal_fields<T extends Record<string, any>>(
  obj: T,
): Omit<T, `__${string}`> {
  const result: Partial<T> = {};

  for (const key in obj) {
    if (!key.startsWith("__")) {
      result[key] = obj[key];
    }
  }

  return result as Omit<T, `__${string}`>;
}
