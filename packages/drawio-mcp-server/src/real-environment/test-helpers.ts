import { expect } from "@jest/globals";

export function unwrapToolPayload<T>(payload: any): T {
  if (payload && typeof payload === "object" && "success" in payload) {
    return payload.result as T;
  }

  return payload as T;
}

export function expectToolSuccess(payload: { success?: boolean }) {
  expect(payload?.success).toBe(true);
}
