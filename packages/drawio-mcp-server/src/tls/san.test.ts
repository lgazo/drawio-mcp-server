import { buildSanList, sanHash } from "./san.js";

describe("buildSanList", () => {
  it("returns loopback defaults when host is undefined", () => {
    expect(buildSanList(undefined)).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });

  it("appends explicit IPv4 host without duplicating loopback", () => {
    expect(buildSanList("192.168.1.10")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
      { type: "ip", value: "192.168.1.10" },
    ]);
  });

  it("appends explicit IPv6 host without duplicating loopback", () => {
    expect(buildSanList("fe80::1")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
      { type: "ip", value: "fe80::1" },
    ]);
  });

  it("does not duplicate when host equals an existing loopback entry", () => {
    expect(buildSanList("127.0.0.1")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });

  it("treats 0.0.0.0 as a wildcard binding, still using loopback SAN set", () => {
    expect(buildSanList("0.0.0.0")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });
});

describe("sanHash", () => {
  it("is stable for identical input", () => {
    const a = sanHash(buildSanList("192.168.1.10"));
    const b = sanHash(buildSanList("192.168.1.10"));
    expect(a).toBe(b);
  });

  it("differs when host changes", () => {
    const a = sanHash(buildSanList(undefined));
    const b = sanHash(buildSanList("192.168.1.10"));
    expect(a).not.toBe(b);
  });

  it("is order-insensitive (canonicalised)", () => {
    const original = buildSanList("192.168.1.10");
    const reversed = [...original].reverse();
    expect(sanHash(reversed)).toBe(sanHash(original));
  });
});
