const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(str) {
  const m = SEMVER.exec(String(str ?? ""));
  return m
    ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
    : null;
}

export function cmpSemver(a, b) {
  for (const part of ["major", "minor", "patch"]) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1;
  }
  return 0;
}

// Conventional-commit BREAKING CHANGE footer (also the "BREAKING-CHANGE:"
// keying used by some tooling); matches anywhere in the body at a line start.
const BREAKING_FOOTER = /(^|\n)BREAKING[ -]CHANGE:?/im;

export function bumpLevel(commits) {
  let level = "patch";
  for (const { subject, body } of commits) {
    if (BREAKING_FOOTER.test(body ?? "")) return "major";
    const m = /^(\w+)(\([^)]*\))?(!)?:/.exec(subject ?? "");
    if (!m) continue;
    if (m[3] === "!") return "major";
    if (m[1] === "feat") level = "minor";
  }
  return level;
}

function bumpLevelBetween(prev, next) {
  if (next.major !== prev.major) return "major";
  if (next.minor !== prev.minor) return "minor";
  return "patch";
}

export function bumpVersion(parsed, level) {
  if (level === "major") return `${parsed.major + 1}.0.0`;
  if (level === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

export function resolveVersion({ scope, explicit, current, commits }) {
  const currentServer = parseSemver(current.server);
  if (!currentServer) {
    throw new Error(
      `invalid current version for drawio-mcp-server: "${current.server}" (expected X.Y.Z)`,
    );
  }
  const currentExtension = parseSemver(current.extension);
  if (!currentExtension) {
    throw new Error(
      `invalid current version for drawio-mcp-extension: "${current.extension}" (expected X.Y.Z)`,
    );
  }
  let level = bumpLevel(commits);
  let version;
  let source;
  if (explicit) {
    const parsed = parseSemver(explicit);
    if (!parsed)
      throw new Error(`invalid semver: "${explicit}" (expected X.Y.Z)`);
    version = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    const base = scope === "extension" ? currentExtension : currentServer;
    level = bumpLevelBetween(base, parsed);
    source = "explicit";
  } else {
    if (commits.length === 0) {
      throw new Error(
        `no commits found for scope "${scope}" since the last release; pass an explicit --version if you really want to release`,
      );
    }
    const base = scope === "extension" ? currentExtension : currentServer;
    version = bumpVersion(base, level);
    source = "computed";
  }

  const parsed = parseSemver(version);
  const floors = [];
  if (scope !== "extension") floors.push(["drawio-mcp-server", current.server]);
  if (scope !== "server")
    floors.push(["drawio-mcp-extension", current.extension]);
  for (const [name, cur] of floors) {
    if (cmpSemver(parsed, parseSemver(cur)) <= 0) {
      throw new Error(
        `version ${version} is not greater than ${name}'s current ${cur}`,
      );
    }
  }
  return { version, level, source };
}

export function validateTags({ scope, version, existingTags }) {
  const wanted = [];
  if (scope !== "extension") wanted.push(`v${version}`);
  if (scope !== "server") wanted.push(`drawio-mcp-extension-v${version}`);
  for (const tag of wanted) {
    if (existingTags.includes(tag))
      throw new Error(`tag ${tag} already exists`);
  }
}
