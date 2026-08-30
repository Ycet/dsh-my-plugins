// dsh-my-plugins — browser half（ModuleLoader bundle）
// 「我的插件」页签：版本、启停、GitHub 更新检查/更新、二次确认移除。
window.__ModuleLoader__.load({
	id: "dsh-my-plugins",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");

		const NS = "settings.myPlugins";
		const PREFIX = "/my-plugins/api";
		const OVERLAY_ID = "my-plugins-overlay";
		const TAB_ID = "mine";

		const zh = {
			tab: "我的插件", loading: "正在读取插件…", error: "暂时无法读取插件。", retry: "重试",
			search: "搜索插件", catalog: "我的插件", empty: "暂无用户安装的插件。", emptySearch: "没有匹配的插件。",
			enabledTag: "已启用", disabledTag: "已停用", configuration: "配置状态", cordis: "Cordis 状态",
			version: "插件版本", description: "插件介绍", source: "安装来源", noDescription: "（暂无介绍）",
			unobserved: "未挂载", pending: "等待依赖", loadingPhase: "加载中", active: "已挂载", failed: "挂载失败", unloading: "卸载中",
			disable: "禁用插件", enable: "启用插件", checking: "检查中…", checkUpdate: "检查更新", updateNow: "立即更新", updating: "更新中…",
			remove: "移除插件", removing: "移除中…", cancel: "取消", confirmRemove: "确认移除", removeTitle: "确认移除插件？",
			removeBody: "将从当前 DSH profile 移除“{name}”。此操作将在重启 dsh web 后完成。", restartHint: "操作已完成。请在终端按 Ctrl+C 后运行 npm exec @deepseek-ai/dsh web 以生效。",
			latest: "该插件已是最新版本", fixedRef: "该插件固定在 tag 或 commit，无法自动检查分支更新", unknownCommit: "无法确认当前 Git commit，无法安全判断是否有更新",
			github: "GitHub", local: "本地安装", registry: "Registry 安装", patch: "手工 patch", unknown: "未知来源", unavailable: "此来源不支持自动更新", upstreamAhead: "GitHub 上游已有新 Release，但当前 npm 安装源尚未发布可安装更新",
			install: "安装插件", installTitle: "安装插件", installSuccess: "安装成功，重启 dsh web 后生效", installing: "安装中…", confirmInstall: "确认安装",
			methodGithub: "GitHub\n远程安装", methodLink: "本地 link 安装", methodFile: "本地 file 安装", methodNpm: "npm 安装",
			githubPlaceholder: "输入 GitHub 仓库地址，如 Ycet/dsh-my-plugins（可附 #分支或tag）", linkPlaceholder: "输入插件源码目录的绝对路径",
			filePlaceholder: "输入插件目录或 .tgz 归档的绝对路径", npmPlaceholder: "输入 npm 包名，可附 @版本，如 dsh-better-sidebar",
			invalidGithub: "仓库地址格式不正确，应为 owner/repo（可附 #分支或tag）", invalidPath: "路径必须是 / 开头的绝对路径", invalidNpm: "包名格式不正确（小写字母、数字、- _ . ~，可含 @scope/ 前缀）",
			installExisting: "该插件已安装（当前来源：{spec}）。继续安装将切换为本次所选来源，重启后生效。",
			checkAll: "检查更新", checkingAll: "检查中…", pendingUpdate: "待更新", checkAllDone: "检查完成：{count} 个插件可更新", checkAllLatest: "所有插件均已是最新版本", checkAllFailed: "检查完成：{count} 个插件可更新，{failed} 个检查失败", checkAllSkipped: "（已跳过 {count} 个本地安装插件）"
		};
		const en = {
			tab: "My Plugins", loading: "Reading plugins…", error: "Plugins are temporarily unavailable.", retry: "Retry",
			search: "Search plugins", catalog: "My plugins", empty: "No user-installed plugins.", emptySearch: "No matching plugins.",
			enabledTag: "Enabled", disabledTag: "Disabled", configuration: "Configuration", cordis: "Cordis status",
			version: "Version", description: "Description", source: "Source", noDescription: "No description.",
			unobserved: "Not mounted", pending: "Waiting for dependencies", loadingPhase: "Loading", active: "Mounted", failed: "Mount failed", unloading: "Unloading",
			disable: "Disable", enable: "Enable", checking: "Checking…", checkUpdate: "Check update", updateNow: "Update now", updating: "Updating…",
			remove: "Remove", removing: "Removing…", cancel: "Cancel", confirmRemove: "Remove plugin", removeTitle: "Remove this plugin?",
			removeBody: "“{name}” will be removed from the current DSH profile. The removal completes after dsh web restarts.", restartHint: "The operation completed. Press Ctrl+C in the terminal, then run npm exec @deepseek-ai/dsh web to apply it.",
			latest: "This plugin is already up to date", fixedRef: "This plugin is pinned to a tag or commit and cannot track branch updates", unknownCommit: "The installed Git commit is unavailable, so an update cannot be safely determined",
			github: "GitHub", local: "Local install", registry: "Registry install", patch: "Manual patch", unknown: "Unknown source", unavailable: "Automatic update is unavailable for this source", upstreamAhead: "A newer GitHub Release exists, but the npm install source has no installable update yet",
			install: "Install plugin", installTitle: "Install plugin", installSuccess: "Plugin installed. Restart dsh web to apply it.", installing: "Installing…", confirmInstall: "Install anyway",
			methodGithub: "GitHub", methodLink: "Local link", methodFile: "Local file", methodNpm: "npm",
			githubPlaceholder: "GitHub repo, e.g. Ycet/dsh-my-plugins (optional #branch or tag)", linkPlaceholder: "Absolute path to the plugin source directory",
			filePlaceholder: "Absolute path to a plugin directory or .tgz archive", npmPlaceholder: "npm package name, e.g. dsh-better-sidebar or dsh-better-sidebar@1.2.3",
			invalidGithub: "Invalid repo address; expected owner/repo (optional #branch or tag)", invalidPath: "Path must be absolute and start with /", invalidNpm: "Invalid npm package name (lowercase, digits, - _ . ~, optional @scope/ prefix)",
			installExisting: "This plugin is already installed (current source: {spec}). Installing will switch it to the selected source; it takes effect after a restart.",
			checkAll: "Check updates", checkingAll: "Checking…", pendingUpdate: "Update pending", checkAllDone: "Check complete: {count} plugin(s) have updates", checkAllLatest: "All plugins are up to date", checkAllFailed: "Check complete: {count} plugin(s) have updates, {failed} check(s) failed", checkAllSkipped: "({count} local plugin(s) skipped)"
		};

		const css = ".mpl-section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.mpl-searchRow{width:100%;align-items:center;gap:8px;display:flex}.mpl-search{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.mpl-search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 12px;font-size:13px}.mpl-search input::placeholder{color:var(--dsw-alias-label-tertiary)}.mpl-search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.mpl-heading{align-items:baseline;gap:7px;padding:0 2px;display:flex}.mpl-heading h3{margin:0;font-size:13px;font-weight:600;line-height:20px}.mpl-heading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}.mpl-status{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.mpl-failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;margin:0;font-size:13px;line-height:20px;display:flex}.mpl-failure button,.mpl-action{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-3);border-radius:7px;padding:5px 10px;font-size:12px;line-height:18px}.mpl-action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.mpl-action:disabled{opacity:.48;cursor:not-allowed}.mpl-actionUpdate{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}.mpl-actionUpdate:hover:not(:disabled){background:var(--dsw-alias-state-business-primary)}.mpl-actionDanger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 60%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-error-primary)}.mpl-cards{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:10px;margin:0;padding:0;list-style:none;display:grid}.mpl-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;overflow:hidden}.mpl-card[data-open=true]{border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv1)}.mpl-cardContent{box-sizing:border-box;width:100%;min-height:52px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;display:flex}.mpl-cardContent:hover,.mpl-card[data-open=true]>.mpl-cardContent{background:var(--dsw-alias-interactive-bg-hover)}.mpl-cardContent:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.mpl-cardTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;line-height:20px;overflow:hidden}.mpl-cardTrailing{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:7px;display:inline-flex}.mpl-statusDot{background:var(--dsw-alias-label-tertiary);border-radius:999px;flex:none;width:7px;height:7px;display:inline-block}.mpl-statusDot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}.mpl-statusDot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}.mpl-statusDot[data-phase=loading]{background:var(--dsw-alias-state-business-primary)}.mpl-statusDot[data-phase=pending]{background:var(--dsw-alias-state-warn-primary)}.mpl-configTag{background:var(--dsw-alias-bg-layer-1);min-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:5px;align-items:center;padding:1px 6px;font-size:11px;line-height:16px;display:inline-flex}.mpl-configTag[data-enabled=true]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}.mpl-chevron{color:var(--dsw-alias-label-tertiary);flex:none}.mpl-card[data-open=true] .mpl-chevron{transform:rotate(180deg)}.mpl-cardDetails{border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:10px 14px 12px}.mpl-entryValue{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;display:block}.mpl-details{grid-template-columns:76px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;display:grid}.mpl-details div{display:contents}.mpl-details dt{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}.mpl-details dd{overflow-wrap:anywhere;min-width:0;color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:17px}.mpl-actions{border-top:1px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap;gap:8px;margin:12px -14px -12px;padding:10px 14px 12px}.mpl-visuallyHidden{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.mpl-overlay{pointer-events:none;position:fixed;inset:0;z-index:20}.mpl-toastRoot{pointer-events:none;position:fixed;inset:0;z-index:2147483001}.mpl-modalRoot{pointer-events:auto;position:fixed;inset:0;z-index:2147483000}.mpl-toastStack{pointer-events:none;position:absolute;bottom:10px;right:10px;max-width:min(420px,calc(100vw - 36px));display:flex;flex-direction:column;gap:8px}.mpl-toast{box-shadow:var(--dsw-shadow-lv1);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:9px;padding:10px 12px;font-size:13px;line-height:19px}.mpl-toast[data-kind=error]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 65%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-error-primary)}.mpl-toast[data-kind=success]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,var(--dsw-alias-border-l2))}.mpl-modalBack{pointer-events:auto;background:color-mix(in srgb,#000 35%,transparent);position:absolute;inset:0;align-items:center;justify-content:center;display:flex}.mpl-modal{box-shadow:var(--dsw-shadow-lv1);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:12px;width:min(420px,calc(100vw - 32px));padding:18px}.mpl-modal h3{margin:0 0 8px;font-size:16px;line-height:24px}.mpl-modal p{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}.mpl-modalActions{justify-content:flex-end;display:flex;gap:8px;margin-top:18px}@media (prefers-reduced-motion:no-preference){.mpl-chevron{transition:transform .14s var(--ds-ease-in-out)}}@media (width<=680px){.mpl-cards{grid-template-columns:minmax(0,1fr)}.mpl-toastStack{bottom:10px;right:10px}}.mpl-installTrigger{flex:none;height:36px}.mpl-installHead{justify-content:space-between;align-items:center;gap:8px;display:flex}.mpl-installHead h3{margin:0}.mpl-methods{display:flex;gap:6px;margin:2px 0 14px}.mpl-segment{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-1);flex:1;min-width:0;white-space:pre-line;border-radius:8px;padding:6px 8px;font-size:12px;line-height:18px}.mpl-segment:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.mpl-segmentActive,.mpl-segmentActive:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent)}.mpl-segment:disabled{opacity:.48;cursor:not-allowed}.mpl-installField>input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;width:100%;height:36px;border-radius:8px;outline:none;padding:0 12px;font-size:13px}.mpl-installField>input::placeholder{color:var(--dsw-alias-label-tertiary)}.mpl-installField>input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.mpl-installField>input:disabled{opacity:.55}.mpl-installHint{color:var(--dsw-alias-state-error-primary);margin:6px 0 0;font-size:12px;line-height:17px}.mpl-installWarn{border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent);color:var(--dsw-alias-state-warn-primary);border-radius:8px;margin:10px 0 0;padding:8px 10px;font-size:12px;line-height:18px}.mpl-actionPrimary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}.mpl-actionPrimary:hover:not(:disabled){background:var(--dsw-alias-state-business-primary)}.mpl-progress{background:var(--dsw-alias-bg-layer-1);border-radius:999px;height:4px;margin:12px 0 0;overflow:hidden;position:relative}.mpl-progressBar{background:var(--dsw-alias-state-business-primary);border-radius:999px;position:absolute;top:0;bottom:0;width:38%;animation:mpl-progress-slide 1.1s ease-in-out infinite}@keyframes mpl-progress-slide{0%{left:-40%}100%{left:100%}}@media (prefers-reduced-motion:reduce){.mpl-progressBar{animation:none;left:0}}.mpl-sourceLink{color:var(--dsw-alias-state-business-primary);text-decoration:none;overflow-wrap:anywhere}.mpl-sourceLink:hover{text-decoration:underline}.mpl-configTag[data-pending=true]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary)}";
		const tagId = "dsh-my-plugins/tab.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-my-plugins";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		function call(method, payload) {
			return fetch(`${PREFIX}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload ?? {}) }).then(async (response) => {
				const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
				if (!response.ok || body.ok !== true) throw new Error(typeof body.error === "string" ? body.error : body.error?.message || `HTTP ${response.status}`);
				return body;
			});
		}
		function moduleShortName(name) { return (name || "").replace(/^dsh-/, ""); }
		/** 校验 owner/repo 并编码 GitHub 主页 URL；非法返回 null（不生成可注入的 href）。 */
		function githubUrl(owner, repo) {
			if (typeof owner !== "string" || typeof repo !== "string") return null;
			if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(owner) || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo)) return null;
			return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
		}
		function githubLink(url, text) {
			return react.createElement("a", { className: "mpl-sourceLink", href: url, target: "_blank", rel: "noopener noreferrer" }, text);
		}
		function sourceLabel(source, t) {
			if (source?.kind === "github") {
				const url = source.owner && source.repo ? githubUrl(source.owner, source.repo) : null;
				if (url) return githubLink(url, `${t("github")}: ${source.owner}/${source.repo}${source.ref ? `#${source.ref}` : ""}`);
				return t("github");
			}
			if (source?.kind === "registry" && source.upstream?.owner && source.upstream?.repo) {
				const url = githubUrl(source.upstream.owner, source.upstream.repo);
				const prefix = `${t("registry")} · ${t("github")}: `;
				return url ? react.createElement(react.Fragment, null, prefix, githubLink(url, `${source.upstream.owner}/${source.upstream.repo}`)) : `${prefix}${source.upstream.owner}/${source.upstream.repo}`;
			}
			return t(source?.kind || "unknown");
		}
		function interpolate(template, values) { return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ""); }

		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-my-plugins: dictionaries");
			const t = ctx.locale.bind(NS);
			const overlayListeners = new Set();
			let overlayState = { toasts: [], confirm: null };
			const subscribeOverlay = (listener) => { overlayListeners.add(listener); return () => overlayListeners.delete(listener); };
			const publishOverlay = () => { for (const listener of [...overlayListeners]) listener(overlayState); };
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: OVERLAY_ID, order: 80 }, () => react.createElement(Overlay, { subscribe: subscribeOverlay, snapshot: () => overlayState } )));
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({ name: "settings.plugins.tab", id: TAB_ID, order: 20, label: () => t("tab"), locale: NS }, MyPluginsTab));
			const setOverlay = (next) => { overlayState = next; publishOverlay(); };
			const toast = (message, kind = "success") => {
				const id = `${Date.now()}-${Math.random()}`;
				setOverlay({ ...overlayState, toasts: [...overlayState.toasts, { id, message, kind }] });
				window.setTimeout(() => setOverlay({ ...overlayState, toasts: overlayState.toasts.filter((item) => item.id !== id) }), 2000);
			};
			const confirmRemove = (card, onConfirm) => setOverlay({ ...overlayState, confirm: { card, onConfirm } });
			const closeConfirm = () => setOverlay({ ...overlayState, confirm: null });

			const installMethods = [
				{ id: "github", label: t("methodGithub"), placeholder: t("githubPlaceholder"), errorText: t("invalidGithub"), validate: (value) => /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:#[A-Za-z0-9._\/-]+)?$/.test(value.trim()) },
				{ id: "link", label: t("methodLink"), placeholder: t("linkPlaceholder"), errorText: t("invalidPath"), validate: (value) => value.trim().startsWith("/") },
				{ id: "file", label: t("methodFile"), placeholder: t("filePlaceholder"), errorText: t("invalidPath"), validate: (value) => value.trim().startsWith("/") },
				{ id: "npm", label: t("methodNpm"), placeholder: t("npmPlaceholder"), errorText: t("invalidNpm"), validate: (value) => /^(?:@[a-z0-9-~][a-z0-9._~-]*\/)?[a-z0-9-~][a-z0-9._~-]*(?:@[A-Za-z0-9][A-Za-z0-9._+*~^<>=|()\-]*)?$/.test(value.trim()) }
			];
			const refreshListeners = new Set();
			const subscribeRefresh = (listener) => { refreshListeners.add(listener); return () => refreshListeners.delete(listener); };
			const notifyInstalled = () => { for (const listener of [...refreshListeners]) listener(); };
			const openInstall = () => setOverlay({ ...overlayState, install: { method: "github", input: "", busy: false, confirm: null } });
			const closeInstall = () => { if (overlayState.install?.busy) return; setOverlay({ ...overlayState, install: null }); };
			const setInstallMethod = (method) => setOverlay({ ...overlayState, install: { ...overlayState.install, method, confirm: null } });
			const setInstallInput = (value) => setOverlay({ ...overlayState, install: { ...overlayState.install, input: value, confirm: null } });
			const runInstall = async () => {
				const install = overlayState.install;
				if (!install || install.busy) return;
				const method = installMethods.find((item) => item.id === install.method) || installMethods[0];
				if (!method.validate(install.input)) return;
				setOverlay({ ...overlayState, install: { ...install, busy: true } });
				try {
					const result = await call("install", { kind: install.method, input: install.input.trim(), confirmed: install.confirm !== null });
					if (result.needConfirm) {
						setOverlay({ ...overlayState, install: { ...install, busy: false, confirm: { packageName: result.packageName, existingSpec: result.existingSpec } } });
						return;
					}
					setOverlay({ ...overlayState, install: null });
					toast(typeof result.message === "string" && result.message ? result.message : t("installSuccess"), "success");
					notifyInstalled();
				} catch (error) {
					setOverlay({ ...overlayState, install: { ...install, busy: false } });
					toast(String(error.message || error), "error");
				}
			};
			const renderInstallModal = (install) => {
				if (!install) return null;
				const method = installMethods.find((item) => item.id === install.method) || installMethods[0];
				const input = typeof install.input === "string" ? install.input : "";
				const valid = method.validate(input);
				const busy = install.busy === true;
				const confirm = install.confirm;
				return react.createElement("div", { className: "mpl-modalRoot" },
					react.createElement("div", { className: "mpl-modalBack", role: "presentation", onMouseDown: closeInstall },
						react.createElement("div", { className: "mpl-modal mpl-installModal", role: "dialog", "aria-modal": "true", "aria-labelledby": "mpl-install-title", onMouseDown: (event) => event.stopPropagation() },
							react.createElement("div", { className: "mpl-installHead" },
								react.createElement("h3", { id: "mpl-install-title" }, t("installTitle"))
							),
							react.createElement("div", { className: "mpl-methods", role: "tablist", "aria-label": t("installTitle") },
								installMethods.map((item) => react.createElement("button", { key: item.id, type: "button", role: "tab", "aria-selected": item.id === method.id ? "true" : "false", disabled: busy, className: item.id === method.id ? "mpl-segment mpl-segmentActive" : "mpl-segment", onClick: () => setInstallMethod(item.id) }, item.label))
							),
							react.createElement("div", { className: "mpl-installField", role: "tabpanel" },
								react.createElement("label", { className: "mpl-visuallyHidden", htmlFor: "mpl-install-input" }, method.label),
								react.createElement("input", { id: "mpl-install-input", type: "text", autoComplete: "off", spellCheck: "false", value: input, disabled: busy, placeholder: method.placeholder, onChange: (event) => setInstallInput(event.currentTarget.value), onKeyDown: (event) => { if (event.key === "Enter") runInstall(); } }),
								input.trim() && !valid ? react.createElement("p", { className: "mpl-installHint", role: "alert" }, method.errorText) : null,
								confirm ? react.createElement("p", { className: "mpl-installWarn", role: "alert" }, interpolate(t("installExisting"), { spec: confirm.existingSpec || "" })) : null,
								busy ? react.createElement("div", { className: "mpl-progress", role: "progressbar", "aria-label": t("installing"), "aria-busy": "true" }, react.createElement("div", { className: "mpl-progressBar" })) : null,
								react.createElement("div", { className: "mpl-modalActions" },
									react.createElement("button", { type: "button", className: "mpl-action", disabled: busy, onClick: closeInstall }, t("cancel")),
									react.createElement("button", { type: "button", className: "mpl-action mpl-actionPrimary", disabled: busy || !valid, onClick: runInstall }, busy ? t("installing") : confirm ? t("confirmInstall") : t("install"))
								)
							)
						)
					)
				);
			};

			function Overlay(props) {
				const [state, setState] = react.useState(() => props.snapshot());
				const [dismissedConfirm, setDismissedConfirm] = react.useState(null);
				react.useEffect(() => props.subscribe((next) => setState(next)), [props.subscribe]);
				const confirmation = state.confirm && state.confirm !== dismissedConfirm ? state.confirm : null;
				const dismiss = (event) => {
					event?.stopPropagation();
					setDismissedConfirm(state.confirm);
					closeConfirm();
				};
				const confirm = async (event) => {
					event?.stopPropagation();
					const action = confirmation?.onConfirm;
					setDismissedConfirm(state.confirm);
					closeConfirm();
					if (action) await action();
				};
				const modal = confirmation ? react.createElement("div", { className: "mpl-modalRoot" },
					react.createElement("div", { className: "mpl-modalBack", role: "presentation", onMouseDown: dismiss },
						react.createElement("div", { className: "mpl-modal", role: "dialog", "aria-modal": true, "aria-labelledby": "mpl-remove-title", onMouseDown: (event) => event.stopPropagation() },
							react.createElement("h3", { id: "mpl-remove-title" }, t("removeTitle")),
							react.createElement("p", null, interpolate(t("removeBody"), { name: confirmation.card.displayName })),
							react.createElement("div", { className: "mpl-modalActions" },
								react.createElement("button", { className: "mpl-action", type: "button", onMouseDown: dismiss, onClick: (event) => { if (event.detail === 0) dismiss(event); } }, t("cancel")),
								react.createElement("button", { className: "mpl-action mpl-actionDanger", type: "button", onMouseDown: confirm, onClick: (event) => { if (event.detail === 0) confirm(event); } }, t("confirmRemove"))
							)
						)
					)
				) : null;
				const toasts = react.createElement("div", { className: "mpl-toastRoot" }, react.createElement("div", { className: "mpl-toastStack", "aria-live": "polite" }, state.toasts.map((item) => react.createElement("div", { className: "mpl-toast", "data-kind": item.kind, key: item.id }, item.message))));
				const installModal = state.install ? renderInstallModal(state.install) : null;
				return react.createElement(react.Fragment, null,
					react.createElement("div", { className: "mpl-overlay" }),
					react_dom.createPortal(toasts, document.body),
					modal ? react_dom.createPortal(modal, document.body) : null,
					installModal ? react_dom.createPortal(installModal, document.body) : null
				);
			}

			function MyPluginsTab() {
				const [state, setState] = react.useState({ status: "loading", cards: [] });
				const [query, setQuery] = react.useState("");
				const [expanded, setExpanded] = react.useState(null);
				const [busy, setBusy] = react.useState({});
				const [updates, setUpdates] = react.useState({});
				const [pendingUpdates, setPendingUpdates] = react.useState(null);
				const [checkAllBusy, setCheckAllBusy] = react.useState(false);
				const load = react.useCallback(async () => {
					setState({ status: "loading", cards: [] });
					setPendingUpdates(null);
					try { const result = await call("list", {}); setState({ status: "ready", cards: Array.isArray(result.cards) ? result.cards : [] }); }
					catch (error) { setState({ status: "error", cards: [], detail: String(error.message || error) }); }
				}, []);
				react.useEffect(() => { load(); }, [load]);
				react.useEffect(() => subscribeRefresh(load), [load, subscribeRefresh]);
				const checkAll = async () => {
					if (checkAllBusy) return;
					setCheckAllBusy(true);
					setPendingUpdates(null);
					try {
						const result = await call("check-all", {});
						const names = new Set((result.updateable || []).map((item) => item.packageName));
						setPendingUpdates(names);
						const failed = (result.failed || []).length;
						if (names.size > 0) toast(interpolate(t("checkAllDone"), { count: String(names.size) }), "success");
						else if (failed > 0) toast(interpolate(t("checkAllFailed"), { count: "0", failed: String(failed) }), "error");
						else toast(t("checkAllLatest"), "success");
						if (result.skipped > 0) toast(interpolate(t("checkAllSkipped"), { count: String(result.skipped) }), "error");
					} catch (error) {
						setPendingUpdates(null);
						toast(String(error.message || error), "error");
					} finally {
						setCheckAllBusy(false);
					}
				};
				const setCardBusy = (id, value) => setBusy((current) => ({ ...current, [id]: value }));
				const perform = async (card, kind, task) => {
					setCardBusy(card.packageName, kind);
					try { return await task(); }
					catch (error) { toast(String(error.message || error), "error"); return null; }
					finally { setCardBusy(card.packageName, null); }
				};
				const toggle = async (card) => {
					const result = await perform(card, "toggle", () => call("toggle", { packageName: card.packageName, enabled: !card.enabled }));
					if (!result) return;
					toast(result.message, "success");
					window.setTimeout(() => window.location.reload(), 550);
				};
				const checkUpdate = async (card) => {
					const result = await perform(card, "check", () => call("check-update", { packageName: card.packageName }));
					if (!result) return;
					const check = result.check;
					if (check.state === "updateAvailable") { setUpdates((current) => ({ ...current, [card.packageName]: check })); toast(check.message, "success"); }
					else if (check.state === "latest") toast(t("latest"), "success");
					else if (check.state === "upstreamAhead") toast(check.message || t("upstreamAhead"), "error");
					else if (check.state === "immutable") toast(t("fixedRef"), "error");
					else toast(check.message || t("unknownCommit"), "error");
				};
				const update = async (card) => {
					const result = await perform(card, "update", () => call("update", { packageName: card.packageName }));
					if (!result) return;
					setUpdates((current) => { const next = { ...current }; delete next[card.packageName]; return next; });
					setPendingUpdates((current) => { if (!current) return current; const next = new Set(current); next.delete(card.packageName); return next; });
					setState((current) => ({ ...current, cards: current.cards.map((item) => item.packageName === card.packageName ? { ...item, version: result.version || item.version } : item) }));
					toast(result.message || t("restartHint"), "success");
				};
				const remove = async (card) => {
					const result = await perform(card, "remove", () => call("remove", { packageName: card.packageName }));
					if (!result) return;
					setState((current) => ({ ...current, cards: current.cards.filter((item) => item.packageName !== card.packageName) }));
					toast(result.message || t("restartHint"), "success");
				};
				const normalized = query.trim().toLocaleLowerCase();
				const cards = state.cards.filter((card) => !normalized || [card.displayName, card.packageName, card.description || "", card.version || ""].some((value) => String(value).toLocaleLowerCase().includes(normalized)));

				return react.createElement("div", { className: "mpl-section" },
					state.status === "loading" ? react.createElement("p", { className: "mpl-status" }, t("loading")) : null,
					state.status === "error" ? react.createElement("div", { className: "mpl-failure", role: "alert" }, react.createElement("p", null, t("error")), state.detail ? react.createElement("code", { className: "mpl-entryValue" }, state.detail) : null, react.createElement("button", { type: "button", onClick: load }, t("retry"))) : null,
					state.status === "ready" ? react.createElement("div", { className: "mpl-catalog" },
						react.createElement("div", { className: "mpl-searchRow" },
							react.createElement("label", { className: "mpl-search" }, react.createElement("span", { className: "mpl-visuallyHidden" }, t("search")), react.createElement("input", { type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), onChange: (event) => setQuery(event.currentTarget.value) })),
							react.createElement("button", { type: "button", className: "mpl-action mpl-installTrigger", disabled: checkAllBusy, onClick: checkAll }, checkAllBusy ? t("checkingAll") : t("checkAll")),
							react.createElement("button", { type: "button", className: "mpl-action mpl-installTrigger", onClick: openInstall }, t("install"))
						),
						react.createElement("div", { className: "mpl-heading" }, react.createElement("h3", null, t("catalog")), react.createElement("span", { "data-plugin-count": cards.length }, String(cards.length))),
						state.cards.length === 0 ? react.createElement("p", { className: "mpl-status" }, t("empty")) : null,
						state.cards.length > 0 && cards.length === 0 ? react.createElement("p", { className: "mpl-status" }, t("emptySearch")) : null,
						cards.length > 0 ? react.createElement("ul", { className: "mpl-cards" }, cards.map((card) => {
							const open = expanded === card.packageName;
							const detailId = `mpl-details-${encodeURIComponent(card.packageName)}`;
							const pending = busy[card.packageName];
							const updateState = updates[card.packageName];
							const hasPendingUpdate = pendingUpdates !== null && pendingUpdates.has(card.packageName);
							const updateReady = updateState || hasPendingUpdate;
							const configuration = hasPendingUpdate ? t("pendingUpdate") : t(card.enabled ? "enabledTag" : "disabledTag");
							const phase = t(card.fiberPhase ?? "unobserved");
							return react.createElement("li", { key: card.packageName, className: "mpl-card", "data-plugin-entry": card.entryIds.join(","), "data-open": open ? "true" : void 0 },
								react.createElement("button", { className: "mpl-cardContent", type: "button", "aria-expanded": open, "aria-controls": detailId, onClick: () => setExpanded((current) => current === card.packageName ? null : card.packageName) },
									react.createElement("strong", { className: "mpl-cardTitle", title: card.packageName }, card.displayName || moduleShortName(card.packageName)),
									react.createElement("span", { className: "mpl-cardTrailing" }, (card.enabled || hasPendingUpdate) ? react.createElement("span", { className: "mpl-statusDot", "data-phase": hasPendingUpdate ? "pending" : card.fiberPhase ?? "unobserved", role: "img", "aria-label": hasPendingUpdate ? t("pendingUpdate") : phase, title: hasPendingUpdate ? t("pendingUpdate") : phase }) : null, react.createElement("span", { className: "mpl-configTag", "data-enabled": hasPendingUpdate ? "false" : card.enabled ? "true" : "false", "data-pending": hasPendingUpdate ? "true" : void 0 }, configuration), react.createElement("svg", { className: "mpl-chevron", viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": "true" }, react.createElement("path", { d: "M4 5.5l3 3 3-3", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round" })))
								),
								open ? react.createElement("div", { className: "mpl-cardDetails", id: detailId },
									react.createElement("code", { className: "mpl-entryValue", "data-loader-entry": true }, card.entryIds.join(", ")),
									react.createElement("dl", { className: "mpl-details" },
										react.createElement("div", null, react.createElement("dt", null, t("configuration")), react.createElement("dd", null, configuration)),
										card.enabled ? react.createElement("div", null, react.createElement("dt", null, t("cordis")), react.createElement("dd", null, phase)) : null,
										react.createElement("div", null, react.createElement("dt", null, t("version")), react.createElement("dd", null, card.version || "--")),
										react.createElement("div", null, react.createElement("dt", null, t("source")), react.createElement("dd", null, sourceLabel(card.source, t))),
										react.createElement("div", null, react.createElement("dt", null, t("description")), react.createElement("dd", null, card.description || t("noDescription")))
									),
									react.createElement("div", { className: "mpl-actions" },
										react.createElement("button", { className: "mpl-action", type: "button", disabled: !!pending || !card.management.canToggle, title: card.management.canToggle ? "" : card.management.reason, onClick: () => toggle(card) }, pending === "toggle" ? t(card.enabled ? "disable" : "enable") + "…" : t(card.enabled ? "disable" : "enable")),
										react.createElement("button", { className: updateReady ? "mpl-action mpl-actionUpdate" : "mpl-action", type: "button", disabled: !!pending || !card.management.canCheckUpdate, title: card.management.canCheckUpdate ? "" : t("unavailable"), onClick: () => updateReady ? update(card) : checkUpdate(card) }, pending === "check" ? t("checking") : pending === "update" ? t("updating") : updateReady ? t("updateNow") : t("checkUpdate")),
										react.createElement("button", { className: "mpl-action mpl-actionDanger", type: "button", disabled: !!pending || !card.management.canRemove, title: card.management.canRemove ? "" : card.management.reason, onClick: () => confirmRemove(card, () => remove(card)) }, pending === "remove" ? t("removing") : t("remove"))
									)
								) : null
							);
						})) : null
					) : null
				);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
