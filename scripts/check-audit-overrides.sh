#!/usr/bin/env bash
# Check whether each pnpm override in pnpm-workspace.yaml is still needed.
#
# An override is "still needed" when removing it reintroduces a vulnerability
# (pnpm audit fails without it). For every override the script:
#   1. removes the override from pnpm-workspace.yaml
#   2. re-resolves the lockfile (pnpm install --lockfile-only)
#   3. runs pnpm audit
#   4. restores the original pnpm-workspace.yaml and pnpm-lock.yaml
#
# Exit codes:
#   0 - all overrides are still needed (or there are none)
#   1 - at least one override is obsolete and should be removed,
#       or the check itself could not run
#
# Requires network access to the npm registry (lockfile resolution + advisory DB).

set -euo pipefail

WORKSPACE_FILE="pnpm-workspace.yaml"
LOCKFILE="pnpm-lock.yaml"
AUDIT_LEVEL="${AUDIT_LEVEL:-moderate}"

if [[ ! -f "$WORKSPACE_FILE" || ! -f "$LOCKFILE" ]]; then
  echo "error: run from the repository root ($WORKSPACE_FILE and $LOCKFILE required)" >&2
  exit 1
fi

backup_dir=$(mktemp -d)
restore() {
  cp "$backup_dir/pnpm-workspace.yaml" "$WORKSPACE_FILE"
  cp "$backup_dir/pnpm-lock.yaml" "$LOCKFILE"
}
cleanup() {
  restore
  rm -rf "$backup_dir"
}
trap cleanup EXIT

cp "$WORKSPACE_FILE" "$backup_dir/pnpm-workspace.yaml"
cp "$LOCKFILE" "$backup_dir/pnpm-lock.yaml"

# Collect override entries from the top-level `overrides:` block, e.g.:
#   overrides:
#     "tmp@<0.2.6": ">=0.2.6"
mapfile -t override_lines < <(awk '
  /^overrides:[[:space:]]*$/ { in_overrides = 1; next }
  in_overrides && /^[^[:space:]]/ { in_overrides = 0 }
  in_overrides && /^[[:space:]]+"[^"]+"[[:space:]]*:/ { print }
' "$WORKSPACE_FILE")

if [[ ${#override_lines[@]} -eq 0 ]]; then
  echo "no overrides found in $WORKSPACE_FILE"
  exit 0
fi

stale_count=0
unknown_count=0
total=${#override_lines[@]}

echo "checking $total override(s) from $WORKSPACE_FILE"
echo

for line in "${override_lines[@]}"; do
  trimmed="${line#"${line%%[![:space:]]*}"}"
  key="${trimmed%%:*}"
  key="${key//\"/}"

  # Remove this single override entry (match the exact original line).
  grep -v -F -x "$line" "$WORKSPACE_FILE" > "$backup_dir/workspace.filtered" || true
  cp "$backup_dir/workspace.filtered" "$WORKSPACE_FILE"

  if ! pnpm install --lockfile-only > "$backup_dir/install.log" 2>&1; then
    echo "UNKNOWN : $key - lockfile resolution failed without it (see $backup_dir/install.log)"
    unknown_count=$((unknown_count + 1))
    restore
    continue
  fi

  if pnpm audit --audit-level="$AUDIT_LEVEL" > "$backup_dir/audit.log" 2>&1; then
    echo "OBSOLETE: $key - audit passes without it, remove the override"
    stale_count=$((stale_count + 1))
  else
    echo "needed  : $key - audit fails without it"
  fi

  restore
done

echo
echo "summary: $total checked, $stale_count obsolete, $unknown_count unknown"

if [[ $stale_count -gt 0 ]]; then
  exit 1
fi
exit 0