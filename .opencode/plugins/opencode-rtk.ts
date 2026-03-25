import type { Plugin } from "@opencode-ai/plugin";

// RTK OpenCode plugin — rewrites commands to use rtk for token savings.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.

function rewrite2(command: string): string {
  if (command.startsWith(`rtk`)) {
    return command;
  }

  const cmds = [
    "ls",
    "tree",
    "head",
    "git",
    "psql",
    "pnpm",
    "err",
    "test",
    "json",
    "env",
    "find",
    "diff",
    "log",
    "docker",
    "grep",
    "wget",
    "wc",
    "vitest",
    "tsc",
    "next",
    "lint",
    "prettier",
    "format",
    "playwright",
    "cargo",
    "npm",
    "npx",
    "curl",
    "verify",
    "ruff",
    "pytest",
    "mypy",
    "pip",
    "go",
    "golangci-lint",
  ];

  for (let i = 0; i < cmds.length; i++) {
    if (command.startsWith(cmds[i])) {
      return `rtk ${command}`;
    }
  }
  return `rtk proxy ${command}`;
}

export const RtkOpenCodePlugin: Plugin = async ({ $, client }) => {
  client.app.log({
    body: {
      service: "opencode-rtk",
      level: "info",
      message: `[rtk] here`,
    },
  });
  try {
    await $`which rtk`.quiet();
  } catch {
    console.warn("[rtk] rtk binary not found in PATH — plugin disabled");
    return {};
  }

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase();
      client.app.log({
        body: {
          service: "opencode-rtk",
          level: "info",
          message: `[rtk] kicks in ${tool}`,
        },
      });

      if (tool !== "bash" && tool !== "shell") return;
      const args = output?.args;
      if (!args || typeof args !== "object") return;

      const command = (args as Record<string, unknown>).command;
      if (typeof command !== "string" || !command) return;

      client.app.log({
        body: {
          service: "opencode-rtk",
          level: "info",
          message: `[rtk] going to rewrite ${command}`,
        },
      });
      try {
        // const result = await $`rtk rewrite ${command}`.quiet().nothrow();
        // const rewritten = String(result.stdout).trim();
        const rewritten = rewrite2(command);
        // const rewritten = command;
        client.app.log({
          body: {
            service: "opencode-rtk",
            level: "info",
            message: `[rtk] rewritten ${rewritten}`,
          },
        });
        if (rewritten && rewritten !== command) {
          (args as Record<string, unknown>).command = rewritten;
        }
      } catch {
        // rtk rewrite failed — pass through unchanged
        client.app.log({
          body: {
            service: "opencode-rtk",
            level: "warn",
            message: `[rtk] pass through ${command}`,
          },
        });
      }
    },
  };
};
