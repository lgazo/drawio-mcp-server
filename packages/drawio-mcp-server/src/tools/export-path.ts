import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

/**
 * Resolve an export-diagram output_path against the export directory and
 * guarantee the target's real path cannot escape it (GHSA-jvqm-g5ch-jh76).
 *
 * Relative paths resolve inside `exportDir`. The export dir is created on
 * demand. Symlink components that leave the dir (or point into it from
 * outside) make the check fail closed.
 *
 * Returns the resolved absolute path, or an Error the caller can surface.
 */
export function resolveConfinedExportPath(
  exportDir: string,
  outputPath: string,
): string | Error {
  let realExportDir: string;
  try {
    mkdirSync(exportDir, { recursive: true });
    realExportDir = realpathSync(exportDir);
  } catch (error) {
    return new Error(
      `Cannot access export directory ${exportDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // Absolute paths are kept as-is (still containment-checked); relative
  // paths resolve inside the export dir.
  const candidate = isAbsolute(outputPath)
    ? outputPath
    : resolve(realExportDir, outputPath);

  // A not-yet-existing tail cannot be a symlink, but an existing dangling
  // symlink at the target would make realpathSync fail above and be waved
  // through by the ancestor walk. Fail closed on any symlink final
  // component (CWE-59).
  let targetStat: ReturnType<typeof lstatSync> | undefined;
  try {
    targetStat = lstatSync(candidate);
  } catch {
    targetStat = undefined;
  }
  if (targetStat?.isSymbolicLink()) {
    return containmentError(outputPath, realExportDir);
  }

  // Walk up to the nearest existing ancestor so symlink components in the
  // path are resolved; a not-yet-existing tail cannot be a symlink.
  let probe = candidate;
  for (;;) {
    let real: string;
    try {
      real = realpathSync(probe);
    } catch {
      const parent = dirname(probe);
      if (parent === probe) {
        return containmentError(outputPath, realExportDir);
      }
      probe = parent;
      continue;
    }
    if (real === realExportDir || real.startsWith(realExportDir + sep)) {
      return candidate;
    }
    return containmentError(outputPath, realExportDir);
  }
}

function containmentError(outputPath: string, exportDir: string): Error {
  return new Error(
    `output_path "${outputPath}" must stay inside the export directory ` +
      `(${exportDir}); pass --export-dir (or DRAWIO_MCP_EXPORT_DIR) to change it`,
  );
}
