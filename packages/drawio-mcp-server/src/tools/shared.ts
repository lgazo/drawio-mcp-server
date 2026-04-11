import { z } from "zod";

export const Attributes: z.ZodType<any> = z.lazy(() =>
  z
    .array(z.union([z.string(), Attributes]))
    .refine((arr) => arr.length === 0 || typeof arr[0] === "string", {
      message: "If not empty, the first element must be a string operator",
    })
    .default([]),
);

const BaseTargetPageSchema = z
  .object({
    index: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Zero-based page index in the current Draw.io document."),
    id: z
      .string()
      .optional()
      .describe("Stable Draw.io page identifier from `list-pages`."),
  })
  .superRefine((value, ctx) => {
    const hasIndex = value.index !== undefined;
    const hasId = value.id !== undefined && value.id.length > 0;

    if (hasIndex === hasId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of `index` or `id`.",
      });
    }
  });

export function target_page_field() {
  return BaseTargetPageSchema.describe(
    "Target page selector. Provide exactly one of `{ index }` or `{ id }` from `list-pages`.",
  );
}
