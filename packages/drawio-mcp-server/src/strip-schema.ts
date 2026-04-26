/**
 * Strips the `$schema` key from a JSON Schema object.
 * The `$schema` key injected by zodToJsonSchema causes Claude Code to silently
 * drop tools because the `$` character fails Anthropic's validation regex
 * `^[a-zA-Z0-9_.-]{1,64}$`.
 *
 * @param schema - The input schema object (may have `$schema` key)
 * @returns The schema without `$schema` key
 */
export function stripSchemaKey<T extends Record<string, any>>(schema: T): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = schema;
  return rest as T;
}

/**
 * Recursively strips the `$schema` key from a JSON Schema object and all nested schemas.
 * This handles cases like `definitions` in the schema.
 *
 * @param schema - The input schema object
 * @returns The schema without `$schema` key
 */
export function stripSchemaRecursively<T extends Record<string, any>>(
  schema: T,
): T {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  // Create a shallow copy first
  const result: Record<string, any> = { ...schema };

  // Remove $schema if present
  if ("$schema" in result) {
    delete result["$schema"];
  }

  // Recursively process properties
  if ("properties" in result && typeof result.properties === "object") {
    result.properties = stripSchemaRecursively(result.properties as T);
  }

  // Recursively process items
  if ("items" in result && typeof result.items === "object") {
    result.items = stripSchemaRecursively(result.items as T);
  }

  // Recursively process additionalProperties
  if (
    "additionalProperties" in result &&
    typeof result.additionalProperties === "object"
  ) {
    result.additionalProperties = stripSchemaRecursively(
      result.additionalProperties as T,
    );
  }

  // Recursively process patternProperties
  if (
    "patternProperties" in result &&
    typeof result.patternProperties === "object"
  ) {
    result.patternProperties = stripSchemaRecursively(
      result.patternProperties as T,
    );
  }

  // Process definitions
  if ("definitions" in result && typeof result.definitions === "object") {
    result.definitions = stripSchemaRecursively(result.definitions as T);
  }

  // Process anyOf, allOf, oneOf
  for (const key of ["anyOf", "allOf", "oneOf"]) {
    if (key in result && Array.isArray(result[key])) {
      result[key] = result[key].map((item: any) =>
        typeof item === "object" ? stripSchemaRecursively(item) : item,
      );
    }
  }

  return result as T;
}
