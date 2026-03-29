import { z } from "zod";

export const Attributes: z.ZodType<any> = z.lazy(() =>
  z
    .array(z.union([z.string(), Attributes]))
    .refine((arr) => arr.length === 0 || typeof arr[0] === "string", {
      message: "If not empty, the first element must be a string operator",
    })
    .default([]),
);
