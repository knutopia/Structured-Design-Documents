import { At as onBeforeMount, Ft as onMounted, Jt as renderSlot, K as createCommentVNode, Kn as ref, M as Fragment, Ot as nextTick, Qn as toRef, U as computed, Ut as provide, Vt as openBlock, W as createBaseVNode, Wn as reactive, cn as useId, cr as toDisplayString, dn as useSlots, gn as watch, nr as unref, nt as defineComponent, q as createElementBlock, qt as renderList, xt as inject, zt as onUnmounted } from "./vue.runtime.esm-bundler-DImVG_PK.js";
import "/home/knut/projects/sdd/node_modules/.pnpm/vitepress-plugin-tabs@0.9.1_vitepress@2.0.0-alpha.18_@types+node@22.19.15_esbuild@0.27._4f63119dd2035e08c5b895a151613f57/node_modules/vitepress-plugin-tabs/dist/client/browser/style.css";
//#region node_modules/.pnpm/vitepress-plugin-tabs@0.9.1_vitepress@2.0.0-alpha.18_@types+node@22.19.15_esbuild@0.27._4f63119dd2035e08c5b895a151613f57/node_modules/vitepress-plugin-tabs/dist/client/browser/index.js
var useStabilizeScrollPosition = (targetEle) => {
	if (typeof document === "undefined") {
		const mock = (f) => async (...args) => f(...args);
		return { stabilizeScrollPosition: mock };
	}
	const scrollableEleVal = document.documentElement;
	const stabilizeScrollPosition = (func) => async (...args) => {
		const result = func(...args);
		const eleVal = targetEle.value;
		if (!eleVal) return result;
		const offset = eleVal.offsetTop - scrollableEleVal.scrollTop;
		await nextTick();
		scrollableEleVal.scrollTop = eleVal.offsetTop - offset;
		return result;
	};
	return { stabilizeScrollPosition };
};
var injectionKey$1 = "vitepress:tabSharedState";
var ls = typeof localStorage !== "undefined" ? localStorage : null;
var localStorageKey = "vitepress:tabsSharedState";
var getLocalStorageValue = () => {
	const rawValue = ls?.getItem(localStorageKey);
	if (rawValue) try {
		return JSON.parse(rawValue);
	} catch {}
	return {};
};
var setLocalStorageValue = (v) => {
	if (!ls) return;
	ls.setItem(localStorageKey, JSON.stringify(v));
};
var provideTabsSharedState = (app) => {
	const state = reactive({});
	watch(() => state.content, (newStateContent, oldStateContent) => {
		if (newStateContent && oldStateContent) setLocalStorageValue(newStateContent);
	}, { deep: true });
	app.provide(injectionKey$1, state);
};
var useTabsSelectedState = (acceptValues, sharedStateKey) => {
	const sharedState = inject(injectionKey$1);
	if (!sharedState) throw new Error("[vitepress-plugin-tabs] TabsSharedState should be injected");
	onMounted(() => {
		if (!sharedState.content) sharedState.content = getLocalStorageValue();
	});
	const nonSharedState = ref();
	const selected = computed({
		get() {
			const key = sharedStateKey.value;
			const acceptVals = acceptValues.value;
			if (key) {
				const value = sharedState.content?.[key];
				if (value && acceptVals.includes(value)) return value;
			} else {
				const nonSharedStateVal = nonSharedState.value;
				if (nonSharedStateVal) return nonSharedStateVal;
			}
			return acceptVals[0];
		},
		set(v) {
			const key = sharedStateKey.value;
			if (key) {
				if (sharedState.content) sharedState.content[key] = v;
			} else nonSharedState.value = v;
		}
	});
	const select = (newValue) => {
		selected.value = newValue;
	};
	return {
		selected,
		select
	};
};
function useTabLabels() {
	const slots = useSlots();
	return computed(() => {
		const defaultSlot = slots.default?.();
		if (!defaultSlot) return [];
		return defaultSlot.filter((vnode) => typeof vnode.type === "object" && "__name" in vnode.type && vnode.type.__name === "PluginTabsTab" && vnode.props).map((vnode) => vnode.props?.label);
	});
}
var injectionKey = "vitepress:tabSingleState";
var provideTabsSingleState = (state) => {
	provide(injectionKey, state);
};
var useTabsSingleState = () => {
	const singleState = inject(injectionKey);
	if (!singleState) throw new Error("[vitepress-plugin-tabs] TabsSingleState should be injected");
	return singleState;
};
var useIsPrint = () => {
	const matchMedia = typeof window !== "undefined" ? window.matchMedia("print") : void 0;
	const value = ref(matchMedia?.matches);
	const listener = () => {
		value.value = matchMedia?.matches;
	};
	onBeforeMount(() => {
		matchMedia?.addEventListener("change", listener);
	});
	onUnmounted(() => {
		matchMedia?.removeEventListener("change", listener);
	});
	return value;
};
var _hoisted_1$1 = ["data-variant"];
var _hoisted_2 = [
	"id",
	"aria-selected",
	"aria-controls",
	"tabindex",
	"onClick"
];
var _sfc_main$1 = /* @__PURE__ */ defineComponent({
	__name: "PluginTabs",
	props: {
		sharedStateKey: {},
		variant: {}
	},
	setup(__props) {
		const props = __props;
		const isPrint = useIsPrint();
		const tabLabels = useTabLabels();
		const { selected, select } = useTabsSelectedState(tabLabels, toRef(props, "sharedStateKey"));
		const tablist = ref();
		const { stabilizeScrollPosition } = useStabilizeScrollPosition(tablist);
		const selectStable = stabilizeScrollPosition(select);
		const buttonRefs = ref([]);
		const onKeydown = (e) => {
			const currentIndex = tabLabels.value.indexOf(selected.value);
			let selectIndex;
			if (e.key === "ArrowLeft") selectIndex = currentIndex >= 1 ? currentIndex - 1 : tabLabels.value.length - 1;
			else if (e.key === "ArrowRight") selectIndex = currentIndex < tabLabels.value.length - 1 ? currentIndex + 1 : 0;
			if (selectIndex !== void 0) {
				selectStable(tabLabels.value[selectIndex]);
				buttonRefs.value[selectIndex]?.focus();
			}
		};
		const uid = useId();
		provideTabsSingleState({
			uid,
			selected
		});
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				class: "plugin-tabs",
				"data-variant": props.variant
			}, [createBaseVNode("div", {
				ref_key: "tablist",
				ref: tablist,
				class: "plugin-tabs--tab-list",
				role: "tablist",
				onKeydown
			}, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(tabLabels), (tabLabel) => {
				return openBlock(), createElementBlock("button", {
					id: `tab-${tabLabel}-${unref(uid)}`,
					ref_for: true,
					ref_key: "buttonRefs",
					ref: buttonRefs,
					key: tabLabel,
					role: "tab",
					class: "plugin-tabs--tab",
					"aria-selected": tabLabel === unref(selected) && !unref(isPrint),
					"aria-controls": `panel-${tabLabel}-${unref(uid)}`,
					tabindex: tabLabel === unref(selected) ? 0 : -1,
					onClick: () => unref(selectStable)(tabLabel)
				}, toDisplayString(tabLabel), 9, _hoisted_2);
			}), 128))], 544), renderSlot(_ctx.$slots, "default")], 8, _hoisted_1$1);
		};
	}
});
var export_helper_default = (sfc, props) => {
	const target = sfc.__vccOpts || sfc;
	for (const [key, val] of props) target[key] = val;
	return target;
};
var _hoisted_1 = [
	"id",
	"aria-labelledby",
	"data-is-print"
];
var PluginTabsTab_default = /* @__PURE__ */ export_helper_default(/* @__PURE__ */ defineComponent({
	__name: "PluginTabsTab",
	props: { label: {} },
	setup(__props) {
		const { uid, selected } = useTabsSingleState();
		const isPrint = useIsPrint();
		return (_ctx, _cache) => {
			return unref(selected) === __props.label || unref(isPrint) ? (openBlock(), createElementBlock("div", {
				key: 0,
				id: `panel-${__props.label}-${unref(uid)}`,
				class: "plugin-tabs--content",
				role: "tabpanel",
				tabindex: "0",
				"aria-labelledby": `tab-${__props.label}-${unref(uid)}`,
				"data-is-print": unref(isPrint)
			}, [renderSlot(_ctx.$slots, "default", {}, void 0, true)], 8, _hoisted_1)) : createCommentVNode("v-if", true);
		};
	}
}), [["__scopeId", "data-v-7d212f86"]]);
var enhanceAppWithTabs = (app) => {
	provideTabsSharedState(app);
	app.component("PluginTabs", _sfc_main$1);
	app.component("PluginTabsTab", PluginTabsTab_default);
};
//#endregion
export { enhanceAppWithTabs };
