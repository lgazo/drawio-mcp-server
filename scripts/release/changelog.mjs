const GROUPS = [
  ["Features", (type) => type === "feat"],
  ["Bug Fixes", (type) => type === "fix"],
  ["Documentation", (type) => type === "docs"],
];

function bucketOf(subject) {
  const m = /^(\w+)(\([^)]*\))?(!)?:/.exec(subject);
  if (m) {
    const group = GROUPS.find(([, matches]) => matches(m[1]));
    if (group) return group[0];
  }
  return "Chores";
}

export function generateChangelog({ version, commits }) {
  const buckets = new Map();
  const seen = new Set();
  for (const commit of commits) {
    if (seen.has(commit.hash)) continue;
    seen.add(commit.hash);
    const bucket = bucketOf(commit.subject);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(`- ${commit.subject} (${commit.hash})`);
  }
  const order = [...GROUPS.map(([name]) => name), "Chores"];
  const lines = [`## ${version}`];
  for (const name of order) {
    const entries = buckets.get(name);
    if (!entries || entries.length === 0) continue;
    lines.push("", `### ${name}`, "", ...entries);
  }
  return lines.join("\n") + "\n";
}
