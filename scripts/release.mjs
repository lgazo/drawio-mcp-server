#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolveVersion, validateTags } from "./release/version.mjs";
import { generateChangelog } from "./release/changelog.mjs";
import { applyBumps, getPackageVersion } from "./release/bump.mjs";
import { checkParity } from "./release/parity.mjs";

const SCOPE_PATHS = {
  server: [
    "packages/drawio-mcp-server/",
    "packages/drawio-mcp-plugin/",
    "packages/drawio-mcp-compat/",
  ],
  extension: ["packages/drawio-mcp-extension/", "packages/drawio-mcp-plugin/"],
  both: [
    "packages/drawio-mcp-server/",
    "packages/drawio-mcp-plugin/",
    "packages/drawio-mcp-compat/",
    "packages/drawio-mcp-extension/",
  ],
};

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1] ?? true;
    else out._.push(argv[i]);
  }
  return out;
}

function lastTag(pattern) {
  const tags = git("tag", "-l", pattern).trim().split("\n").filter(Boolean);
  if (tags.length === 0) return null;
  tags.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return tags[tags.length - 1];
}

// No-tag range: spec is `--max-count=1000000 HEAD`, i.e. two git arguments —
// passing it as one string makes git reject it ("'1000000 HEAD': not an integer").
function logArgs(range) {
  return range === null ? ["--max-count=1000000", "HEAD"] : [range];
}

// %x1f starts a record, %x1e separates fields. %b (commit body) is multi-line
// and shares newlines with the --name-only file list, so the file section is
// recovered as everything before/after the last blank line (git always
// separates the message block from the file list with a blank line, and git
// normalized messages end in a non-blank line).
function parseCommitRecord(record) {
  const lines = record.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const headParts = lines[0].split("\x1e");
  const subject = headParts[1];
  const hash = headParts[2];
  const bodyFirstLine = headParts[3] ?? "";
  const rest = lines.slice(1);
  let body = "";
  let fileStart = 0;
  if (bodyFirstLine !== "") {
    let lastBlank = -1;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].trim() === "") lastBlank = i;
    }
    body = [bodyFirstLine, ...rest.slice(0, lastBlank === -1 ? 0 : lastBlank)]
      .join("\n")
      .replace(/\n+$/, "");
    fileStart = lastBlank === -1 ? 0 : lastBlank + 1;
  }
  const files = rest
    .slice(fileStart)
    .map((l) => l.trim())
    .filter(Boolean);
  return { subject, hash, body, files };
}

function commitsSince(range, prefixes) {
  const raw = git(
    "log",
    ...logArgs(range),
    "--name-only",
    "--pretty=format:%x1f%x1e%s%x1e%h%x1e%b",
  );
  const commits = [];
  for (const record of raw.split("\x1f")) {
    if (!record.trim()) continue;
    const { subject, hash, body, files } = parseCommitRecord(record);
    if (files.some((f) => prefixes.some((p) => f.startsWith(p)))) {
      commits.push({ subject, hash, body, files });
    }
  }
  return commits;
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (cmd === "resolve" || cmd === "changelog") {
  const scope = args.scope ?? fail("missing --scope");
  const prefixes = SCOPE_PATHS[scope] ?? fail(`invalid scope: ${scope}`);
  const pattern = scope === "extension" ? "drawio-mcp-extension-v*" : "v[0-9]*";
  const tag = lastTag(pattern);
  const range = tag ? `${tag}..HEAD` : null;
  const commits = commitsSince(range, prefixes);

  if (cmd === "resolve") {
    try {
      const result = resolveVersion({
        scope,
        explicit: args.version === undefined ? null : String(args.version),
        current: {
          server: getPackageVersion("packages/drawio-mcp-server/package.json"),
          extension: getPackageVersion(
            "packages/drawio-mcp-extension/package.json",
          ),
        },
        commits,
      });
      validateTags({
        scope,
        version: result.version,
        existingTags: git("tag", "-l").trim().split("\n").filter(Boolean),
      });
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (e) {
      fail(e.message);
    }
  } else {
    if (args.version === undefined) fail("missing --version");
    process.stdout.write(
      generateChangelog({ version: String(args.version), commits }),
    );
  }
} else if (cmd === "bump") {
  const scope = args.scope ?? fail("missing --scope");
  if (args.version === undefined) fail("missing --version");
  let compatChanged = args["compat-changed"] ?? "auto";
  if (compatChanged === "auto") {
    const lt = lastTag("v[0-9]*");
    const range = lt ? `${lt}..HEAD` : null;
    compatChanged =
      git(
        "log",
        ...logArgs(range),
        "--oneline",
        "--",
        "packages/drawio-mcp-compat",
      ).trim().length > 0;
  } else {
    compatChanged = compatChanged === "1";
  }
  const { changed } = applyBumps({
    root: ".",
    scope,
    version: String(args.version),
    compatChanged,
  });
  process.stdout.write(changed.join("\n") + "\n");
} else if (cmd === "check-parity") {
  if (args.version === undefined) fail("missing --version");
  const { ok, errors } = checkParity({
    root: ".",
    version: String(args.version),
  });
  if (!ok) fail(errors.join("\n"));
  process.stdout.write("ok\n");
} else {
  fail(`unknown or missing subcommand: ${cmd}`);
}
