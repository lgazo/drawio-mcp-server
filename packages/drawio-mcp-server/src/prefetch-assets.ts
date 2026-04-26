import { ensureAssets } from "./assets/index.js";
import { create_logger } from "./mcp_console_logger.js";

async function main() {
  const log = create_logger();
  const { assetRoot } = await ensureAssets({}, log);
  log.log("info", `Assets ready at ${assetRoot}`);
}

main().catch((error) => {
  const log = create_logger();
  log.log("error", "Failed to prefetch draw.io assets", error);
  process.exit(1);
});
