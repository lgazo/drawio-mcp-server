import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkParity } from "./parity.mjs";

function fixture({
  serverVersion = "2.4.0",
  constVersion = serverVersion,
  pluginPkgVersion = serverVersion,
  pluginJsonVersion = "0.2.0",
  marketplaceVersion = "0.2.0",
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "parity-"));
  const pkg = (dir, v) =>
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify({ name: dir, version: v }, null, 2),
    );
  mkdirSync(join(root, "packages/drawio-mcp-server/src"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-plugin"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin"), {
    recursive: true,
  });
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  pkg("packages/drawio-mcp-server", serverVersion);
  pkg("packages/drawio-mcp-plugin", pluginPkgVersion);
  writeFileSync(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
    `const VERSION = process.env.npm_package_version ?? "${constVersion}";\n`,
  );
  writeFileSync(
    join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json"),
    JSON.stringify({ name: "drawio", version: pluginJsonVersion }, null, 2),
  );
  writeFileSync(
    join(root, ".claude-plugin/marketplace.json"),
    JSON.stringify(
      { plugins: [{ name: "drawio", version: marketplaceVersion }] },
      null,
      2,
    ),
  );
  return root;
}

test("consistent tree passes", () => {
  const r = checkParity({ root: fixture(), version: "2.4.0" });
  assert.deepEqual(r, { ok: true, errors: [] });
});

test("mismatched server version, const, lockstep, and marketplace are reported", () => {
  const r = checkParity({
    root: fixture({
      serverVersion: "2.3.0",
      constVersion: "2.3.0",
      pluginPkgVersion: "2.0.0",
      marketplaceVersion: "0.3.0",
    }),
    version: "2.4.0",
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("drawio-mcp-server/package.json")));
  assert.ok(r.errors.some((e) => e.includes("VERSION")));
  assert.ok(r.errors.some((e) => e.includes("drawio-mcp-plugin/package.json")));
  assert.ok(r.errors.some((e) => e.includes("plugin.json")));
});
