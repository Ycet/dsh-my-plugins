// dsh-my-plugins — host half
// 「我的插件」页面的数据与管理 API：包级列表、启停、GitHub 更新检查/更新、移除、安装。
import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

export const name = "dsh-my-plugins";
export const inject = ["webServer"];

const PHASES = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };
const PREFIX = "/my-plugins/api";
const PATCH_BEGIN = "# >>> dsh-my-plugins managed states >>>";
const PATCH_END = "# <<< dsh-my-plugins managed states <<<";

/** 模块名 → npm 包根；Cordis/Include 伪模块返回空字符串。 */
export function packageRootOf(moduleName) {
	if (typeof moduleName !== "string" || moduleName.length === 0 || moduleName.includes(":")) return "";
	const first = moduleName.indexOf("/");
	if (!moduleName.startsWith("@")) return first === -1 ? moduleName : moduleName.slice(0, first);
	const second = moduleName.indexOf("/", first + 1);
	return second === -1 ? moduleName : moduleName.slice(0, second);
}

/** 提取手工 patch 中顶层 insert 块的 entry id（仅块式 YAML）。 */
export function scanPatchInsertIds(text) {
	const ids = [];
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const head = lines[i];
		if (!/^-\s/.test(head)) continue;
		// 常见格式是顶层 `- insert:`，因此先检查当前行；随后只读取其缩进子树。
		let inInsert = /^insert:(\s|$)/.test(head.slice(2).trim());
		const insertIndent = 0;
		for (let j = i + 1; j < lines.length && !/^-\s/.test(lines[j]); j++) {
			const body = lines[j];
			const trimmed = body.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const indent = body.length - body.replace(/^\s+/, "").length;
			if (!inInsert) {
				if (/^insert:(\s|$)/.test(trimmed)) inInsert = true;
				continue;
			}
			if (indent <= insertIndent) { inInsert = false; continue; }
			const match = trimmed.match(/^- id:\s*(.+)$/);
			if (!match) continue;
			let value = match[1].trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
			else value = value.replace(/\s+#.*$/, "").trim();
			if (value) ids.push(value);
		}
	}
	return ids;
}

/** 解析本插件维护的 disabled 覆盖块。 */
export function readManagedStates(text) {
	const states = new Map();
	const begin = text.indexOf(PATCH_BEGIN);
	const end = begin < 0 ? -1 : text.indexOf(PATCH_END, begin + PATCH_BEGIN.length);
	if (begin < 0 || end < 0) return states;
	const block = text.slice(begin + PATCH_BEGIN.length, end);
	const lines = block.split(/\r?\n/);
	let id = null;
	for (const line of lines) {
		const idMatch = line.match(/^\s*-\s+id:\s*(.+)$/);
		if (idMatch) { id = idMatch[1].trim().replace(/^['"]|['"]$/g, ""); continue; }
		const disabledMatch = line.match(/^\s+disabled:\s*(true|false)\s*$/);
		if (id && disabledMatch) states.set(id, disabledMatch[1] === "true");
	}
	return states;
}

/** 仅替换本插件专属 managed block，保留用户其余 patch 原文。 */
export function writeManagedStates(text, states) {
	const rows = [...states.entries()].sort(([left], [right]) => left.localeCompare(right));
	const block = rows.length === 0 ? "" : `${PATCH_BEGIN}\n${rows.map(([id, disabled]) => `- id: ${id}\n  disabled: ${disabled ? "true" : "false"}`).join("\n")}\n${PATCH_END}\n`;
	const begin = text.indexOf(PATCH_BEGIN);
	const end = begin < 0 ? -1 : text.indexOf(PATCH_END, begin + PATCH_BEGIN.length);
	let base = text;
	if (begin >= 0 && end >= 0) base = text.slice(0, begin) + text.slice(end + PATCH_END.length).replace(/^\r?\n/, "");
	base = base.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
	if (!block) return base.replace(/\n{2,}$/g, "\n").endsWith("\n") ? base.replace(/\n{2,}$/g, "\n") : `${base.replace(/\n{2,}$/g, "\n")}\n`;
	if (!base.endsWith("\n")) base += "\n";
	if (base.trim().length > 0 && !base.endsWith("\n\n")) base += "\n";
	return base + block;
}

/** 原子写文本，避免 HMR 在半写入文件时读取。 */
function atomicWrite(path, content) {
	const tmp = `${path}.dsh-my-plugins-${process.pid}.tmp`;
	writeFileSync(tmp, content, "utf8");
	renameSync(tmp, path);
}

/** 将 package.json dependency spec 分类。file/link/tgz 永远是本地快照；Git spec 是直接 GitHub 安装；其余为 npm Registry。 */
export function sourceOf(spec) {
	if (typeof spec !== "string") return { kind: "unknown", spec: "" };
	if (spec.startsWith("file:") || spec.startsWith("link:") || spec.endsWith(".tgz") || spec.startsWith(".") || spec.startsWith("/")) return { kind: "local", spec };
	let match = /^github:([^/\s#]+)\/([^#\s]+)(?:#(.+))?$/.exec(spec);
	if (!match) match = /^(?:git\+)?https:\/\/github\.com\/([^/\s]+)\/([^/#\s]+?)(?:\.git)?(?:#(.+))?$/.exec(spec);
	if (!match) match = /^git@github\.com:([^/\s]+)\/([^#\s]+?)(?:\.git)?(?:#(.+))?$/.exec(spec);
	if (match) return { kind: "github", spec, owner: match[1], repo: match[2], ref: match[3] || null };
	return { kind: "registry", spec };
}

/** 解析 local dependency 的真实文件/目录路径；相对 file: spec 相对于 profile 目录。 */
export function localSpecPath(spec, profileDir) {
	if (typeof spec !== "string") return null;
	let raw = null;
	if (spec.startsWith("file:")) raw = spec.slice(5);
	else if (spec.startsWith("link:")) raw = spec.slice(5);
	else if (spec.startsWith(".") || spec.startsWith("/")) raw = spec;
	if (!raw) return null;
	return resolve(profileDir, raw);
}

/** 返回 profile 中第一个不可解析的本地依赖；pnpm 会因它阻断任何其他包的更新。 */
export function missingLocalDependency(profileDir, dependencies) {
	for (const [packageName, spec] of Object.entries(dependencies || {})) {
		if (sourceOf(spec).kind !== "local") continue;
		const path = localSpecPath(spec, profileDir);
		if (path && !existsSync(path)) return { packageName, spec, path };
	}
	return null;
}

/** npm 包名（不含版本）；接近 npm 官方命名规则：小写字母/数字/`-` `_` `.` `~`，可选 `@scope/` 前缀。 */
const NPM_NAME_PATTERN = /^(?:@[a-z0-9-~][a-z0-9._~-]*\/)?[a-z0-9-~][a-z0-9._~-]*$/;
/** npm 版本/tag/范围片段：首个字符放宽到字母数字，后续为常规 spec 字符（不含空白，避免注入与模糊范围）。 */
const NPM_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+*~^<>=|()\-]*$/;
/** GitHub 仓库地址：owner/repo（可选 `#ref`，ref 允许含 `/` 的分支）。 */
const GITHUB_INPUT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:#[A-Za-z0-9._\/-]+)?$/;

/** 拆分 npm 输入为「包名 + 可选版本」；非法结构返回 null。 */
export function splitNpmInput(input) {
	if (typeof input !== "string") return null;
	let name = input;
	let version = null;
	if (input.startsWith("@")) {
		const slash = input.indexOf("/");
		if (slash < 0) return null;
		const tail = input.slice(slash + 1);
		const at = tail.lastIndexOf("@");
		name = at < 0 ? input : `${input.slice(0, slash + 1)}${tail.slice(0, at)}`;
		version = at < 0 ? null : tail.slice(at + 1);
	} else {
		const at = input.lastIndexOf("@");
		if (at > 0) { name = input.slice(0, at); version = input.slice(at + 1); }
		else name = input;
	}
	if (!name || version === "") return null;
	return { name, version };
}

/**
 * 把用户输入解析为可交给 `dsh plugin ... add <spec>` 的安装说明符。
 * - github: `owner/repo`（可附 `#ref`）→ `github:owner/repo[#ref]`
 * - link: 绝对目录路径，自动读取 `package.json` 的 `name` → `<name>@link:<path>`
 * - file: 绝对路径（源码目录或 .tgz 归档）→ `file:<path>`
 * - npm: `包名` 或 `包名@版本`（支持 scoped）→ 原样规范化
 */
export function resolveInstallSpec(kind, input) {
	const value = typeof input === "string" ? input.trim() : "";
	if (!value) return { ok: false, error: "请输入安装内容" };
	if (kind === "github") {
		if (!GITHUB_INPUT_PATTERN.test(value)) return { ok: false, error: "GitHub 仓库地址格式不正确，应为 owner/repo（可附 #分支或tag）" };
		return { ok: true, spec: `github:${value}`, packageName: null };
	}
	if (kind === "link") {
		if (!value.startsWith("/")) return { ok: false, error: "link 安装需要源码目录的绝对路径（以 / 开头）" };
		let stats = null;
		try { stats = statSync(value); } catch { return { ok: false, error: `路径不存在：${value}` }; }
		if (!stats.isDirectory()) return { ok: false, error: "link 安装需要源码目录的绝对路径" };
		const manifest = readJson(join(value, "package.json"));
		if (typeof manifest.name !== "string" || !NPM_NAME_PATTERN.test(manifest.name)) return { ok: false, error: `无法从 ${join(value, "package.json")} 读取有效的包名（name）` };
		return { ok: true, spec: `${manifest.name}@link:${value}`, packageName: manifest.name };
	}
	if (kind === "file") {
		if (!value.startsWith("/")) return { ok: false, error: "file 安装需要本地绝对路径（以 / 开头）" };
		if (!existsSync(value)) return { ok: false, error: `路径不存在：${value}` };
		return { ok: true, spec: `file:${value}`, packageName: null };
	}
	if (kind === "npm") {
		const parsed = splitNpmInput(value);
		if (!parsed || !NPM_NAME_PATTERN.test(parsed.name)) return { ok: false, error: "npm 包名格式不正确（小写字母、数字、- _ . ~，可含 @scope/ 前缀）" };
		if (parsed.version !== null && !NPM_VERSION_PATTERN.test(parsed.version)) return { ok: false, error: "npm 版本/tag 格式不正确" };
		return { ok: true, spec: parsed.version === null ? parsed.name : `${parsed.name}@${parsed.version}`, packageName: parsed.name };
	}
	return { ok: false, error: `未知的安装方式：${kind}` };
}

/** 在 profile dependencies 中查找同名已安装包；未安装返回 null。 */
export function existingDependency(dependencies, packageName) {
	if (typeof packageName !== "string" || !packageName) return null;
	const spec = dependencies?.[packageName];
	return typeof spec === "string" && spec ? spec : null;
}

/** 从 package.json repository/homepage 读取 GitHub 上游仓库；该信息不改变实际安装来源。 */
export function githubRepoOf(repository, homepage) {
	const raw = typeof repository === "string" ? repository : repository && typeof repository.url === "string" ? repository.url : typeof homepage === "string" ? homepage : "";
	const value = raw.replace(/^git\+/, "").replace(/#.*$/, "");
	let match = /github\.com[/:]([^/\s]+)\/([^/#\s]+?)(?:\.git)?$/.exec(value);
	if (!match) match = /^github:([^/\s]+)\/([^/#\s]+)$/.exec(value);
	return match ? { owner: match[1], repo: match[2] } : null;
}

/** 比较常规语义版本；无法比较时返回 null，避免伪造更新判断。 */
export function compareVersions(left, right) {
	const parse = (value) => {
		const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([^+]+))?(?:\+.+)?$/.exec(String(value || "").trim());
		return match ? { numbers: [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)], prerelease: match[4] || "" } : null;
	};
	const a = parse(left);
	const b = parse(right);
	if (!a || !b) return null;
	for (let i = 0; i < a.numbers.length; i++) if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i] ? 1 : -1;
	if (a.prerelease === b.prerelease) return 0;
	if (!a.prerelease) return 1;
	if (!b.prerelease) return -1;
	return a.prerelease > b.prerelease ? 1 : -1;
}

/** 只读 package manifest，失败时返回空对象。 */
function readJson(path) {
	try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}

/** 从 package manifest / lockfile 尽力读取当前 Git commit。 */
function installedGitCommit(packageManifest, lockText, source) {
	if (typeof packageManifest.gitHead === "string" && /^[0-9a-f]{7,40}$/i.test(packageManifest.gitHead)) return packageManifest.gitHead;
	if (source.kind !== "github" || !lockText) return null;
	const ownerRepo = `${source.owner}/${source.repo}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const expressions = [
		new RegExp(`${ownerRepo}[^\n]{0,300}(?:commit|#|/)([0-9a-f]{40})`, "i"),
		new RegExp(`github\\.com[/:]${ownerRepo}[^\n]{0,300}([0-9a-f]{40})`, "i")
	];
	for (const expression of expressions) {
		const match = expression.exec(lockText);
		if (match) return match[1];
	}
	return null;
}

/** 读取 profile 与安装包路径；以命中 Loader 本地包的 profile 为首选。 */
function resolveProfile(dshHome, loader) {
	const profilesRoot = join(dshHome, "profiles");
	let names = [];
	try { names = readdirSync(profilesRoot, { withFileTypes: true }).filter((row) => row.isDirectory() && row.name !== "node_modules").map((row) => row.name); } catch { /* no profiles */ }
	const entryRoots = new Set();
	for (const entry of loader.entries()) {
		const root = packageRootOf(entry.options?.name || "");
		if (root) entryRoots.add(root);
	}
	for (const name of names) {
		const dir = join(profilesRoot, name);
		const manifest = readJson(join(dir, "package.json"));
		const dependencies = manifest.dependencies || {};
		if ([...entryRoots].some((root) => Object.prototype.hasOwnProperty.call(dependencies, root))) return { name, dir, manifest };
	}
	const name = names[0] || null;
	return name ? { name, dir: join(profilesRoot, name), manifest: readJson(join(profilesRoot, name, "package.json")) } : null;
}

/** 汇总 Loader 条目为“一个安装包一张卡”。 */
export function buildCards(loader, dshHome) {
	const profile = resolveProfile(dshHome, loader);
	if (!profile) return { cards: [], profile: null };
	const dependencies = profile.manifest.dependencies || {};
	const flatDir = join(dshHome, "profiles", "node_modules");
	const patchPath = join(profile.dir, "cordis.patch.yml");
	let patchText = "";
	try { patchText = readFileSync(patchPath, "utf8"); } catch { /* missing patch */ }
	const patchInsertIds = new Set(scanPatchInsertIds(patchText));
	const managedStates = readManagedStates(patchText);
	let lockText = "";
	try { lockText = readFileSync(join(profile.dir, "pnpm-lock.yaml"), "utf8"); } catch { /* lock absent */ }

	const groups = new Map();
	for (const entry of loader.entries()) {
		if (entry.options?.group) continue;
		const moduleName = entry.options?.name || "";
		const packageName = packageRootOf(moduleName);
		if (!packageName) continue;
		const dependencySpec = dependencies[packageName];
		const inBox = existsSync(join(flatDir, packageName, "package.json"));
		const configId = typeof entry.options?.id === "string" && entry.options.id ? entry.options.id : entry.id.split(":").at(-1);
		const patchOnly = patchInsertIds.has(configId);
		if (dependencySpec === undefined && inBox && !patchOnly) continue;
		const key = dependencySpec === undefined ? `patch:${configId}` : packageName;
		if (!groups.has(key)) groups.set(key, { packageName, dependencySpec, entries: [], patchOnly });
		groups.get(key).entries.push({ entry, configId });
	}

	const cards = [];
	for (const group of groups.values()) {
		const packagePath = join(profile.dir, "node_modules", group.packageName, "package.json");
		const installed = readJson(packagePath);
		const source = group.patchOnly ? { kind: "patch", spec: "" } : sourceOf(group.dependencySpec);
		const upstream = githubRepoOf(installed.repository, installed.homepage);
		const entryIds = [...new Set(group.entries.map(({ configId }) => configId))];
		const enabled = group.entries.some(({ entry }) => !entry.disabled);
		const phases = group.entries.map(({ entry }) => entry.fiber === void 0 ? null : PHASES[entry.fiber.state] ?? null);
		const fiberPhase = phases.includes("failed") ? "failed" : phases.includes("loading") ? "loading" : phases.includes("pending") ? "pending" : phases.includes("active") ? "active" : phases.includes("unloading") ? "unloading" : null;
		const canManage = source.kind !== "patch" && group.dependencySpec !== undefined;
		cards.push({
			id: group.packageName,
			packageName: group.packageName,
			displayName: group.packageName.replace(/^dsh-/, ""),
			entryIds,
			enabled,
			fiberPhase,
			description: typeof installed.description === "string" ? installed.description : "",
			version: typeof installed.version === "string" && installed.version ? installed.version : "--",
			source: { ...source, installedCommit: installedGitCommit(installed, lockText, source), upstream },
			management: {
				canToggle: canManage,
				canCheckUpdate: source.kind === "github" || source.kind === "registry",
				canRemove: canManage,
				reason: canManage ? "" : group.patchOnly ? "手工 patch 条目暂不支持自动移除" : "系统内置插件不可管理"
			},
			managedDisabled: entryIds.every((id) => managedStates.get(id) === true)
		});
	}
	cards.sort((left, right) => left.displayName.localeCompare(right.displayName));
	return { cards, profile };
}

/** GitHub API 请求；匿名读取，网络/限流错误由调用方转换为展示信息。 */
async function githubJson(path) {
	const response = await fetch(`https://api.github.com${path}`, {
		headers: { accept: "application/vnd.github+json", "user-agent": "dsh-my-plugins" }
	});
	if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
	return response.json();
}

function shortSha(value) { return typeof value === "string" ? value.slice(0, 7) : ""; }

/** 查询 npm Registry 可安装的 latest 版本。 */
async function npmLatest(packageName) {
	const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, { headers: { accept: "application/json", "user-agent": "dsh-my-plugins" } });
	if (!response.ok) throw new Error(`npm Registry HTTP ${response.status}`);
	const body = await response.json();
	if (typeof body.version !== "string" || !body.version) throw new Error("npm Registry 未返回 latest version");
	return body.version;
}

/** 对 GitHub 上游读取 latest release；没有 release 时返回 null，不将其误作可安装版本。 */
async function githubLatestRelease(upstream) {
	if (!upstream) return null;
	try {
		const release = await githubJson(`/repos/${upstream.owner}/${upstream.repo}/releases/latest`);
		return typeof release.tag_name === "string" && release.tag_name ? release.tag_name : null;
	} catch (error) {
		if (String(error.message || error).includes("HTTP 404")) return null;
		throw error;
	}
}

/** 检查 GitHub 分支是否比当前安装 commit 更新；tag/SHA 视为固定 ref。 */
async function checkGithubUpdate(card) {
	const { owner, repo } = card.source;
	let ref = card.source.ref;
	if (!ref) {
		const repository = await githubJson(`/repos/${owner}/${repo}`);
		ref = repository.default_branch;
	}
	if (!ref) throw new Error("无法确定 GitHub 追踪分支");
	let branch = null;
	try { branch = await githubJson(`/repos/${owner}/${repo}/branches/${encodeURIComponent(ref)}`); } catch { /* tag 或 SHA */ }
	if (!branch) return { state: "immutable", ref, message: "该插件固定在 tag 或 commit，无法自动检查分支更新" };
	const latestCommit = branch.commit?.sha;
	if (!latestCommit) throw new Error("GitHub 未返回分支 commit");
	const installedCommit = card.source.installedCommit;
	if (!installedCommit) return { state: "unknown", ref, latestCommit, message: "无法从本地安装记录确认当前 Git commit" };
	if (latestCommit.toLowerCase() === installedCommit.toLowerCase()) return { state: "latest", ref, latestCommit, installedCommit, message: "该插件已是最新版本" };
	return { state: "updateAvailable", ref, latestCommit, installedCommit, message: `发现更新 ${shortSha(installedCommit)} → ${shortSha(latestCommit)}` };
}

/** 检查 Registry 安装包：npm latest 决定“立即更新”，GitHub release 仅补充上游信息。 */
async function checkRegistryUpdate(card) {
	const latestVersion = await npmLatest(card.packageName);
	const comparison = compareVersions(latestVersion, card.version);
	const githubRelease = await githubLatestRelease(card.source.upstream);
	const releaseComparison = githubRelease ? compareVersions(githubRelease, card.version) : null;
	const upstream = githubRelease ? { release: githubRelease, state: releaseComparison !== null && releaseComparison > 0 ? "ahead" : "latest" } : null;
	if (comparison === null) return { state: "unknown", latestVersion, upstream, message: `无法比较当前版本 ${card.version} 与 npm latest ${latestVersion}` };
	if (comparison > 0) return { state: "updateAvailable", latestVersion, upstream, message: `发现 npm 更新 ${card.version} → ${latestVersion}` };
	if (upstream?.state === "ahead") return { state: "upstreamAhead", latestVersion, upstream, message: `GitHub Release ${githubRelease} 已发布，但 npm latest 仍为 ${latestVersion}` };
	return { state: "latest", latestVersion, upstream, message: "该插件已是最新版本" };
}

async function checkUpdate(card) {
	if (card.source.kind === "github") return checkGithubUpdate(card);
	if (card.source.kind === "registry") return checkRegistryUpdate(card);
	throw new Error("该插件来源不支持自动更新");
}

/** 批量检查所有可自动更新的插件（排除本地安装与手工 patch 来源），逐个容错。 */
export async function checkAllUpdates(cards, checker = checkUpdate) {
	const results = [];
	for (const card of cards) {
		if (card.source.kind !== "github" && card.source.kind !== "registry") continue;
		try {
			results.push({ packageName: card.packageName, check: await checker(card) });
		} catch (error) {
			results.push({ packageName: card.packageName, check: { state: "failed", message: error instanceof Error ? error.message : String(error) } });
		}
	}
	return results;
}

/** 根据来源生成实际可安装的更新命令。0.x semver 范围不跨 minor，Registry 必须显式 add 目标版本。 */
export function updateArgsFor(card, check) {
	if (card.source.kind === "registry") {
		if (typeof check.latestVersion !== "string" || !check.latestVersion) throw new Error("npm Registry 未返回可安装目标版本");
		return ["add", `${card.packageName}@${check.latestVersion}`];
	}
	if (card.source.kind === "github") return ["update", card.packageName];
	throw new Error("该插件来源不支持自动更新");
}

/** 更新后必须验证安装副本真的达到目标版本/commit，不能只相信 pnpm 退出码。 */
export function assertUpdateApplied(card, refreshed, check) {
	if (card.source.kind === "registry") {
		const compared = compareVersions(refreshed.version, check.latestVersion);
		if (compared === null || compared < 0) throw new Error(`更新命令已结束，但安装版本仍为 ${refreshed.version}，未达到目标 ${check.latestVersion}`);
		return;
	}
	if (card.source.kind === "github" && check.latestCommit) {
		const actual = refreshed.source?.installedCommit;
		if (!actual || actual.toLowerCase() !== check.latestCommit.toLowerCase()) throw new Error("更新命令已结束，但无法确认 Git commit 已更新到目标版本");
	}
}

/** 调用当前 DSH CLI，保持官方 pnpm/bundle reconciliation 流程。 */
function runDshPlugin(profileName, args) {
	const bin = process.argv[1];
	if (!bin || !existsSync(bin)) return Promise.reject(new Error("无法定位当前 dsh CLI 入口"));
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [bin, "plugin", "--profile", profileName, ...args], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		child.stdout.on("data", (chunk) => { output += String(chunk); });
		child.stderr.on("data", (chunk) => { output += String(chunk); });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(output);
			else reject(new Error(output.trim() || `dsh plugin exited with ${code}`));
		});
	});
}

/** 把 CLI/pnpm 输出截成 toast 可展示的摘要：剥离 ANSI、去掉进度噪音、取末尾关键行、限长。 */
export function summarizeCliError(message) {
	if (typeof message !== "string") return "安装命令执行失败";
	const lines = message.split(/\r?\n/)
		.map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").trim())
		.filter((line) => line && !/^Progress:/.test(line));
	const summary = lines.slice(-12).join("\n").slice(0, 1000);
	return summary || "安装命令执行失败";
}

/** Host 是否回环地址（含 127/8 与 IPv6 回环）。 */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** 浏览器信任围栏：Host 回环或受信 + 同源。 */
function isTrustedRequest(req, ctx) {
	const host = req.headers.host;
	if (typeof host !== "string") return false;
	const hostname = host.replace(/^\[/, "").split(":")[0];
	if (!isLoopbackHostname(hostname)) {
		const trusted = ctx.get("webRuntime")?.trustedHosts;
		if (!Array.isArray(trusted) || !trusted.some((value) => value.split(":")[0] === hostname || value === host)) return false;
	}
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = req.headers.origin;
	if (origin === undefined) return true;
	try { return new URL(origin).host === host; } catch { return false; }
}

function writeJson(res, status, value) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
	res.end(JSON.stringify(value));
}

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let bytes = 0;
		req.on("data", (chunk) => {
			bytes += chunk.length;
			if (bytes > 64 * 1024) { reject(new Error("request body too large")); req.destroy(); return; }
			chunks.push(chunk);
		});
		req.on("end", () => {
			try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (error) { reject(error); }
		});
		req.on("error", reject);
	});
}

function requireCard(loader, dshHome, packageName) {
	if (typeof packageName !== "string" || !packageName) throw new Error("缺少插件包名");
	const state = buildCards(loader, dshHome);
	const card = state.cards.find((candidate) => candidate.packageName === packageName);
	if (!card) throw new Error("找不到可管理的已安装插件");
	return { ...state, card };
}

/** 清理历史版本可能写入的 include:<id> 运行时键。 */
function clearCardStateKeys(states, entryIds) {
	for (const key of [...states.keys()]) if (entryIds.some((id) => key === id || key.endsWith(`:${id}`))) states.delete(key);
}

/** 持久化启停状态到被 HMR 监听的 profile patch。 */
function toggleCard(state, card, enabled) {
	const patchPath = join(state.profile.dir, "cordis.patch.yml");
	let text = "";
	try { text = readFileSync(patchPath, "utf8"); } catch { text = "[]\n"; }
	const states = readManagedStates(text);
	clearCardStateKeys(states, card.entryIds);
	for (const id of card.entryIds) states.set(id, !enabled);
	return {
		patchPath,
		content: writeManagedStates(text, states),
		enabled,
		reloadRequired: true,
		message: enabled ? "插件已启用，页面即将刷新" : "插件已禁用，页面即将刷新"
	};
}

/**
 * 插件主体：注册页面管理 API。
 * - list: 读取卡片
 * - install: 四种方式安装插件（github/link/file/npm，同名时先确认）
 * - toggle: HMR profile patch 覆盖
 * - check-update/update: GitHub 依赖
 * - remove: 官方 dsh plugin remove
 */
export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: PREFIX,
		handler: async (req, res) => {
			if (!isTrustedRequest(req, ctx)) { writeJson(res, 403, { ok: false, error: "forbidden" }); return; }
			if (req.method !== "POST") { writeJson(res, 405, { ok: false, error: "method not allowed" }); return; }
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith(`${PREFIX}/`) ? pathname.slice(PREFIX.length + 1) : "";
			try {
				const payload = await readJsonBody(req);
				const loader = ctx.get("loader");
				const homeProvider = ctx.get("dshHomePath");
				const dshHome = typeof homeProvider === "function" ? homeProvider() : homeProvider;
				if (!loader || typeof dshHome !== "string") throw new Error("DSH profile services unavailable");
				if (method === "list") {
					const state = buildCards(loader, dshHome);
					writeJson(res, 200, { ok: true, cards: state.cards });
					return;
				}
				if (method === "install") {
					// install 不依赖已安装卡片，须在 requireCard 之前处理。
					const kind = typeof payload.kind === "string" ? payload.kind : "";
					const resolved = resolveInstallSpec(kind, typeof payload.input === "string" ? payload.input : "");
					if (!resolved.ok) throw new Error(resolved.error);
					const state = buildCards(loader, dshHome);
					if (!state.profile) throw new Error("无法解析 DSH profile");
					const existing = resolved.packageName === null ? null : existingDependency(state.profile.manifest.dependencies, resolved.packageName);
					if (existing !== null && payload.confirmed !== true) {
						writeJson(res, 200, { ok: true, needConfirm: true, packageName: resolved.packageName, existingSpec: existing });
						return;
					}
					try {
						await runDshPlugin(state.profile.name, ["add", resolved.spec]);
					} catch (error) {
						throw new Error(summarizeCliError(error instanceof Error ? error.message : String(error)));
					}
					writeJson(res, 200, { ok: true, packageName: resolved.packageName ?? "", message: "安装成功，重启 dsh web 后生效" });
					return;
				}
				const state = requireCard(loader, dshHome, payload.packageName);
				if (method === "toggle") {
					if (!state.card.management.canToggle) throw new Error(state.card.management.reason || "该插件不可启停");
					if (typeof payload.enabled !== "boolean") throw new Error("enabled 必须是布尔值");
					const change = toggleCard(state, state.card, payload.enabled);
					writeJson(res, 200, { ok: true, enabled: change.enabled, reloadRequired: change.reloadRequired, message: change.message });
					// 禁用自身时 HMR 会销毁当前路由；在响应完整写出后才改 patch，保证客户端收到成功结果。
					res.once("finish", () => atomicWrite(change.patchPath, change.content));
					return;
				}
				if (method === "check-all") {
					const state = buildCards(loader, dshHome);
					const results = await checkAllUpdates(state.cards);
					const updateable = results.filter((item) => item.check.state === "updateAvailable").map((item) => ({ packageName: item.packageName, message: item.check.message }));
					const failed = results.filter((item) => item.check.state === "failed").map((item) => ({ packageName: item.packageName, message: item.check.message }));
					writeJson(res, 200, { ok: true, updateable, failed, skipped: state.cards.length - results.length });
					return;
				}
				if (method === "check-update") {
					if (!state.card.management.canCheckUpdate) throw new Error("该插件来源不支持自动更新");
					writeJson(res, 200, { ok: true, check: await checkUpdate(state.card) });
					return;
				}
				if (method === "update") {
					if (!state.card.management.canCheckUpdate) throw new Error("该插件来源不支持自动更新");
					const check = await checkUpdate(state.card);
					if (check.state !== "updateAvailable") throw new Error(check.message || "当前没有可安装更新");
					const broken = missingLocalDependency(state.profile.dir, state.profile.manifest.dependencies);
					if (broken) throw new Error(`无法更新 ${state.card.displayName}：profile 中 ${broken.packageName} 的本地安装包不存在。\n请先修复该插件的安装来源；${state.card.displayName} 尚未发生任何修改。`);
					await runDshPlugin(state.profile.name, updateArgsFor(state.card, check));
					const refreshed = requireCard(loader, dshHome, state.card.packageName).card;
					assertUpdateApplied(state.card, refreshed, check);
					writeJson(res, 200, { ok: true, version: refreshed.version, restartRequired: true, message: `已更新至 ${refreshed.version}，重启 dsh web 后生效` });
					return;
				}
				if (method === "remove") {
					if (!state.card.management.canRemove) throw new Error(state.card.management.reason || "该插件不可自动移除");
					await runDshPlugin(state.profile.name, ["remove", state.card.packageName]);
					// 依赖已移除；同时清理本插件托管的 disabled 覆盖。
					const patchPath = join(state.profile.dir, "cordis.patch.yml");
					try {
						const text = readFileSync(patchPath, "utf8");
						const managed = readManagedStates(text);
						clearCardStateKeys(managed, state.card.entryIds);
						atomicWrite(patchPath, writeManagedStates(text, managed));
					} catch { /* remove 成功不因清理托管状态失败而否定 */ }
					writeJson(res, 200, { ok: true, restartRequired: true, message: "插件已移除，重启 dsh web 后完成卸载" });
					return;
				}
				writeJson(res, 404, { ok: false, error: `unknown method ${method}` });
			} catch (error) {
				writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "dsh-my-plugins: management api");
}
