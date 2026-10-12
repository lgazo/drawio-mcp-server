import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageVersion, getVersionConst } from "./bump.mjs";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function checkParity({ root, version }) {
  const errors = [];
  const serverVersion = getPackageVersion(
    join(root, "packages/drawio-mcp-server/package.json"),
  );
  if (serverVersion !== version) {
    errors.push(
      `packages/drawio-mcp-server/package.json is ${serverVersion}, expected ${version}`,
    );
  }
  const constVersion = getVersionConst(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
  );
  if (constVersion !== version) {
    errors.push(
      `VERSION fallback constant is ${constVersion}, expected ${version}`,
    );
  }
  const pluginVersion = getPackageVersion(
    join(root, "packages/drawio-mcp-plugin/package.json"),
  );
  if (pluginVersion !== serverVersion) {
    errors.push(
      `packages/drawio-mcp-plugin/package.json is ${pluginVersion}, expected lockstep ${serverVersion}`,
    );
  }
  const pluginJsonVersion = readJson(
    join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json"),
  ).version;
  const marketplaceVersion = readJson(join(root, ".claude-plugin/marketplace.json"))
    .plugins[0].version;
  if (pluginJsonVersion !== marketplaceVersion) {
    errors.push(
      `claude plugin version drift: plugin.json ${pluginJsonVersion} != marketplace.json ${marketplaceVersion}`,
    );
  }
  return { ok: errors.length === 0, errors };
}
