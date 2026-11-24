import { deriveAllowedHosts } from "./index.js";

describe("deriveAllowedHosts", () => {
  test("default loopback host with port", () => {
    expect(deriveAllowedHosts("127.0.0.1", 3000)).toEqual([
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "127.0.0.1:3000",
      "[::1]",
      "[::1]:3000",
    ]);
  });

  test("undefined host still allows loopback names", () => {
    expect(deriveAllowedHosts(undefined, 4000)).toEqual([
      "localhost",
      "localhost:4000",
      "127.0.0.1",
      "127.0.0.1:4000",
      "[::1]",
      "[::1]:4000",
    ]);
  });

  test("explicit LAN host adds its forms", () => {
    expect(deriveAllowedHosts("192.168.1.5", 3000)).toContain("192.168.1.5");
    expect(deriveAllowedHosts("192.168.1.5", 3000)).toContain(
      "192.168.1.5:3000",
    );
  });

  test("IPv6 host is bracketed", () => {
    expect(deriveAllowedHosts("::1", 3000)).toContain("[::1]:3000");
  });

  test("wildcard host adds no extra entries", () => {
    const hosts = deriveAllowedHosts("0.0.0.0", 3000);
    expect(hosts).not.toContain("0.0.0.0");
    expect(hosts).not.toContain("0.0.0.0:3000");
  });

  test("port 0 emits bare forms only", () => {
    const hosts = deriveAllowedHosts("127.0.0.1", 0);
    expect(hosts).toEqual(["localhost", "127.0.0.1", "[::1]"]);
  });
});
