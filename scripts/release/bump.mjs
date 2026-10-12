import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const VERSION_CONST =
  /const VERSION = process\.env\.npm_package_version \?\? "([^"]+)";/;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function getPackageVersion(file) {
  return readJson(file).version;
}

export function setPackageVersion(file, version) {
  const obj = readJson(file);
  obj.version = version;
  writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

export function getVersionConst(file) {
  const m = VERSION_CONST.exec(readFileSync(file, "utf8"));
  if (!m) throw new Error(`VERSION fallback constant not found in ${file}`);
  return m[1];
}

export function setVersionConst(file, version) {
  const src = readFileSync(file, "utf8");
  const matches = src.match(new RegExp(VERSION_CONST.source, "g"));
  if (!matches || matches.length !== 1) {
    throw new Error(
      `VERSION fallback constant not found exactly once in ${file}`,
    );
  }
  writeFileSync(
    file,
    src.replace(
      VERSION_CONST,
      `const VERSION = process.env.npm_package_version ?? "${version}";`,
    ),
  );
}

export function applyBumps({ root, scope, version, compatChanged }) {
  const changed = [];
  const write = (rel, fn) => {
    fn(join(root, rel));
    changed.push(rel);
  };

  if (scope === "server" || scope === "both") {
    write("packages/drawio-mcp-server/package.json", (f) =>
      setPackageVersion(f, version),
    );
    write("packages/drawio-mcp-plugin/package.json", (f) =>
      setPackageVersion(f, version),
    );
    write("packages/drawio-mcp-server/src/index.ts", (f) =>
      setVersionConst(f, version),
    );
    copyFileSync(
      join(root, "README.md"),
      join(root, "packages/drawio-mcp-server/README.md"),
    );
    changed.push("packages/drawio-mcp-server/README.md");
    if (compatChanged) {
      const compatFile = join(root, "packages/drawio-mcp-compat/package.json");
      const cur = getPackageVersion(compatFile);
      const parts = cur.split(".");
      setPackageVersion(
        compatFile,
        `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`,
      );
      changed.push("packages/drawio-mcp-compat/package.json");
    }
  }
  if (scope === "extension" || scope === "both") {
    write("packages/drawio-mcp-extension/package.json", (f) =>
      setPackageVersion(f, version),
    );
  }
  return { changed };
}
