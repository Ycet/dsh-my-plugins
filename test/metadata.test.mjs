import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertUpdateApplied, buildCards, compareVersions, existingDependency, githubRepoOf, localSpecPath, missingLocalDependency, packageRootOf, readManagedStates, resolveInstallSpec, scanPatchInsertIds, sourceOf, splitNpmInput, summarizeCliError, updateArgsFor, writeManagedStates } from "../lib/index.js";

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

test("Registry updates pin the target version and reject false-success results", () => {
	const card = { packageName: "dsh-example", version: "0.12.3", source: { kind: "registry" } };
	const check = { latestVersion: "0.13.1" };
	assert.deepEqual(updateArgsFor(card, check), ["add", "dsh-example@0.13.1"]);
	assert.throws(() => assertUpdateApplied(card, { version: "0.12.3" }, check), /未达到目标/);
	assert.doesNotThrow(() => assertUpdateApplied(card, { version: "0.13.1" }, check));
});

test("dependency health check identifies missing local tarballs before pnpm runs", () => {
	const profile = mkdtempSync(join(tmpdir(), "dsh-profile-"));
	mkdirSync(join(profile, ".dsh-plugin-cache"), { recursive: true });
	writeFileSync(join(profile, ".dsh-plugin-cache", "present.tgz"), "fixture", "utf8");
	const dependencies = {
		"present-plugin": "file:.dsh-plugin-cache/present.tgz",
		"missing-plugin": "file:.dsh-plugin-cache/missing.tgz",
		"registry-plugin": "^1.0.0"
	};
	assert.equal(localSpecPath("file:.dsh-plugin-cache/present.tgz", profile), join(profile, ".dsh-plugin-cache", "present.tgz"));
	assert.deepEqual(missingLocalDependency(profile, dependencies), {
		packageName: "missing-plugin",
		spec: "file:.dsh-plugin-cache/missing.tgz",
		path: join(profile, ".dsh-plugin-cache", "missing.tgz")
	});
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

test("github install specs validate owner/repo with optional ref", () => {
	assert.deepEqual(resolveInstallSpec("github", "Ycet/dsh-my-plugins"), { ok: true, spec: "github:Ycet/dsh-my-plugins", packageName: null });
	assert.deepEqual(resolveInstallSpec("github", "Ycet/dsh-my-plugins#main"), { ok: true, spec: "github:Ycet/dsh-my-plugins#main", packageName: null });
	assert.deepEqual(resolveInstallSpec("github", "owner/plugin#feat/bar"), { ok: true, spec: "github:owner/plugin#feat/bar", packageName: null });
	assert.equal(resolveInstallSpec("github", "owner").ok, false, "缺少斜杠应拒绝");
	assert.equal(resolveInstallSpec("github", "owner/repo#bad ref").ok, false, "含空白的 ref 应拒绝");
	assert.equal(resolveInstallSpec("github", "owner/repo#").ok, false, "空 ref 应拒绝");
	assert.equal(resolveInstallSpec("github", "").ok, false, "空输入应拒绝");
});

test("link install specs read the package name from source package.json", () => {
	const dir = mkdtempSync(join(tmpdir(), "dsh-link-"));
	makePackage(dir, "dsh-example", "1.0.0");
	assert.deepEqual(resolveInstallSpec("link", dir), { ok: true, spec: `dsh-example@link:${dir}`, packageName: "dsh-example" });
	assert.equal(resolveInstallSpec("link", join(dir, "missing")).ok, false, "不存在的路径应拒绝");
	assert.equal(resolveInstallSpec("link", "relative/path").ok, false, "相对路径应拒绝");
	const empty = mkdtempSync(join(tmpdir(), "dsh-link-empty-"));
	assert.equal(resolveInstallSpec("link", empty).ok, false, "缺少 package.json 应拒绝");
	const badName = mkdtempSync(join(tmpdir(), "dsh-link-name-"));
	makePackage(badName, "Bad-Name", "1.0.0");
	assert.equal(resolveInstallSpec("link", badName).ok, false, "非法包名应拒绝");
});

test("file install specs accept directories, tarballs and reject the rest", () => {
	const dir = mkdtempSync(join(tmpdir(), "dsh-file-"));
	assert.deepEqual(resolveInstallSpec("file", dir), { ok: true, spec: `file:${dir}`, packageName: null });
	const tarball = join(dir, "example-1.0.0.tgz");
	writeFileSync(tarball, "fixture", "utf8");
	assert.deepEqual(resolveInstallSpec("file", tarball), { ok: true, spec: `file:${tarball}`, packageName: null });
	assert.equal(resolveInstallSpec("file", join(dir, "missing.tgz")).ok, false, "不存在的路径应拒绝");
	assert.equal(resolveInstallSpec("file", "relative/path").ok, false, "相对路径应拒绝");
});

test("npm install specs parse names with optional versions and scopes", () => {
	assert.deepEqual(resolveInstallSpec("npm", "dsh-example"), { ok: true, spec: "dsh-example", packageName: "dsh-example" });
	assert.deepEqual(resolveInstallSpec("npm", "dsh-example@1.2.3"), { ok: true, spec: "dsh-example@1.2.3", packageName: "dsh-example" });
	assert.deepEqual(resolveInstallSpec("npm", "dsh-example@next"), { ok: true, spec: "dsh-example@next", packageName: "dsh-example" });
	assert.deepEqual(resolveInstallSpec("npm", "@scope/plugin"), { ok: true, spec: "@scope/plugin", packageName: "@scope/plugin" });
	assert.deepEqual(resolveInstallSpec("npm", "@scope/plugin@0.1.0"), { ok: true, spec: "@scope/plugin@0.1.0", packageName: "@scope/plugin" });
	assert.equal(resolveInstallSpec("npm", "Bad-Name").ok, false, "大写包名应拒绝");
	assert.equal(resolveInstallSpec("npm", "dsh-example@").ok, false, "空版本应拒绝");
	assert.equal(resolveInstallSpec("npm", "dsh-example@1 2").ok, false, "含空白版本应拒绝");
	assert.equal(resolveInstallSpec("npm", "@scope").ok, false, "残缺 scoped 包名应拒绝");
	assert.equal(splitNpmInput("dsh-example@1.0.0").name, "dsh-example");
	assert.equal(splitNpmInput("@scope/plugin@1.0.0").version, "1.0.0");
	assert.equal(splitNpmInput("@scope/plugin").name, "@scope/plugin");
});

test("existingDependency finds a duplicate spec only when installed", () => {
	assert.equal(existingDependency({ "dsh-example": "github:owner/repo" }, "dsh-example"), "github:owner/repo");
	assert.equal(existingDependency({ "dsh-example": "^1.0.0" }, "other"), null);
	assert.equal(existingDependency({}, "dsh-example"), null);
	assert.equal(existingDependency({ "dsh-example": "" }, "dsh-example"), null);
});

test("summarizeCliError strips ANSI and trims pnpm noise", () => {
	const output = "\u001b[31mERR_PNPM_ADD_PACKAGE_FAILED\u001b[39m\r\nProgress: resolved 10, reused 5\r\n  error output line\r\n";
	const summary = summarizeCliError(output);
	assert.ok(!summary.includes("Progress:"), "进度行应被剔除");
	assert.ok(!summary.includes("\u001b"), "ANSI 序列应被剥离");
	assert.ok(summary.includes("ERR_PNPM_ADD_PACKAGE_FAILED"));
	assert.equal(summarizeCliError(""), "安装命令执行失败");
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
