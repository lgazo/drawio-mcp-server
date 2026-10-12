import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSemver,
  cmpSemver,
  bumpLevel,
  bumpVersion,
  resolveVersion,
  validateTags,
} from "./version.mjs";

test("parseSemver accepts strict X.Y.Z and rejects the rest", () => {
  assert.deepEqual(parseSemver("2.3.0"), { major: 2, minor: 3, patch: 0 });
  assert.equal(parseSemver("v2.3.0"), null);
  assert.equal(parseSemver("2.3"), null);
  assert.equal(parseSemver("2.3.0-beta"), null);
});

test("cmpSemver orders versions", () => {
  const a = parseSemver("2.9.0");
  const b = parseSemver("2.10.0");
  assert.equal(cmpSemver(a, b), -1);
  assert.equal(cmpSemver(b, a), 1);
  assert.equal(cmpSemver(a, parseSemver("2.9.0")), 0);
});

test("bumpLevel reads conventional commit subjects", () => {
  assert.equal(bumpLevel([{ subject: "feat: x" }]), "minor");
  assert.equal(bumpLevel([{ subject: "fix(server): y" }]), "patch");
  assert.equal(bumpLevel([{ subject: "feat!: breaking" }]), "major");
  assert.equal(bumpLevel([{ subject: "feat: a" }, { subject: "fix: b" }]), "minor");
  assert.equal(bumpLevel([{ subject: "feat!: a" }, { subject: "fix: b" }]), "major");
  assert.equal(bumpLevel([{ subject: "docs: a" }]), "patch");
  assert.equal(bumpLevel([]), "patch");
});

test("bumpLevel handles scoped breaking changes", () => {
  assert.equal(bumpLevel([{ subject: "fix(api)!: x" }]), "major");
  assert.equal(bumpLevel([{ subject: "fix(api): x" }]), "patch");
});

test("bumpVersion increments the right digit", () => {
  const base = parseSemver("2.3.4");
  assert.equal(bumpVersion(base, "patch"), "2.3.5");
  assert.equal(bumpVersion(base, "minor"), "2.4.0");
  assert.equal(bumpVersion(base, "major"), "3.0.0");
});

test("resolveVersion computed for server scope bumps the server line", () => {
  const r = resolveVersion({
    scope: "server",
    explicit: null,
    current: { server: "2.3.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: new tool", files: ["packages/drawio-mcp-server/src/x.ts"] },
    ],
  });
  assert.deepEqual(r, { version: "2.4.0", level: "minor", source: "computed" });
});

test("resolveVersion computed for extension scope bumps the extension line", () => {
  const r = resolveVersion({
    scope: "extension",
    explicit: null,
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: ui", files: ["packages/drawio-mcp-extension/x.ts"] },
    ],
  });
  assert.deepEqual(r, { version: "2.4.0", level: "minor", source: "computed" });
});

test("resolveVersion both scope computes from the server line", () => {
  const r = resolveVersion({
    scope: "both",
    explicit: null,
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: shared", files: ["packages/drawio-mcp-plugin/src/x.ts"] },
    ],
  });
  assert.equal(r.version, "2.5.0");
});

test("resolveVersion explicit override wins and validates monotonicity", () => {
  const ok = resolveVersion({
    scope: "both",
    explicit: "3.0.0",
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [],
  });
  assert.deepEqual(ok, { version: "3.0.0", level: "major", source: "explicit" });

  assert.throws(() =>
    resolveVersion({
      scope: "both",
      explicit: "2.3.0",
      current: { server: "2.4.0", extension: "2.3.0" },
      commits: [],
    }),
  );
  assert.throws(() =>
    resolveVersion({
      scope: "both",
      explicit: "not-semver",
      current: { server: "2.4.0", extension: "2.3.0" },
      commits: [],
    }),
  );
});

test("resolveVersion computed with zero relevant commits fails", () => {
  assert.throws(() =>
    resolveVersion({
      scope: "server",
      explicit: null,
      current: { server: "2.3.0", extension: "2.3.0" },
      commits: [],
    }),
  );
});

test("validateTags rejects existing tags for the scope", () => {
  assert.throws(() =>
    validateTags({ scope: "both", version: "2.4.0", existingTags: ["v2.4.0"] }),
  );
  assert.throws(() =>
    validateTags({
      scope: "extension",
      version: "2.4.0",
      existingTags: ["drawio-mcp-extension-v2.4.0"],
    }),
  );
  validateTags({ scope: "server", version: "2.4.0", existingTags: ["v2.3.0"] });
  validateTags({ scope: "extension", version: "2.4.0", existingTags: ["v2.4.0"] });
});
