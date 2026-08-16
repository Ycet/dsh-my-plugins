// dsh-my-plugins — browser half（ModuleLoader bundle）
// 「我的插件」页签：双列卡片展示用户安装的插件，点击展开配置状态 / Cordis 状态 / 插件介绍。
window.__ModuleLoader__.load({
	id: "dsh-my-plugins",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const NS = "settings.myPlugins";
		const PREFIX = "/my-plugins/api";

		const zh = {
			tab: "我的插件",
			loading: "正在读取插件…",
			error: "暂时无法读取插件。",
			retry: "重试",
			search: "搜索插件",
			catalog: "我的插件",
			empty: "暂无用户安装的插件。",
			emptySearch: "没有匹配的插件。",
			enabledTag: "已启用",
			disabledTag: "已停用",
			configuration: "配置状态",
			cordis: "Cordis 状态",
			description: "插件介绍",
			noDescription: "（暂无介绍）",
			unobserved: "未挂载",
			pending: "等待依赖",
			loadingPhase: "加载中",
			active: "已挂载",
			failed: "挂载失败",
			unloading: "卸载中"
		};
		const en = {
			tab: "My Plugins",
			loading: "Reading plugins…",
			error: "Plugins are temporarily unavailable.",
			retry: "Retry",
			search: "Search plugins",
			catalog: "My plugins",
			empty: "No user-installed plugins.",
			emptySearch: "No matching plugins.",
			enabledTag: "Enabled",
			disabledTag: "Disabled",
			configuration: "Configuration",
			cordis: "Cordis status",
			description: "Description",
			noDescription: "No description.",
			unobserved: "Not mounted",
			pending: "Waiting for dependencies",
			loadingPhase: "Loading",
			active: "Mounted",
			failed: "Mount failed",
			unloading: "Unloading"
		};

		const css = ".mpl-section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.mpl-search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.mpl-search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 12px;font-size:13px}.mpl-search input::placeholder{color:var(--dsw-alias-label-tertiary)}.mpl-search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.mpl-heading{align-items:baseline;gap:7px;padding:0 2px;display:flex}.mpl-heading h3{margin:0;font-size:13px;font-weight:600;line-height:20px}.mpl-heading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}.mpl-status{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.mpl-failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;margin:0;font-size:13px;line-height:20px;display:flex}.mpl-failure button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}.mpl-cards{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:10px;margin:0;padding:0;list-style:none;display:grid}.mpl-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;overflow:hidden}.mpl-card[data-open=true]{border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv1)}.mpl-cardContent{box-sizing:border-box;width:100%;min-height:52px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;display:flex}.mpl-cardContent:hover,.mpl-card[data-open=true]>.mpl-cardContent{background:var(--dsw-alias-interactive-bg-hover)}.mpl-cardContent:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.mpl-cardTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;line-height:20px;overflow:hidden}.mpl-cardTrailing{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:7px;display:inline-flex}.mpl-statusDot{background:var(--dsw-alias-label-tertiary);border-radius:999px;flex:none;width:7px;height:7px;display:inline-block}.mpl-statusDot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}.mpl-statusDot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}.mpl-statusDot[data-phase=loading]{background:var(--dsw-alias-state-business-primary)}.mpl-configTag{background:var(--dsw-alias-bg-layer-1);min-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:5px;align-items:center;padding:1px 6px;font-size:11px;line-height:16px;display:inline-flex}.mpl-configTag[data-enabled=true]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}.mpl-chevron{color:var(--dsw-alias-label-tertiary);flex:none}.mpl-card[data-open=true] .mpl-chevron{transform:rotate(180deg)}.mpl-cardDetails{border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:10px 14px 12px}.mpl-entryValue{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;display:block}.mpl-details{grid-template-columns:76px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;display:grid}.mpl-details div{display:contents}.mpl-details dt{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}.mpl-details dd{overflow-wrap:anywhere;min-width:0;color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:17px}.mpl-visuallyHidden{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:no-preference){.mpl-chevron{transition:transform .14s var(--ds-ease-in-out)}}@media (width<=680px){.mpl-cards{grid-template-columns:minmax(0,1fr)}}";
		const tagId = "dsh-my-plugins/tab.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-my-plugins";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/** 调用 host 半部的 /my-plugins/api/<method> JSON RPC。 */
		function call(method, payload) {
			return fetch(PREFIX + "/" + method, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload ?? {})
			}).then((response) => {
				if (!response.ok) throw new Error("HTTP " + response.status);
				return response.json();
			});
		}

		/** 短模块名（与官方插件清单一致）。 */
		function moduleShortName(moduleName) {
			return (moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName)
				.replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
		}

		const inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-my-plugins: dictionaries");
			const t = ctx.locale.bind(NS);

			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "mine",
				order: 20,
				label: () => t("tab"),
				locale: NS
			}, MyPluginsTab));

			const phaseLabel = (phase) => t(phase ?? "unobserved");

			function MyPluginsTab() {
				const [state, setState] = react.useState({ status: "loading", entries: [] });
				const [query, setQuery] = react.useState("");
				const [expanded, setExpanded] = react.useState(null);

				const load = react.useCallback(async () => {
					setState({ status: "loading", entries: [] });
					try {
						const result = await call("list", {});
						if (result && result.ok !== true) {
							setState({ status: "error", entries: [], detail: (result && result.error) || "unavailable" });
							return;
						}
						setState({ status: "ready", entries: Array.isArray(result.entries) ? result.entries : [] });
					} catch (err) {
						setState({ status: "error", entries: [], detail: String(err && err.message || err) });
					}
				}, []);

				react.useEffect(() => { load(); }, [load]);

				const normalized = query.trim().toLocaleLowerCase();
				const filtered = state.entries.filter((entry) => {
					if (!normalized) return true;
					return [entry.moduleName, entry.entryId, entry.description || ""].some((v) =>
						String(v).toLocaleLowerCase().includes(normalized));
				});

				return react.createElement("div", { className: "mpl-section" },
					state.status === "loading" ? react.createElement("p", { className: "mpl-status" }, t("loading")) : null,
					state.status === "error" ? react.createElement("div", { className: "mpl-failure", role: "alert" },
						react.createElement("p", null, t("error")),
						state.detail ? react.createElement("code", { className: "mpl-entryValue" }, state.detail) : null,
						react.createElement("button", { type: "button", onClick: load }, t("retry"))
					) : null,
					state.status === "ready" ? react.createElement("div", { className: "mpl-catalog" },
						react.createElement("label", { className: "mpl-search" },
							react.createElement("span", { className: "mpl-visuallyHidden" }, t("search")),
							react.createElement("input", {
								type: "search", value: query, placeholder: t("search"),
								"aria-label": t("search"),
								onChange: (event) => setQuery(event.currentTarget.value)
							})
						),
						react.createElement("div", { className: "mpl-heading" },
							react.createElement("h3", null, t("catalog")),
							react.createElement("span", { "data-plugin-count": filtered.length }, String(filtered.length))
						),
						state.entries.length === 0 ? react.createElement("p", { className: "mpl-status" }, t("empty")) : null,
						state.entries.length > 0 && filtered.length === 0 ? react.createElement("p", { className: "mpl-status" }, t("emptySearch")) : null,
						filtered.length > 0 ? react.createElement("ul", { className: "mpl-cards" },
							filtered.map((entry) => {
								const title = moduleShortName(entry.moduleName);
								const configuration = t(entry.enabled ? "enabledTag" : "disabledTag");
								const status = phaseLabel(entry.fiberPhase);
								const open = expanded === entry.entryId;
								const detailId = "mpl-details-" + encodeURIComponent(entry.entryId);
								return react.createElement("li", { key: entry.entryId, className: "mpl-card", "data-plugin-entry": entry.entryId, "data-open": open ? "true" : void 0 },
									react.createElement("button", {
										className: "mpl-cardContent", type: "button",
										"aria-expanded": open, "aria-controls": detailId,
										"aria-label": entry.enabled ? title + ", " + status + ", " + configuration : title + ", " + configuration,
										onClick: () => setExpanded((current) => (current === entry.entryId ? null : entry.entryId))
									},
										react.createElement("strong", { className: "mpl-cardTitle", title: entry.moduleName }, title),
										react.createElement("span", { className: "mpl-cardTrailing" },
											entry.enabled ? react.createElement("span", {
												className: "mpl-statusDot", "data-phase": entry.fiberPhase ?? "unobserved",
												role: "img", "aria-label": status, title: status
											}) : null,
											react.createElement("span", { className: "mpl-configTag", "data-enabled": entry.enabled ? "true" : "false" }, configuration),
											react.createElement("svg", { className: "mpl-chevron", viewBox: "0 0 14 14", width: 12, height: 12, "aria-hidden": "true" },
												react.createElement("path", { d: "M4 5.5l3 3 3-3", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round" })
											)
										)
									),
									open ? react.createElement("div", { className: "mpl-cardDetails", id: detailId },
										react.createElement("code", { className: "mpl-entryValue", "data-loader-entry": true }, entry.entryId),
										react.createElement("dl", { className: "mpl-details" },
											react.createElement("div", null,
												react.createElement("dt", null, t("configuration")),
												react.createElement("dd", null, configuration)
											),
											entry.enabled ? react.createElement("div", null,
												react.createElement("dt", null, t("cordis")),
												react.createElement("dd", null, status)
											) : null,
											react.createElement("div", null,
												react.createElement("dt", null, t("description")),
												react.createElement("dd", null, entry.description || t("noDescription"))
											)
										)
									) : null
								);
							})
						) : null
					) : null
				);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
