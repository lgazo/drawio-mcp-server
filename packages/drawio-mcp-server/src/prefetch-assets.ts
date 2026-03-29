import { ensureAssets } from "./assets/index.js";

async function main() {
  const { assetRoot } = await ensureAssets({}, (message) => {
    console.log(message);
  });

  console.log(`Assets ready at ${assetRoot}`);
}

main().catch((error) => {
  console.error("Failed to prefetch draw.io assets", error);
  process.exit(1);
});
