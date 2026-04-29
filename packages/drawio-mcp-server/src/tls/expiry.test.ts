import { describe, it, expect } from "@jest/globals";
import { evaluateMaterial } from "./expiry.js";
import type { PersistedMeta } from "./generate.js";

const baseMeta = (overrides: Partial<PersistedMeta> = {}): PersistedMeta => ({
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  sanHash: "hash-A",
  caNotAfter: "2036-01-01T00:00:00.000Z",
  serverNotAfter: "2027-01-01T00:00:00.000Z",
  ...overrides,
});

describe("evaluateMaterial", () => {
  it("returns 'missing' when meta is null", () => {
    expect(
      evaluateMaterial({
        meta: null,
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("missing");
  });

  it("returns 'valid' when CA + leaf future-valid and SAN matches", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta(),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("valid");
  });

  it("returns 'san-drift' when SAN hash differs but CA still valid", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta(),
        currentSanHash: "hash-B",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("san-drift");
  });

  it("returns 'leaf-expired' when leaf within 30-day expiry window", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ serverNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("leaf-expired");
  });

  it("returns 'ca-expired' when CA within 30-day expiry window (overrides leaf)", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ caNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("ca-expired");
  });

  it("CA expired wins over SAN drift", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ caNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-B",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("ca-expired");
  });
});
