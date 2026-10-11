import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@jest/globals";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("marketplace manifest", () => {
	const marketplacePath = join(
		__dirname,
		"..",
		"..",
		"..",
		".claude-plugin",
		"marketplace.json",
	);
	const schemaPath = join(__dirname, "fixtures", "marketplace.schema.json");

	it("exists at the repo root", () => {
		expect(existsSync(marketplacePath)).toBe(true);
	});

	it("validates against the marketplace schema", () => {
		const manifest = JSON.parse(readFileSync(marketplacePath, "utf8"));
		const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
		const ajv = new Ajv();
		const validate = ajv.compile(schema);
		const ok = validate(manifest);
		expect({ ok, errors: validate.errors }).toEqual({ ok: true, errors: null });
	});

	it("plugin source resolves to the plugin package directory", () => {
		const manifest = JSON.parse(readFileSync(marketplacePath, "utf8"));
		const plug = manifest.plugins.find(
			(p: { name: string }) => p.name === "drawio",
		);
		expect(plug).toBeTruthy();
		const sourcePath =
			typeof plug.source === "string"
				? plug.source
				: plug.source?.path ?? plug.source?.source;
		const abs = join(marketplacePath, "..", "..", sourcePath);
		expect(existsSync(join(abs, ".claude-plugin", "plugin.json"))).toBe(true);
	});

	it("plugin version matches package plugin.json version", () => {
		const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
		const pluginManifest = JSON.parse(
			readFileSync(
				join(__dirname, "..", ".claude-plugin", "plugin.json"),
				"utf8",
			),
		);
		const plug = marketplace.plugins.find(
			(p: { name: string }) => p.name === "drawio",
		);
		expect(plug.version).toBe(pluginManifest.version);
	});
});
