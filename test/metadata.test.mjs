import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCards, compareVersions, githubRepoOf, packageRootOf, readManagedStates, scanPatchInsertIds, sourceOf, writeManagedStates } from "../lib/index.js";

function makePackage(dir, name, version, description = "") {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, description }), "utf8");
}

test("packageRootOf separates package roots and system pseudo-modules", () => {
	assert.equal(packageRootOf("@scope/package/subpath"), "@scope/package");
	assert.equal(packageRootOf("dsh-plugin/subpath"), "dsh-plugin");
	assert.equal(packageRootOf("cordis:include"), "");
	assert.equal(packageRootOf("cordis:include:agent-presets:x"), "");
});

test("sourceOf distinguishes GitHub, local and registry specs", () => {
	assert.deepEqual(sourceOf("github:owner/repo#main"), { kind: "github", spec: "github:owner/repo#main", owner: "owner", repo: "repo", ref: "main" });
	assert.equal(sourceOf("git+https://github.com/owner/repo.git#main").kind, "github");
	assert.equal(sourceOf("git@github.com:owner/repo.git#abc").kind, "github");
	assert.equal(sourceOf("file:/tmp/example.tgz").kind, "local");
	assert.equal(sourceOf("^1.2.3").kind, "registry");
});

test("GitHub upstream metadata and version comparison are parsed safely", () => {
	assert.deepEqual(githubRepoOf({ type: "git", url: "git+https://github.com/example/plugin.git" }), { owner: "example", repo: "plugin" });
	assert.deepEqual(githubRepoOf(undefined, "https://github.com/example/plugin#readme"), { owner: "example", repo: "plugin" });
	assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
	assert.equal(compareVersions("v1.2.0", "1.2.0"), 0);
	assert.equal(compareVersions("1.2.0-beta.1", "1.2.0"), -1);
	assert.equal(compareVersions("not-a-version", "1.2.0"), null);
});

test("managed block changes preserve surrounding user patch text", () => {
	const source = "# user patch\n- id: existing\n  disabled: false\n";
	const written = writeManagedStates(source, new Map([["alpha", true], ["beta", false]]));
	assert.match(written, /# user patch/);
	assert.match(written, /# >>> dsh-my-plugins managed states >>>/);
	assert.deepEqual(readManagedStates(written), new Map([["alpha", true], ["beta", false]]));
	assert.equal(writeManagedStates(written, new Map()), source);
});

test("scanPatchInsertIds finds top-level insert rows", () => {
	const text = "- insert:\n    - id: demo\n      name: dsh-demo\n    - id: second\n      name: dsh-second\n";
	assert.deepEqual(scanPatchInsertIds(text), ["demo", "second"]);
});

test("buildCards excludes in-box/subpath/include entries and retains local installed package", async () => {
	const home = mkdtempSync(join(tmpdir(), "dsh-my-plugins-"));
	const profile = join(home, "profiles", "web");
	makePackage(join(home, "profiles", "node_modules", "@deepseek-ai", "dsh-web-app"), "@deepseek-ai/dsh-web-app", "1.0.0");
	makePackage(join(profile, "node_modules", "dsh-local"), "dsh-local", "2.3.4", "Local plugin");
	makePackage(join(profile, "node_modules", "dsh-registry"), "dsh-registry", "1.0.0", "Registry plugin");
	mkdirSync(profile, { recursive: true });
	writeFileSync(join(profile, "package.json"), JSON.stringify({ dependencies: { "dsh-local": "file:/tmp/dsh-local", "dsh-registry": "^1.0.0" } }), "utf8");
	writeFileSync(join(profile, "cordis.patch.yml"), "[]\n", "utf8");
	const loader = {
		*entries() {
			yield { id: "include", options: { name: "cordis:include" }, disabled: false, fiber: undefined };
			yield { id: "web-startup", options: { name: "@deepseek-ai/dsh-web-app/startup", id: "web-startup" }, disabled: false, fiber: { state: 2 } };
			yield { id: "include:local", options: { name: "dsh-local", id: "local" }, disabled: false, fiber: { state: 2 } };
			yield { id: "include:registry", options: { name: "dsh-registry", id: "registry" }, disabled: false, fiber: { state: 2 } };
		}
	};
	const result = buildCards(loader, home);
	assert.equal(result.cards.length, 2);
	const local = result.cards.find((card) => card.packageName === "dsh-local");
	const registry = result.cards.find((card) => card.packageName === "dsh-registry");
	assert.equal(local.version, "2.3.4");
	assert.equal(local.description, "Local plugin");
	assert.equal(local.source.kind, "local");
	assert.deepEqual(local.entryIds, ["local"]);
	assert.equal(registry.source.kind, "registry");
	assert.equal(registry.management.canCheckUpdate, true);
});
