import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyBumps, getPackageVersion, getVersionConst } from "./bump.mjs";

function fixture({ compatVersion = "2.3.0" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "release-bump-"));
  const pkg = (dir, version) =>
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify({ name: dir, version }, null, 2) + "\n",
    );
  mkdirSync(join(root, "packages/drawio-mcp-server/src"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-plugin"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-compat"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-extension"), { recursive: true });
  pkg("packages/drawio-mcp-server", "2.3.0");
  pkg("packages/drawio-mcp-plugin", "2.3.0");
  pkg("packages/drawio-mcp-compat", compatVersion);
  pkg("packages/drawio-mcp-extension", "2.3.0");
  writeFileSync(join(root, "README.md"), "# repo readme\n");
  writeFileSync(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
    'const VERSION = process.env.npm_package_version ?? "2.3.0";\n',
  );
  return root;
}

test("server scope bumps server+plugin+VERSION const and syncs the README", () => {
  const root = fixture();
  const { changed } = applyBumps({
    root,
    scope: "server",
    version: "2.4.0",
    compatChanged: false,
  });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-plugin/package.json")),
    "2.4.0",
  );
  assert.equal(
    getVersionConst(join(root, "packages/drawio-mcp-server/src/index.ts")),
    "2.4.0",
  );
  assert.equal(
    readFileSync(join(root, "packages/drawio-mcp-server/README.md"), "utf8"),
    "# repo readme\n",
  );
  assert.ok(!changed.includes("packages/drawio-mcp-extension/package.json"));
  assert.ok(!changed.includes("packages/drawio-mcp-compat/package.json"));
});

test("compat bumps on its own line only when changed", () => {
  const root = fixture({ compatVersion: "0.1.0" });
  applyBumps({ root, scope: "server", version: "2.4.0", compatChanged: true });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-compat/package.json")),
    "0.1.1",
  );

  const root2 = fixture({ compatVersion: "0.1.0" });
  applyBumps({ root: root2, scope: "server", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root2, "packages/drawio-mcp-compat/package.json")),
    "0.1.0",
  );
});

test("extension scope only touches the extension package", () => {
  const root = fixture();
  applyBumps({ root, scope: "extension", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-extension/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.3.0",
  );
});

test("both scope applies the single version everywhere", () => {
  const root = fixture();
  applyBumps({ root, scope: "both", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-extension/package.json")),
    "2.4.0",
  );
  assert.equal(
    getVersionConst(join(root, "packages/drawio-mcp-server/src/index.ts")),
    "2.4.0",
  );
});
