import test from "node:test";
import assert from "node:assert/strict";
import { generateChangelog } from "./changelog.mjs";

test("groups conventional commits and omits empty groups", () => {
  const md = generateChangelog({
    version: "2.4.0",
    commits: [
      { subject: "feat: new tool", hash: "abc1234" },
      { subject: "feat!: breaking change", hash: "777aaa1" },
      { subject: "fix(server): crash on close", hash: "def5678" },
      { subject: "docs: readme", hash: "9ab0123" },
      { subject: "chore: deps", hash: "bbb2222" },
    ],
  });
  assert.equal(
    md,
    `## 2.4.0

### Features

- feat: new tool (abc1234)
- feat!: breaking change (777aaa1)

### Bug Fixes

- fix(server): crash on close (def5678)

### Documentation

- docs: readme (9ab0123)

### Chores

- chore: deps (bbb2222)
`,
  );
});

test("non-conventional subjects land under Chores", () => {
  const md = generateChangelog({
    version: "1.0.1",
    commits: [{ subject: "Merge pull request #1", hash: "aaa1111" }],
  });
  assert.doesNotMatch(md, /### Features/);
  assert.match(md, /### Chores\n\n- Merge pull request #1 \(aaa1111\)/);
});
