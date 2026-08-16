// dsh-my-plugins — host half
// 「我的插件」标签的数据服务：枚举 Loader 条目 → 过滤用户安装的插件 →
// 读取插件介绍。浏览器半部通过 POST /my-plugins/api/list 调用。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const name = "dsh-my-plugins";
export const inject = ["webServer"];

/** Cordis Fiber 状态 → 阶段名（与官方 dsh-host-plugin-inventory 一致）。 */
const PHASES = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };

/**
 * 模块名 → 包根：'@scope/pkg/sub' → '@scope/pkg'；'pkg/sub' → 'pkg'。
 * 伪模块（cordis:include、include 树条目等含 ':' 的名称）不是真实插件包 → ''。
 * @param moduleName - Loader 条目的模块名。
 * @returns 包根名，或 ''（非真实包）。
 */
export function packageRootOf(moduleName) {
	if (typeof moduleName !== "string" || moduleName.length === 0) return "";
	if (moduleName.indexOf(":") !== -1) return "";
	const first = moduleName.indexOf("/");
	if (!moduleName.startsWith("@")) return first === -1 ? moduleName : moduleName.slice(0, first);
	const second = moduleName.indexOf("/", first + 1);
	return second === -1 ? moduleName : moduleName.slice(0, second);
}

/**
 * 最小 YAML 扫描：提取补丁文件顶层 insert 块内被插入条目的 id。
 * 仅支持块式风格（- id: X）；flow 风格（insert: [{...}]）跳过。
 * @param text - 补丁文件内容。
 * @returns 被插入条目的 id 数组。
 */
export function scanPatchInsertIds(text) {
	const ids = [];
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		if (!/^-\s/.test(lines[i])) continue;
		let inInsert = false;
		let insertIndent = -1;
		for (let j = i + 1; j < lines.length && !/^-\s/.test(lines[j]); j++) {
			const body = lines[j];
			const trimmed = body.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const indent = body.length - body.replace(/^\s+/, "").length;
			if (!inInsert) {
				if (/^insert:(\s|$)/.test(trimmed)) { inInsert = true; insertIndent = indent; }
				continue;
			}
			if (indent <= insertIndent) { inInsert = false; continue; }
			const match = trimmed.match(/^- id:\s*(.+)$/);
			if (match) {
				let value = match[1].trim();
				if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
				else value = value.replace(/\s+#.*$/, "").trim();
				if (value.length > 0) ids.push(value);
			}
		}
	}
	return ids;
}

/**
 * 计算用户安装的插件列表（纯函数，便于离线测试）。
 * 判定规则：
 *   1. 伪模块（模块名含 ':'）→ 系统条目，排除；
 *   2. 模块包不在安装闭包（$DSH_HOME/profiles/node_modules 仅含安装内包符号链接）→ 用户安装；
 *   3. 条目 id 出现在用户补丁层（profile cordis.patch.yml / 全局 cordis.patch.yml）的 insert 中 → 用户安装。
 * @param loader - ctx.get('loader')（测试可传 { entries: () => [...] }）。
 * @param dshHome - $DSH_HOME 绝对路径。
 * @returns 用户插件条目数组（Loader 顺序，纯 JSON 叶子字段）。
 */
export async function computeUserPlugins(loader, dshHome) {
	const all = [];
	for (const entry of loader.entries()) {
		if (entry.options && entry.options.group) continue;
		all.push({
			entryId: entry.id,
			moduleName: entry.options ? entry.options.name : "",
			enabled: !entry.disabled,
			fiberPhase: entry.fiber === void 0 ? null : PHASES[entry.fiber.state] ?? null
		});
	}

	const flatDir = join(dshHome, "profiles", "node_modules");

	// 识别当前 profile：其 node_modules 中含有任一条目模块包的目录；
	// 找不到（无本地包）时回退为扫描全部 profile 补丁层。
	let profileDirs = [];
	try {
		profileDirs = readdirSync(join(dshHome, "profiles"), { withFileTypes: true })
			.filter((d) => d.isDirectory() && d.name !== "node_modules")
			.map((d) => d.name);
	} catch { /* profiles 目录不存在 */ }
	let live = null;
	for (const pname of profileDirs) {
		const base = join(dshHome, "profiles", pname);
		const hit = all.some((e) => {
			const root = packageRootOf(e.moduleName);
			return root !== "" && existsSync(join(base, "node_modules", root, "package.json"));
		});
		if (hit) { live = pname; break; }
	}

	// 用户补丁层插入的条目 id（当前 profile 补丁 + 全局 home 补丁）。
	const patchIds = new Set();
	for (const pname of live ? [live] : profileDirs) {
		try {
			const text = readFileSync(join(dshHome, "profiles", pname, "cordis.patch.yml"), "utf8");
			for (const id of scanPatchInsertIds(text)) patchIds.add(id);
		} catch { /* 无补丁文件 */ }
	}
	try {
		const text = readFileSync(join(dshHome, "cordis.patch.yml"), "utf8");
		for (const id of scanPatchInsertIds(text)) patchIds.add(id);
	} catch { /* 无全局补丁 */ }

	// 判定用户安装。
	const user = [];
	for (const e of all) {
		const root = packageRootOf(e.moduleName);
		if (root === "") continue;
		const inBox = existsSync(join(flatDir, root, "package.json"));
		if (!inBox || patchIds.has(e.entryId)) user.push(e);
	}

	// 插件介绍：读模块包根 package.json 的 description（profile 本地优先，其次 flat fallback）。
	for (const e of user) {
		const root = packageRootOf(e.moduleName);
		const probes = [];
		if (live) probes.push(join(dshHome, "profiles", live, "node_modules", root, "package.json"));
		probes.push(join(flatDir, root, "package.json"));
		let description = "";
		for (const probe of probes) {
			try {
				const pkg = JSON.parse(readFileSync(probe, "utf8"));
				if (pkg && typeof pkg.description === "string") { description = pkg.description; break; }
			} catch { /* 尝试下一个探测路径 */ }
		}
		e.description = description;
	}
	return user;
}

/** Host 是否回环地址（含 127/8 与 IPv6 回环）。 */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** 浏览器信任围栏：Host 回环或受信 + 同源（防跨站请求）。 */
function isTrustedRequest(req, ctx) {
	const host = req.headers.host;
	if (typeof host !== "string") return false;
	const hostname = host.replace(/^\[/, "").split(":")[0];
	if (!isLoopbackHostname(hostname)) {
		const trusted = ctx.get("webRuntime")?.trustedHosts;
		if (!Array.isArray(trusted) || !trusted.some((a) => a.split(":")[0] === hostname || a === host)) return false;
	}
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

/** 写 JSON 响应。 */
function writeJson(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}

/** 读 JSON 请求体（限流防滥用）。 */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (chunk) => {
			chunks.push(chunk);
			if (chunks.length > 64) { reject(new Error("request body too large")); req.destroy(); }
		});
		req.on("end", () => {
			try {
				resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}

const PREFIX = "/my-plugins/api";

/**
 * 插件主体：注册 /my-plugins/api 前缀路由（list 方法）。
 * @param ctx - host 插件上下文（loader / dshHomePath / webServer / webRuntime）。
 */
export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: PREFIX,
		handler: async (req, res) => {
			if (!isTrustedRequest(req, ctx)) {
				writeJson(res, 403, { ok: false, error: { code: "forbidden", message: "forbidden" } });
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, { ok: false, error: { code: "method-error", message: "method not allowed" } });
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith(PREFIX + "/") ? pathname.slice(PREFIX.length + 1) : void 0;
			if (method !== "list") {
				writeJson(res, 404, { ok: false, error: { code: "not-found", message: `unknown method ${method ?? ""}` } });
				return;
			}
			try {
				await readJsonBody(req);
				const loader = ctx.get("loader");
				const homeProvider = ctx.get("dshHomePath");
				const dshHome = typeof homeProvider === "function" ? homeProvider() : homeProvider;
				if (!loader || typeof dshHome !== "string") {
					writeJson(res, 200, { ok: false, error: "unavailable", entries: [] });
					return;
				}
				const entries = await computeUserPlugins(loader, dshHome);
				writeJson(res, 200, { ok: true, entries });
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error),
					entries: []
				});
			}
		}
	}), "dsh-my-plugins: /my-plugins/api routes");
}
