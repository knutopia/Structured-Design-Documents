//#region node_modules/.pnpm/@vue+devtools-shared@8.1.5/node_modules/@vue/devtools-shared/dist/index.js
var __create$1 = Object.create;
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames$1 = Object.getOwnPropertyNames;
var __getProtoOf$1 = Object.getPrototypeOf;
var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
var __commonJSMin$1 = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps$1 = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames$1(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp$1.call(to, key) && key !== except) __defProp$1(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc$1(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM$1 = (mod, isNodeMode, target) => (target = mod != null ? __create$1(__getProtoOf$1(mod)) : {}, __copyProps$1(isNodeMode || !mod || !mod.__esModule ? __defProp$1(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var isBrowser = typeof navigator !== "undefined";
var target = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : {};
typeof target.chrome !== "undefined" && target.chrome.devtools;
isBrowser && (target.self, target.top);
typeof navigator !== "undefined" && navigator.userAgent?.toLowerCase().includes("electron");
typeof window !== "undefined" && window.__NUXT__;
var import_rfdc = /* @__PURE__ */ __toESM$1((/* @__PURE__ */ __commonJSMin$1(((exports, module) => {
	module.exports = rfdc;
	function copyBuffer(cur) {
		if (cur instanceof Buffer) return Buffer.from(cur);
		return new cur.constructor(cur.buffer.slice(), cur.byteOffset, cur.length);
	}
	function rfdc(opts) {
		opts = opts || {};
		if (opts.circles) return rfdcCircles(opts);
		const constructorHandlers = /* @__PURE__ */ new Map();
		constructorHandlers.set(Date, (o) => new Date(o));
		constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
		constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
		if (opts.constructorHandlers) for (const handler of opts.constructorHandlers) constructorHandlers.set(handler[0], handler[1]);
		let handler = null;
		return opts.proto ? cloneProto : clone;
		function cloneArray(a, fn) {
			const keys = Object.keys(a);
			const a2 = new Array(keys.length);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const cur = a[k];
				if (typeof cur !== "object" || cur === null) a2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) a2[k] = handler(cur, fn);
				else if (ArrayBuffer.isView(cur)) a2[k] = copyBuffer(cur);
				else a2[k] = fn(cur);
			}
			return a2;
		}
		function clone(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, clone);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, clone);
			const o2 = {};
			for (const k in o) {
				if (Object.hasOwnProperty.call(o, k) === false) continue;
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, clone);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else o2[k] = clone(cur);
			}
			return o2;
		}
		function cloneProto(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, cloneProto);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, cloneProto);
			const o2 = {};
			for (const k in o) {
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, cloneProto);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else o2[k] = cloneProto(cur);
			}
			return o2;
		}
	}
	function rfdcCircles(opts) {
		const refs = [];
		const refsNew = [];
		const constructorHandlers = /* @__PURE__ */ new Map();
		constructorHandlers.set(Date, (o) => new Date(o));
		constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
		constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
		if (opts.constructorHandlers) for (const handler of opts.constructorHandlers) constructorHandlers.set(handler[0], handler[1]);
		let handler = null;
		return opts.proto ? cloneProto : clone;
		function cloneArray(a, fn) {
			const keys = Object.keys(a);
			const a2 = new Array(keys.length);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const cur = a[k];
				if (typeof cur !== "object" || cur === null) a2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) a2[k] = handler(cur, fn);
				else if (ArrayBuffer.isView(cur)) a2[k] = copyBuffer(cur);
				else {
					const index = refs.indexOf(cur);
					if (index !== -1) a2[k] = refsNew[index];
					else a2[k] = fn(cur);
				}
			}
			return a2;
		}
		function clone(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, clone);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, clone);
			const o2 = {};
			refs.push(o);
			refsNew.push(o2);
			for (const k in o) {
				if (Object.hasOwnProperty.call(o, k) === false) continue;
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, clone);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else {
					const i = refs.indexOf(cur);
					if (i !== -1) o2[k] = refsNew[i];
					else o2[k] = clone(cur);
				}
			}
			refs.pop();
			refsNew.pop();
			return o2;
		}
		function cloneProto(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, cloneProto);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, cloneProto);
			const o2 = {};
			refs.push(o);
			refsNew.push(o2);
			for (const k in o) {
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, cloneProto);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else {
					const i = refs.indexOf(cur);
					if (i !== -1) o2[k] = refsNew[i];
					else o2[k] = cloneProto(cur);
				}
			}
			refs.pop();
			refsNew.pop();
			return o2;
		}
	}
})))(), 1);
var classifyRE = /(?:^|[-_/])(\w)/g;
function toUpper(_, c) {
	return c ? c.toUpperCase() : "";
}
function classify(str) {
	return str && `${str}`.replace(classifyRE, toUpper);
}
function basename(filename, ext) {
	let normalizedFilename = filename.replace(/^[a-z]:/i, "").replace(/\\/g, "/");
	if (normalizedFilename.endsWith(`index${ext}`)) normalizedFilename = normalizedFilename.replace(`/index${ext}`, ext);
	const lastSlashIndex = normalizedFilename.lastIndexOf("/");
	const baseNameWithExt = normalizedFilename.substring(lastSlashIndex + 1);
	if (ext) {
		const extIndex = baseNameWithExt.lastIndexOf(ext);
		return baseNameWithExt.substring(0, extIndex);
	}
	return "";
}
var HTTP_URL_RE = /^https?:\/\//;
/**
* Check a string is start with `/` or a valid http url
*/
function isUrlString(str) {
	return str.startsWith("/") || HTTP_URL_RE.test(str);
}
/**
* @copyright [rfdc](https://github.com/davidmarkclements/rfdc)
* @description A really fast deep clone alternative
*/
var deepClone = (0, import_rfdc.default)({ circles: true });
//#endregion
//#region node_modules/.pnpm/perfect-debounce@2.1.0/node_modules/perfect-debounce/dist/index.mjs
var DEBOUNCE_DEFAULTS = { trailing: true };
/**
Debounce functions
@param fn - Promise-returning/async function to debounce.
@param wait - Milliseconds to wait before calling `fn`. Default value is 25ms
@returns A function that delays calling `fn` until after `wait` milliseconds have elapsed since the last time it was called.
@example
```
import { debounce } from 'perfect-debounce';
const expensiveCall = async input => input;
const debouncedFn = debounce(expensiveCall, 200);
for (const number of [1, 2, 3]) {
console.log(await debouncedFn(number));
}
//=> 1
//=> 2
//=> 3
```
*/
function debounce(fn, wait = 25, options = {}) {
	options = {
		...DEBOUNCE_DEFAULTS,
		...options
	};
	if (!Number.isFinite(wait)) throw new TypeError("Expected `wait` to be a finite number");
	let leadingValue;
	let timeout;
	let resolveList = [];
	let currentPromise;
	let trailingArgs;
	const applyFn = (_this, args) => {
		currentPromise = _applyPromised(fn, _this, args);
		currentPromise.finally(() => {
			currentPromise = null;
			if (options.trailing && trailingArgs && !timeout) {
				const promise = applyFn(_this, trailingArgs);
				trailingArgs = null;
				return promise;
			}
		});
		return currentPromise;
	};
	const debounced = function(...args) {
		if (options.trailing) trailingArgs = args;
		if (currentPromise) return currentPromise;
		return new Promise((resolve) => {
			const shouldCallNow = !timeout && options.leading;
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				timeout = null;
				const promise = options.leading ? leadingValue : applyFn(this, args);
				trailingArgs = null;
				for (const _resolve of resolveList) _resolve(promise);
				resolveList = [];
			}, wait);
			if (shouldCallNow) {
				leadingValue = applyFn(this, args);
				resolve(leadingValue);
			} else resolveList.push(resolve);
		});
	};
	const _clearTimeout = (timer) => {
		if (timer) {
			clearTimeout(timer);
			timeout = null;
		}
	};
	debounced.isPending = () => !!timeout;
	debounced.cancel = () => {
		_clearTimeout(timeout);
		resolveList = [];
		trailingArgs = null;
	};
	debounced.flush = () => {
		_clearTimeout(timeout);
		if (!trailingArgs || currentPromise) return;
		const args = trailingArgs;
		trailingArgs = null;
		return applyFn(this, args);
	};
	return debounced;
}
async function _applyPromised(fn, _this, args) {
	return await fn.apply(_this, args);
}
//#endregion
//#region node_modules/.pnpm/hookable@5.5.3/node_modules/hookable/dist/index.mjs
function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
var defaultTask = { run: (function_) => function_() };
var _createTask = () => defaultTask;
var createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
	const task = createTask(args.shift());
	return hooks.reduce((promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))), Promise.resolve());
}
function parallelTaskCaller(hooks, args) {
	const task = createTask(args.shift());
	return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
var Hookable = class {
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		if (this._hooks[name]) {
			const index = this._hooks[name].indexOf(function_);
			if (index !== -1) this._hooks[name].splice(index, 1);
			if (this._hooks[name].length === 0) delete this._hooks[name];
		}
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		delete this._hooks[name];
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		Object.assign(this._deprecatedHooks, deprecatedHooks);
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns.splice(0, removeFns.length)) unreg();
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		for (const key in this._hooks) delete this._hooks[key];
	}
	callHook(name, ...arguments_) {
		arguments_.unshift(name);
		return this.callHookWith(serialTaskCaller, name, ...arguments_);
	}
	callHookParallel(name, ...arguments_) {
		arguments_.unshift(name);
		return this.callHookWith(parallelTaskCaller, name, ...arguments_);
	}
	callHookWith(caller, name, ...arguments_) {
		const event = this._before || this._after ? {
			name,
			args: arguments_,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(name in this._hooks ? [...this._hooks[name]] : [], arguments_);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}
//#endregion
//#region node_modules/.pnpm/birpc@2.9.0/node_modules/birpc/dist/index.mjs
var { clearTimeout: clearTimeout$1, setTimeout: setTimeout$1 } = globalThis;
Math.random.bind(Math);
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
function getComponentTypeName(options) {
	if (typeof options === "function") return options.displayName || options.name || options.__VUE_DEVTOOLS_COMPONENT_GUSSED_NAME__ || "";
	const name = options.name || options._componentTag || options.__VUE_DEVTOOLS_COMPONENT_GUSSED_NAME__ || options.__name;
	if (name === "index" && options.__file?.endsWith("index.vue")) return "";
	return name;
}
function getComponentFileName(options) {
	const file = options.__file;
	if (file) return classify(basename(file, ".vue"));
}
function saveComponentGussedName(instance, name) {
	instance.type.__VUE_DEVTOOLS_COMPONENT_GUSSED_NAME__ = name;
	return name;
}
function getAppRecord(instance) {
	if (instance.__VUE_DEVTOOLS_NEXT_APP_RECORD__) return instance.__VUE_DEVTOOLS_NEXT_APP_RECORD__;
	else if (instance.root) return instance.appContext.app.__VUE_DEVTOOLS_NEXT_APP_RECORD__;
}
function isFragment(instance) {
	const subTreeType = instance.subTree?.type;
	const appRecord = getAppRecord(instance);
	if (appRecord) return appRecord?.types?.Fragment === subTreeType;
	return false;
}
/**
* Get the appropriate display name for an instance.
*
* @param {Vue} instance
* @return {string}
*/
function getInstanceName(instance) {
	const name = getComponentTypeName(instance?.type || {});
	if (name) return name;
	if (instance?.root === instance) return "Root";
	for (const key in instance.parent?.type?.components) if (instance.parent.type.components[key] === instance?.type) return saveComponentGussedName(instance, key);
	for (const key in instance.appContext?.components) if (instance.appContext.components[key] === instance?.type) return saveComponentGussedName(instance, key);
	const fileName = getComponentFileName(instance?.type || {});
	if (fileName) return fileName;
	return "Anonymous Component";
}
/**
* Returns a devtools unique id for instance.
* @param {Vue} instance
*/
function getUniqueComponentId(instance) {
	return `${instance?.appContext?.app?.__VUE_DEVTOOLS_NEXT_APP_RECORD_ID__ ?? 0}:${instance === instance?.root ? "root" : instance.uid}`;
}
function getComponentInstance(appRecord, instanceId) {
	instanceId = instanceId || `${appRecord.id}:root`;
	return appRecord.instanceMap.get(instanceId) || appRecord.instanceMap.get(":root");
}
function createRect() {
	const rect = {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		get width() {
			return rect.right - rect.left;
		},
		get height() {
			return rect.bottom - rect.top;
		}
	};
	return rect;
}
var range;
function getTextRect(node) {
	if (!range) range = document.createRange();
	range.selectNode(node);
	return range.getBoundingClientRect();
}
function getFragmentRect(vnode) {
	const rect = createRect();
	if (!vnode.children) return rect;
	for (let i = 0, l = vnode.children.length; i < l; i++) {
		const childVnode = vnode.children[i];
		let childRect;
		if (childVnode.component) childRect = getComponentBoundingRect(childVnode.component);
		else if (childVnode.el) {
			const el = childVnode.el;
			if (el.nodeType === 1 || el.getBoundingClientRect) childRect = el.getBoundingClientRect();
			else if (el.nodeType === 3 && el.data.trim()) childRect = getTextRect(el);
		}
		if (childRect) mergeRects(rect, childRect);
	}
	return rect;
}
function mergeRects(a, b) {
	if (!a.top || b.top < a.top) a.top = b.top;
	if (!a.bottom || b.bottom > a.bottom) a.bottom = b.bottom;
	if (!a.left || b.left < a.left) a.left = b.left;
	if (!a.right || b.right > a.right) a.right = b.right;
	return a;
}
var DEFAULT_RECT = {
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	width: 0,
	height: 0
};
function getComponentBoundingRect(instance) {
	const el = instance.subTree.el;
	if (typeof window === "undefined") return DEFAULT_RECT;
	if (isFragment(instance)) return getFragmentRect(instance.subTree);
	else if (el?.nodeType === 1) return el?.getBoundingClientRect();
	else if (instance.subTree.component) return getComponentBoundingRect(instance.subTree.component);
	else return DEFAULT_RECT;
}
function getRootElementsFromComponentInstance(instance) {
	if (isFragment(instance)) return getFragmentRootElements(instance.subTree);
	if (!instance.subTree) return [];
	return [instance.subTree.el];
}
function getFragmentRootElements(vnode) {
	if (!vnode.children) return [];
	const list = [];
	vnode.children.forEach((childVnode) => {
		if (childVnode.component) list.push(...getRootElementsFromComponentInstance(childVnode.component));
		else if (childVnode?.el) list.push(childVnode.el);
	});
	return list;
}
var CONTAINER_ELEMENT_ID = "__vue-devtools-component-inspector__";
var CARD_ELEMENT_ID = "__vue-devtools-component-inspector__card__";
var COMPONENT_NAME_ELEMENT_ID = "__vue-devtools-component-inspector__name__";
var INDICATOR_ELEMENT_ID = "__vue-devtools-component-inspector__indicator__";
var containerStyles = {
	display: "block",
	zIndex: 2147483640,
	position: "fixed",
	backgroundColor: "#42b88325",
	border: "1px solid #42b88350",
	borderRadius: "5px",
	transition: "all 0.1s ease-in",
	pointerEvents: "none"
};
var cardStyles = {
	fontFamily: "Arial, Helvetica, sans-serif",
	padding: "5px 8px",
	borderRadius: "4px",
	textAlign: "left",
	position: "absolute",
	left: 0,
	color: "#e9e9e9",
	fontSize: "14px",
	fontWeight: 600,
	lineHeight: "24px",
	backgroundColor: "#42b883",
	boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)"
};
var indicatorStyles = {
	display: "inline-block",
	fontWeight: 400,
	fontStyle: "normal",
	fontSize: "12px",
	opacity: .7
};
function getContainerElement() {
	return document.getElementById(CONTAINER_ELEMENT_ID);
}
function getCardElement() {
	return document.getElementById(CARD_ELEMENT_ID);
}
function getIndicatorElement() {
	return document.getElementById(INDICATOR_ELEMENT_ID);
}
function getNameElement() {
	return document.getElementById(COMPONENT_NAME_ELEMENT_ID);
}
function getStyles(bounds) {
	return {
		left: `${Math.round(bounds.left * 100) / 100}px`,
		top: `${Math.round(bounds.top * 100) / 100}px`,
		width: `${Math.round(bounds.width * 100) / 100}px`,
		height: `${Math.round(bounds.height * 100) / 100}px`
	};
}
function create(options) {
	const containerEl = document.createElement("div");
	containerEl.id = options.elementId ?? CONTAINER_ELEMENT_ID;
	Object.assign(containerEl.style, {
		...containerStyles,
		...getStyles(options.bounds),
		...options.style
	});
	const cardEl = document.createElement("span");
	cardEl.id = CARD_ELEMENT_ID;
	Object.assign(cardEl.style, {
		...cardStyles,
		top: options.bounds.top < 35 ? 0 : "-35px"
	});
	const nameEl = document.createElement("span");
	nameEl.id = COMPONENT_NAME_ELEMENT_ID;
	nameEl.innerHTML = `&lt;${options.name}&gt;&nbsp;&nbsp;`;
	const indicatorEl = document.createElement("i");
	indicatorEl.id = INDICATOR_ELEMENT_ID;
	indicatorEl.innerHTML = `${Math.round(options.bounds.width * 100) / 100} x ${Math.round(options.bounds.height * 100) / 100}`;
	Object.assign(indicatorEl.style, indicatorStyles);
	cardEl.appendChild(nameEl);
	cardEl.appendChild(indicatorEl);
	containerEl.appendChild(cardEl);
	document.body.appendChild(containerEl);
	return containerEl;
}
function update(options) {
	const containerEl = getContainerElement();
	const cardEl = getCardElement();
	const nameEl = getNameElement();
	const indicatorEl = getIndicatorElement();
	if (containerEl) {
		Object.assign(containerEl.style, {
			...containerStyles,
			...getStyles(options.bounds)
		});
		Object.assign(cardEl.style, { top: options.bounds.top < 35 ? 0 : "-35px" });
		nameEl.innerHTML = `&lt;${options.name}&gt;&nbsp;&nbsp;`;
		indicatorEl.innerHTML = `${Math.round(options.bounds.width * 100) / 100} x ${Math.round(options.bounds.height * 100) / 100}`;
	}
}
function highlight(instance) {
	const bounds = getComponentBoundingRect(instance);
	if (!bounds.width && !bounds.height) return;
	const name = getInstanceName(instance);
	getContainerElement() ? update({
		bounds,
		name
	}) : create({
		bounds,
		name
	});
}
function unhighlight() {
	const el = getContainerElement();
	if (el) el.style.display = "none";
}
var inspectInstance = null;
function inspectFn(e) {
	const target = e.target;
	if (target) {
		const instance = target.__vueParentComponent;
		if (instance) {
			inspectInstance = instance;
			if (instance.vnode.el) {
				const bounds = getComponentBoundingRect(instance);
				const name = getInstanceName(instance);
				getContainerElement() ? update({
					bounds,
					name
				}) : create({
					bounds,
					name
				});
			}
		}
	}
}
function selectComponentFn(e, cb) {
	e.preventDefault();
	e.stopPropagation();
	if (inspectInstance) cb(getUniqueComponentId(inspectInstance));
}
var inspectComponentHighLighterSelectFn = null;
function cancelInspectComponentHighLighter() {
	unhighlight();
	window.removeEventListener("mouseover", inspectFn);
	window.removeEventListener("click", inspectComponentHighLighterSelectFn, true);
	inspectComponentHighLighterSelectFn = null;
}
function inspectComponentHighLighter() {
	window.addEventListener("mouseover", inspectFn);
	return new Promise((resolve) => {
		function onSelect(e) {
			e.preventDefault();
			e.stopPropagation();
			selectComponentFn(e, (id) => {
				window.removeEventListener("click", onSelect, true);
				inspectComponentHighLighterSelectFn = null;
				window.removeEventListener("mouseover", inspectFn);
				const el = getContainerElement();
				if (el) el.style.display = "none";
				resolve(JSON.stringify({ id }));
			});
		}
		inspectComponentHighLighterSelectFn = onSelect;
		window.addEventListener("click", onSelect, true);
	});
}
function scrollToComponent(options) {
	const instance = getComponentInstance(activeAppRecord.value, options.id);
	if (instance) {
		const [el] = getRootElementsFromComponentInstance(instance);
		if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth" });
		else {
			const bounds = getComponentBoundingRect(instance);
			const scrollTarget = document.createElement("div");
			const styles = {
				...getStyles(bounds),
				position: "absolute"
			};
			Object.assign(scrollTarget.style, styles);
			document.body.appendChild(scrollTarget);
			scrollTarget.scrollIntoView({ behavior: "smooth" });
			setTimeout(() => {
				document.body.removeChild(scrollTarget);
			}, 2e3);
		}
		setTimeout(() => {
			const bounds = getComponentBoundingRect(instance);
			if (bounds.width || bounds.height) {
				const name = getInstanceName(instance);
				const el = getContainerElement();
				el ? update({
					...options,
					name,
					bounds
				}) : create({
					...options,
					name,
					bounds
				});
				setTimeout(() => {
					if (el) el.style.display = "none";
				}, 1500);
			}
		}, 1200);
	}
}
target.__VUE_DEVTOOLS_COMPONENT_INSPECTOR_ENABLED__ ??= true;
function waitForInspectorInit(cb) {
	let total = 0;
	const timer = setInterval(() => {
		if (target.__VUE_INSPECTOR__) {
			clearInterval(timer);
			total += 30;
			cb();
		}
		if (total >= 5e3) clearInterval(timer);
	}, 30);
}
function setupInspector() {
	const inspector = target.__VUE_INSPECTOR__;
	const _openInEditor = inspector.openInEditor;
	inspector.openInEditor = async (...params) => {
		inspector.disable();
		_openInEditor(...params);
	};
}
function getComponentInspector() {
	return new Promise((resolve) => {
		function setup() {
			setupInspector();
			resolve(target.__VUE_INSPECTOR__);
		}
		if (!target.__VUE_INSPECTOR__) waitForInspectorInit(() => {
			setup();
		});
		else setup();
	});
}
/**
* To prevent include a **HUGE** vue package in the final bundle of chrome ext / electron
* we stub the necessary vue module.
* This implementation is based on the 1c3327a0fa5983aa9078e3f7bb2330f572435425 commit
*/
/**
* @from [@vue/reactivity](https://github.com/vuejs/core/blob/1c3327a0fa5983aa9078e3f7bb2330f572435425/packages/reactivity/src/constants.ts#L17-L23)
*/
var ReactiveFlags = /* @__PURE__ */ function(ReactiveFlags) {
	ReactiveFlags["SKIP"] = "__v_skip";
	ReactiveFlags["IS_REACTIVE"] = "__v_isReactive";
	ReactiveFlags["IS_READONLY"] = "__v_isReadonly";
	ReactiveFlags["IS_SHALLOW"] = "__v_isShallow";
	ReactiveFlags["RAW"] = "__v_raw";
	return ReactiveFlags;
}({});
/**
* @from [@vue/reactivity](https://github.com/vuejs/core/blob/1c3327a0fa5983aa9078e3f7bb2330f572435425/packages/reactivity/src/reactive.ts#L330-L332)
*/
function isReadonly(value) {
	return !!(value && value[ReactiveFlags.IS_READONLY]);
}
/**
* @from [@vue/reactivity](https://github.com/vuejs/core/blob/1c3327a0fa5983aa9078e3f7bb2330f572435425/packages/reactivity/src/reactive.ts#L312-L317)
*/
function isReactive$1(value) {
	if (isReadonly(value)) return isReactive$1(value[ReactiveFlags.RAW]);
	return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}
function isRef$1(r) {
	return !!(r && r.__v_isRef === true);
}
/**
* @from [@vue/reactivity](https://github.com/vuejs/core/blob/1c3327a0fa5983aa9078e3f7bb2330f572435425/packages/reactivity/src/reactive.ts#L372-L375)
*/
function toRaw$1(observed) {
	const raw = observed && observed[ReactiveFlags.RAW];
	return raw ? toRaw$1(raw) : observed;
}
var StateEditor = class {
	constructor() {
		this.refEditor = new RefStateEditor();
	}
	set(object, path, value, cb) {
		const sections = Array.isArray(path) ? path : path.split(".");
		while (sections.length > 1) {
			const section = sections.shift();
			if (object instanceof Map) object = object.get(section);
			else if (object instanceof Set) object = Array.from(object.values())[section];
			else object = object[section];
			if (this.refEditor.isRef(object)) object = this.refEditor.get(object);
		}
		const field = sections[0];
		const item = this.refEditor.get(object)[field];
		if (cb) cb(object, field, value);
		else if (this.refEditor.isRef(item)) this.refEditor.set(item, value);
		else object[field] = value;
	}
	get(object, path) {
		const sections = Array.isArray(path) ? path : path.split(".");
		for (let i = 0; i < sections.length; i++) {
			if (object instanceof Map) object = object.get(sections[i]);
			else object = object[sections[i]];
			if (this.refEditor.isRef(object)) object = this.refEditor.get(object);
			if (!object) return void 0;
		}
		return object;
	}
	has(object, path, parent = false) {
		if (typeof object === "undefined") return false;
		const sections = Array.isArray(path) ? path.slice() : path.split(".");
		const size = !parent ? 1 : 2;
		while (object && sections.length > size) {
			const section = sections.shift();
			object = object[section];
			if (this.refEditor.isRef(object)) object = this.refEditor.get(object);
		}
		return object != null && Object.prototype.hasOwnProperty.call(object, sections[0]);
	}
	createDefaultSetCallback(state) {
		return (object, field, value) => {
			if (state.remove || state.newKey) if (Array.isArray(object)) object.splice(field, 1);
			else if (toRaw$1(object) instanceof Map) object.delete(field);
			else if (toRaw$1(object) instanceof Set) object.delete(Array.from(object.values())[field]);
			else Reflect.deleteProperty(object, field);
			if (!state.remove) {
				const target = object[state.newKey || field];
				if (this.refEditor.isRef(target)) this.refEditor.set(target, value);
				else if (toRaw$1(object) instanceof Map) object.set(state.newKey || field, value);
				else if (toRaw$1(object) instanceof Set) object.add(value);
				else object[state.newKey || field] = value;
			}
		};
	}
};
var RefStateEditor = class {
	set(ref, value) {
		if (isRef$1(ref)) ref.value = value;
		else {
			if (ref instanceof Set && Array.isArray(value)) {
				ref.clear();
				value.forEach((v) => ref.add(v));
				return;
			}
			const currentKeys = Object.keys(value);
			if (ref instanceof Map) {
				const previousKeysSet = new Set(ref.keys());
				currentKeys.forEach((key) => {
					ref.set(key, Reflect.get(value, key));
					previousKeysSet.delete(key);
				});
				previousKeysSet.forEach((key) => ref.delete(key));
				return;
			}
			const previousKeysSet = new Set(Object.keys(ref));
			currentKeys.forEach((key) => {
				Reflect.set(ref, key, Reflect.get(value, key));
				previousKeysSet.delete(key);
			});
			previousKeysSet.forEach((key) => Reflect.deleteProperty(ref, key));
		}
	}
	get(ref) {
		return isRef$1(ref) ? ref.value : ref;
	}
	isRef(ref) {
		return isRef$1(ref) || isReactive$1(ref);
	}
};
new StateEditor();
var TIMELINE_LAYERS_STATE_STORAGE_ID = "__VUE_DEVTOOLS_KIT_TIMELINE_LAYERS_STATE__";
function getTimelineLayersStateFromStorage() {
	if (typeof window === "undefined" || !isBrowser || typeof localStorage === "undefined" || localStorage === null) return {
		recordingState: false,
		mouseEventEnabled: false,
		keyboardEventEnabled: false,
		componentEventEnabled: false,
		performanceEventEnabled: false,
		selected: ""
	};
	const state = typeof localStorage.getItem !== "undefined" ? localStorage.getItem(TIMELINE_LAYERS_STATE_STORAGE_ID) : null;
	return state ? JSON.parse(state) : {
		recordingState: false,
		mouseEventEnabled: false,
		keyboardEventEnabled: false,
		componentEventEnabled: false,
		performanceEventEnabled: false,
		selected: ""
	};
}
target.__VUE_DEVTOOLS_KIT_TIMELINE_LAYERS ??= [];
var devtoolsTimelineLayers = new Proxy(target.__VUE_DEVTOOLS_KIT_TIMELINE_LAYERS, { get(target, prop, receiver) {
	return Reflect.get(target, prop, receiver);
} });
function addTimelineLayer(options, descriptor) {
	devtoolsState.timelineLayersState[descriptor.id] = false;
	devtoolsTimelineLayers.push({
		...options,
		descriptorId: descriptor.id,
		appRecord: getAppRecord(descriptor.app)
	});
}
target.__VUE_DEVTOOLS_KIT_INSPECTOR__ ??= [];
var devtoolsInspector = new Proxy(target.__VUE_DEVTOOLS_KIT_INSPECTOR__, { get(target, prop, receiver) {
	return Reflect.get(target, prop, receiver);
} });
var callInspectorUpdatedHook = debounce(() => {
	devtoolsContext.hooks.callHook(DevToolsMessagingHookKeys.SEND_INSPECTOR_TO_CLIENT, getActiveInspectors());
});
function addInspector(inspector, descriptor) {
	devtoolsInspector.push({
		options: inspector,
		descriptor,
		treeFilterPlaceholder: inspector.treeFilterPlaceholder ?? "Search tree...",
		stateFilterPlaceholder: inspector.stateFilterPlaceholder ?? "Search state...",
		treeFilter: "",
		selectedNodeId: "",
		appRecord: getAppRecord(descriptor.app)
	});
	callInspectorUpdatedHook();
}
function getActiveInspectors() {
	return devtoolsInspector.filter((inspector) => inspector.descriptor.app === activeAppRecord.value.app).filter((inspector) => inspector.descriptor.id !== "components").map((inspector) => {
		const descriptor = inspector.descriptor;
		const options = inspector.options;
		return {
			id: options.id,
			label: options.label,
			logo: descriptor.logo,
			icon: `custom-ic-baseline-${options?.icon?.replace(/_/g, "-")}`,
			packageName: descriptor.packageName,
			homepage: descriptor.homepage,
			pluginId: descriptor.id
		};
	});
}
function getInspector(id, app) {
	return devtoolsInspector.find((inspector) => inspector.options.id === id && (app ? inspector.descriptor.app === app : true));
}
var DevToolsV6PluginAPIHookKeys = /* @__PURE__ */ function(DevToolsV6PluginAPIHookKeys) {
	DevToolsV6PluginAPIHookKeys["VISIT_COMPONENT_TREE"] = "visitComponentTree";
	DevToolsV6PluginAPIHookKeys["INSPECT_COMPONENT"] = "inspectComponent";
	DevToolsV6PluginAPIHookKeys["EDIT_COMPONENT_STATE"] = "editComponentState";
	DevToolsV6PluginAPIHookKeys["GET_INSPECTOR_TREE"] = "getInspectorTree";
	DevToolsV6PluginAPIHookKeys["GET_INSPECTOR_STATE"] = "getInspectorState";
	DevToolsV6PluginAPIHookKeys["EDIT_INSPECTOR_STATE"] = "editInspectorState";
	DevToolsV6PluginAPIHookKeys["INSPECT_TIMELINE_EVENT"] = "inspectTimelineEvent";
	DevToolsV6PluginAPIHookKeys["TIMELINE_CLEARED"] = "timelineCleared";
	DevToolsV6PluginAPIHookKeys["SET_PLUGIN_SETTINGS"] = "setPluginSettings";
	return DevToolsV6PluginAPIHookKeys;
}({});
var DevToolsContextHookKeys = /* @__PURE__ */ function(DevToolsContextHookKeys) {
	DevToolsContextHookKeys["ADD_INSPECTOR"] = "addInspector";
	DevToolsContextHookKeys["SEND_INSPECTOR_TREE"] = "sendInspectorTree";
	DevToolsContextHookKeys["SEND_INSPECTOR_STATE"] = "sendInspectorState";
	DevToolsContextHookKeys["CUSTOM_INSPECTOR_SELECT_NODE"] = "customInspectorSelectNode";
	DevToolsContextHookKeys["TIMELINE_LAYER_ADDED"] = "timelineLayerAdded";
	DevToolsContextHookKeys["TIMELINE_EVENT_ADDED"] = "timelineEventAdded";
	DevToolsContextHookKeys["GET_COMPONENT_INSTANCES"] = "getComponentInstances";
	DevToolsContextHookKeys["GET_COMPONENT_BOUNDS"] = "getComponentBounds";
	DevToolsContextHookKeys["GET_COMPONENT_NAME"] = "getComponentName";
	DevToolsContextHookKeys["COMPONENT_HIGHLIGHT"] = "componentHighlight";
	DevToolsContextHookKeys["COMPONENT_UNHIGHLIGHT"] = "componentUnhighlight";
	return DevToolsContextHookKeys;
}({});
var DevToolsMessagingHookKeys = /* @__PURE__ */ function(DevToolsMessagingHookKeys) {
	DevToolsMessagingHookKeys["SEND_INSPECTOR_TREE_TO_CLIENT"] = "sendInspectorTreeToClient";
	DevToolsMessagingHookKeys["SEND_INSPECTOR_STATE_TO_CLIENT"] = "sendInspectorStateToClient";
	DevToolsMessagingHookKeys["SEND_TIMELINE_EVENT_TO_CLIENT"] = "sendTimelineEventToClient";
	DevToolsMessagingHookKeys["SEND_INSPECTOR_TO_CLIENT"] = "sendInspectorToClient";
	DevToolsMessagingHookKeys["SEND_ACTIVE_APP_UNMOUNTED_TO_CLIENT"] = "sendActiveAppUpdatedToClient";
	DevToolsMessagingHookKeys["DEVTOOLS_STATE_UPDATED"] = "devtoolsStateUpdated";
	DevToolsMessagingHookKeys["DEVTOOLS_CONNECTED_UPDATED"] = "devtoolsConnectedUpdated";
	DevToolsMessagingHookKeys["ROUTER_INFO_UPDATED"] = "routerInfoUpdated";
	return DevToolsMessagingHookKeys;
}({});
function createDevToolsCtxHooks() {
	const hooks = createHooks();
	hooks.hook(DevToolsContextHookKeys.ADD_INSPECTOR, ({ inspector, plugin }) => {
		addInspector(inspector, plugin.descriptor);
	});
	const debounceSendInspectorTree = debounce(async ({ inspectorId, plugin }) => {
		if (!inspectorId || !plugin?.descriptor?.app || devtoolsState.highPerfModeEnabled) return;
		const inspector = getInspector(inspectorId, plugin.descriptor.app);
		const _payload = {
			app: plugin.descriptor.app,
			inspectorId,
			filter: inspector?.treeFilter || "",
			rootNodes: []
		};
		await new Promise((resolve) => {
			hooks.callHookWith(async (callbacks) => {
				await Promise.all(callbacks.map((cb) => cb(_payload)));
				resolve();
			}, DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_TREE);
		});
		hooks.callHookWith(async (callbacks) => {
			await Promise.all(callbacks.map((cb) => cb({
				inspectorId,
				rootNodes: _payload.rootNodes
			})));
		}, DevToolsMessagingHookKeys.SEND_INSPECTOR_TREE_TO_CLIENT);
	}, 120);
	hooks.hook(DevToolsContextHookKeys.SEND_INSPECTOR_TREE, debounceSendInspectorTree);
	const debounceSendInspectorState = debounce(async ({ inspectorId, plugin }) => {
		if (!inspectorId || !plugin?.descriptor?.app || devtoolsState.highPerfModeEnabled) return;
		const inspector = getInspector(inspectorId, plugin.descriptor.app);
		const _payload = {
			app: plugin.descriptor.app,
			inspectorId,
			nodeId: inspector?.selectedNodeId || "",
			state: null
		};
		const ctx = { currentTab: `custom-inspector:${inspectorId}` };
		if (_payload.nodeId) await new Promise((resolve) => {
			hooks.callHookWith(async (callbacks) => {
				await Promise.all(callbacks.map((cb) => cb(_payload, ctx)));
				resolve();
			}, DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_STATE);
		});
		hooks.callHookWith(async (callbacks) => {
			await Promise.all(callbacks.map((cb) => cb({
				inspectorId,
				nodeId: _payload.nodeId,
				state: _payload.state
			})));
		}, DevToolsMessagingHookKeys.SEND_INSPECTOR_STATE_TO_CLIENT);
	}, 120);
	hooks.hook(DevToolsContextHookKeys.SEND_INSPECTOR_STATE, debounceSendInspectorState);
	hooks.hook(DevToolsContextHookKeys.CUSTOM_INSPECTOR_SELECT_NODE, ({ inspectorId, nodeId, plugin }) => {
		const inspector = getInspector(inspectorId, plugin.descriptor.app);
		if (!inspector) return;
		inspector.selectedNodeId = nodeId;
	});
	hooks.hook(DevToolsContextHookKeys.TIMELINE_LAYER_ADDED, ({ options, plugin }) => {
		addTimelineLayer(options, plugin.descriptor);
	});
	hooks.hook(DevToolsContextHookKeys.TIMELINE_EVENT_ADDED, ({ options, plugin }) => {
		if (devtoolsState.highPerfModeEnabled || !devtoolsState.timelineLayersState?.[plugin.descriptor.id] && ![
			"performance",
			"component-event",
			"keyboard",
			"mouse"
		].includes(options.layerId)) return;
		hooks.callHookWith(async (callbacks) => {
			await Promise.all(callbacks.map((cb) => cb(options)));
		}, DevToolsMessagingHookKeys.SEND_TIMELINE_EVENT_TO_CLIENT);
	});
	hooks.hook(DevToolsContextHookKeys.GET_COMPONENT_INSTANCES, async ({ app }) => {
		const appRecord = app.__VUE_DEVTOOLS_NEXT_APP_RECORD__;
		if (!appRecord) return null;
		const appId = appRecord.id.toString();
		return [...appRecord.instanceMap].filter(([key]) => key.split(":")[0] === appId).map(([, instance]) => instance);
	});
	hooks.hook(DevToolsContextHookKeys.GET_COMPONENT_BOUNDS, async ({ instance }) => {
		return getComponentBoundingRect(instance);
	});
	hooks.hook(DevToolsContextHookKeys.GET_COMPONENT_NAME, ({ instance }) => {
		return getInstanceName(instance);
	});
	hooks.hook(DevToolsContextHookKeys.COMPONENT_HIGHLIGHT, ({ uid }) => {
		const instance = activeAppRecord.value.instanceMap.get(uid);
		if (instance) highlight(instance);
	});
	hooks.hook(DevToolsContextHookKeys.COMPONENT_UNHIGHLIGHT, () => {
		unhighlight();
	});
	return hooks;
}
target.__VUE_DEVTOOLS_KIT_APP_RECORDS__ ??= [];
target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__ ??= {};
target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD_ID__ ??= "";
target.__VUE_DEVTOOLS_KIT_CUSTOM_TABS__ ??= [];
target.__VUE_DEVTOOLS_KIT_CUSTOM_COMMANDS__ ??= [];
var STATE_KEY = "__VUE_DEVTOOLS_KIT_GLOBAL_STATE__";
function initStateFactory() {
	return {
		connected: false,
		clientConnected: false,
		vitePluginDetected: true,
		appRecords: [],
		activeAppRecordId: "",
		tabs: [],
		commands: [],
		highPerfModeEnabled: true,
		devtoolsClientDetected: {},
		perfUniqueGroupId: 0,
		timelineLayersState: getTimelineLayersStateFromStorage()
	};
}
target[STATE_KEY] ??= initStateFactory();
var callStateUpdatedHook = debounce((state) => {
	devtoolsContext.hooks.callHook(DevToolsMessagingHookKeys.DEVTOOLS_STATE_UPDATED, { state });
});
debounce((state, oldState) => {
	devtoolsContext.hooks.callHook(DevToolsMessagingHookKeys.DEVTOOLS_CONNECTED_UPDATED, {
		state,
		oldState
	});
});
var devtoolsAppRecords = new Proxy(target.__VUE_DEVTOOLS_KIT_APP_RECORDS__, { get(_target, prop, receiver) {
	if (prop === "value") return target.__VUE_DEVTOOLS_KIT_APP_RECORDS__;
	return target.__VUE_DEVTOOLS_KIT_APP_RECORDS__[prop];
} });
var activeAppRecord = new Proxy(target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__, { get(_target, prop, receiver) {
	if (prop === "value") return target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__;
	else if (prop === "id") return target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD_ID__;
	return target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__[prop];
} });
function updateAllStates() {
	callStateUpdatedHook({
		...target[STATE_KEY],
		appRecords: devtoolsAppRecords.value,
		activeAppRecordId: activeAppRecord.id,
		tabs: target.__VUE_DEVTOOLS_KIT_CUSTOM_TABS__,
		commands: target.__VUE_DEVTOOLS_KIT_CUSTOM_COMMANDS__
	});
}
function setActiveAppRecord(app) {
	target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__ = app;
	updateAllStates();
}
function setActiveAppRecordId(id) {
	target.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD_ID__ = id;
	updateAllStates();
}
var devtoolsState = new Proxy(target[STATE_KEY], {
	get(target$3, property) {
		if (property === "appRecords") return devtoolsAppRecords;
		else if (property === "activeAppRecordId") return activeAppRecord.id;
		else if (property === "tabs") return target.__VUE_DEVTOOLS_KIT_CUSTOM_TABS__;
		else if (property === "commands") return target.__VUE_DEVTOOLS_KIT_CUSTOM_COMMANDS__;
		return target[STATE_KEY][property];
	},
	deleteProperty(target, property) {
		delete target[property];
		return true;
	},
	set(target$4, property, value) {
		target$4[property] = value;
		target[STATE_KEY][property] = value;
		return true;
	}
});
function onDevToolsConnected(fn) {
	return new Promise((resolve) => {
		if (devtoolsState.connected) {
			fn();
			resolve();
		}
		devtoolsContext.hooks.hook(DevToolsMessagingHookKeys.DEVTOOLS_CONNECTED_UPDATED, ({ state }) => {
			if (state.connected) {
				fn();
				resolve();
			}
		});
	});
}
var resolveIcon = (icon) => {
	if (!icon) return;
	if (icon.startsWith("baseline-")) return `custom-ic-${icon}`;
	if (icon.startsWith("i-") || isUrlString(icon)) return icon;
	return `custom-ic-baseline-${icon}`;
};
function addCustomTab(tab) {
	const tabs = target.__VUE_DEVTOOLS_KIT_CUSTOM_TABS__;
	if (tabs.some((t) => t.name === tab.name)) return;
	tabs.push({
		...tab,
		icon: resolveIcon(tab.icon)
	});
	updateAllStates();
}
function addCustomCommand(action) {
	const commands = target.__VUE_DEVTOOLS_KIT_CUSTOM_COMMANDS__;
	if (commands.some((t) => t.id === action.id)) return;
	commands.push({
		...action,
		icon: resolveIcon(action.icon),
		children: action.children ? action.children.map((child) => ({
			...child,
			icon: resolveIcon(child.icon)
		})) : void 0
	});
	updateAllStates();
}
function removeCustomCommand(actionId) {
	const commands = target.__VUE_DEVTOOLS_KIT_CUSTOM_COMMANDS__;
	const index = commands.findIndex((t) => t.id === actionId);
	if (index === -1) return;
	commands.splice(index, 1);
	updateAllStates();
}
function openInEditor(options = {}) {
	const { file, host, baseUrl = window.location.origin, line = 0, column = 0 } = options;
	if (file) {
		if (host === "chrome-extension") {
			const fileName = file.replace(/\\/g, "\\\\");
			const _baseUrl = window.VUE_DEVTOOLS_CONFIG?.openInEditorHost ?? "/";
			fetch(`${_baseUrl}__open-in-editor?file=${encodeURI(file)}`).then((response) => {
				if (!response.ok) {
					const msg = `Opening component ${fileName} failed`;
					console.log(`%c${msg}`, "color:red");
				}
			});
		} else if (devtoolsState.vitePluginDetected) {
			const _baseUrl = target.__VUE_DEVTOOLS_OPEN_IN_EDITOR_BASE_URL__ ?? baseUrl;
			target.__VUE_INSPECTOR__.openInEditor(_baseUrl, file, line, column);
		}
	}
}
target.__VUE_DEVTOOLS_KIT_PLUGIN_BUFFER__ ??= [];
var devtoolsPluginBuffer = new Proxy(target.__VUE_DEVTOOLS_KIT_PLUGIN_BUFFER__, { get(target, prop, receiver) {
	return Reflect.get(target, prop, receiver);
} });
function _getSettings(settings) {
	const _settings = {};
	Object.keys(settings).forEach((key) => {
		_settings[key] = settings[key].defaultValue;
	});
	return _settings;
}
function getPluginLocalKey(pluginId) {
	return `__VUE_DEVTOOLS_NEXT_PLUGIN_SETTINGS__${pluginId}__`;
}
function getPluginSettingsOptions(pluginId) {
	return (devtoolsPluginBuffer.find((item) => item[0].id === pluginId && !!item[0]?.settings)?.[0] ?? null)?.settings ?? null;
}
function getPluginSettings(pluginId, fallbackValue) {
	const localKey = getPluginLocalKey(pluginId);
	if (localKey) {
		const localSettings = localStorage.getItem(localKey);
		if (localSettings) return JSON.parse(localSettings);
	}
	if (pluginId) return _getSettings((devtoolsPluginBuffer.find((item) => item[0].id === pluginId)?.[0] ?? null)?.settings ?? {});
	return _getSettings(fallbackValue);
}
function initPluginSettings(pluginId, settings) {
	const localKey = getPluginLocalKey(pluginId);
	if (!localStorage.getItem(localKey)) localStorage.setItem(localKey, JSON.stringify(_getSettings(settings)));
}
function setPluginSettings(pluginId, key, value) {
	const localKey = getPluginLocalKey(pluginId);
	const localSettings = localStorage.getItem(localKey);
	const parsedLocalSettings = JSON.parse(localSettings || "{}");
	const updated = {
		...parsedLocalSettings,
		[key]: value
	};
	localStorage.setItem(localKey, JSON.stringify(updated));
	devtoolsContext.hooks.callHookWith((callbacks) => {
		callbacks.forEach((cb) => cb({
			pluginId,
			key,
			oldValue: parsedLocalSettings[key],
			newValue: value,
			settings: updated
		}));
	}, DevToolsV6PluginAPIHookKeys.SET_PLUGIN_SETTINGS);
}
var DevToolsHooks = /* @__PURE__ */ function(DevToolsHooks) {
	DevToolsHooks["APP_INIT"] = "app:init";
	DevToolsHooks["APP_UNMOUNT"] = "app:unmount";
	DevToolsHooks["COMPONENT_UPDATED"] = "component:updated";
	DevToolsHooks["COMPONENT_ADDED"] = "component:added";
	DevToolsHooks["COMPONENT_REMOVED"] = "component:removed";
	DevToolsHooks["COMPONENT_EMIT"] = "component:emit";
	DevToolsHooks["PERFORMANCE_START"] = "perf:start";
	DevToolsHooks["PERFORMANCE_END"] = "perf:end";
	DevToolsHooks["ADD_ROUTE"] = "router:add-route";
	DevToolsHooks["REMOVE_ROUTE"] = "router:remove-route";
	DevToolsHooks["RENDER_TRACKED"] = "render:tracked";
	DevToolsHooks["RENDER_TRIGGERED"] = "render:triggered";
	DevToolsHooks["APP_CONNECTED"] = "app:connected";
	DevToolsHooks["SETUP_DEVTOOLS_PLUGIN"] = "devtools-plugin:setup";
	return DevToolsHooks;
}({});
var devtoolsHooks = target.__VUE_DEVTOOLS_HOOK ??= createHooks();
var hook = {
	on: {
		vueAppInit(fn) {
			devtoolsHooks.hook(DevToolsHooks.APP_INIT, fn);
		},
		vueAppUnmount(fn) {
			devtoolsHooks.hook(DevToolsHooks.APP_UNMOUNT, fn);
		},
		vueAppConnected(fn) {
			devtoolsHooks.hook(DevToolsHooks.APP_CONNECTED, fn);
		},
		componentAdded(fn) {
			return devtoolsHooks.hook(DevToolsHooks.COMPONENT_ADDED, fn);
		},
		componentEmit(fn) {
			return devtoolsHooks.hook(DevToolsHooks.COMPONENT_EMIT, fn);
		},
		componentUpdated(fn) {
			return devtoolsHooks.hook(DevToolsHooks.COMPONENT_UPDATED, fn);
		},
		componentRemoved(fn) {
			return devtoolsHooks.hook(DevToolsHooks.COMPONENT_REMOVED, fn);
		},
		setupDevtoolsPlugin(fn) {
			devtoolsHooks.hook(DevToolsHooks.SETUP_DEVTOOLS_PLUGIN, fn);
		},
		perfStart(fn) {
			return devtoolsHooks.hook(DevToolsHooks.PERFORMANCE_START, fn);
		},
		perfEnd(fn) {
			return devtoolsHooks.hook(DevToolsHooks.PERFORMANCE_END, fn);
		}
	},
	setupDevToolsPlugin(pluginDescriptor, setupFn) {
		return devtoolsHooks.callHook(DevToolsHooks.SETUP_DEVTOOLS_PLUGIN, pluginDescriptor, setupFn);
	}
};
var DevToolsV6PluginAPI = class {
	constructor({ plugin, ctx }) {
		this.hooks = ctx.hooks;
		this.plugin = plugin;
	}
	get on() {
		return {
			visitComponentTree: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.VISIT_COMPONENT_TREE, handler);
			},
			inspectComponent: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.INSPECT_COMPONENT, handler);
			},
			editComponentState: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.EDIT_COMPONENT_STATE, handler);
			},
			getInspectorTree: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_TREE, handler);
			},
			getInspectorState: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_STATE, handler);
			},
			editInspectorState: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.EDIT_INSPECTOR_STATE, handler);
			},
			inspectTimelineEvent: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.INSPECT_TIMELINE_EVENT, handler);
			},
			timelineCleared: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.TIMELINE_CLEARED, handler);
			},
			setPluginSettings: (handler) => {
				this.hooks.hook(DevToolsV6PluginAPIHookKeys.SET_PLUGIN_SETTINGS, handler);
			}
		};
	}
	notifyComponentUpdate(instance) {
		if (devtoolsState.highPerfModeEnabled) return;
		const inspector = getActiveInspectors().find((i) => i.packageName === this.plugin.descriptor.packageName);
		if (inspector?.id) {
			if (instance) {
				const args = [
					instance.appContext.app,
					instance.uid,
					instance.parent?.uid,
					instance
				];
				devtoolsHooks.callHook(DevToolsHooks.COMPONENT_UPDATED, ...args);
			} else devtoolsHooks.callHook(DevToolsHooks.COMPONENT_UPDATED);
			this.hooks.callHook(DevToolsContextHookKeys.SEND_INSPECTOR_STATE, {
				inspectorId: inspector.id,
				plugin: this.plugin
			});
		}
	}
	addInspector(options) {
		this.hooks.callHook(DevToolsContextHookKeys.ADD_INSPECTOR, {
			inspector: options,
			plugin: this.plugin
		});
		if (this.plugin.descriptor.settings) initPluginSettings(options.id, this.plugin.descriptor.settings);
	}
	sendInspectorTree(inspectorId) {
		if (devtoolsState.highPerfModeEnabled) return;
		this.hooks.callHook(DevToolsContextHookKeys.SEND_INSPECTOR_TREE, {
			inspectorId,
			plugin: this.plugin
		});
	}
	sendInspectorState(inspectorId) {
		if (devtoolsState.highPerfModeEnabled) return;
		this.hooks.callHook(DevToolsContextHookKeys.SEND_INSPECTOR_STATE, {
			inspectorId,
			plugin: this.plugin
		});
	}
	selectInspectorNode(inspectorId, nodeId) {
		this.hooks.callHook(DevToolsContextHookKeys.CUSTOM_INSPECTOR_SELECT_NODE, {
			inspectorId,
			nodeId,
			plugin: this.plugin
		});
	}
	visitComponentTree(payload) {
		return this.hooks.callHook(DevToolsV6PluginAPIHookKeys.VISIT_COMPONENT_TREE, payload);
	}
	now() {
		if (devtoolsState.highPerfModeEnabled) return 0;
		return Date.now();
	}
	addTimelineLayer(options) {
		this.hooks.callHook(DevToolsContextHookKeys.TIMELINE_LAYER_ADDED, {
			options,
			plugin: this.plugin
		});
	}
	addTimelineEvent(options) {
		if (devtoolsState.highPerfModeEnabled) return;
		this.hooks.callHook(DevToolsContextHookKeys.TIMELINE_EVENT_ADDED, {
			options,
			plugin: this.plugin
		});
	}
	getSettings(pluginId) {
		return getPluginSettings(pluginId ?? this.plugin.descriptor.id, this.plugin.descriptor.settings);
	}
	getComponentInstances(app) {
		return this.hooks.callHook(DevToolsContextHookKeys.GET_COMPONENT_INSTANCES, { app });
	}
	getComponentBounds(instance) {
		return this.hooks.callHook(DevToolsContextHookKeys.GET_COMPONENT_BOUNDS, { instance });
	}
	getComponentName(instance) {
		return this.hooks.callHook(DevToolsContextHookKeys.GET_COMPONENT_NAME, { instance });
	}
	highlightElement(instance) {
		const uid = instance.__VUE_DEVTOOLS_NEXT_UID__;
		return this.hooks.callHook(DevToolsContextHookKeys.COMPONENT_HIGHLIGHT, { uid });
	}
	unhighlightElement() {
		return this.hooks.callHook(DevToolsContextHookKeys.COMPONENT_UNHIGHLIGHT);
	}
};
var DevToolsPluginAPI = DevToolsV6PluginAPI;
var UNDEFINED = "__vue_devtool_undefined__";
var INFINITY = "__vue_devtool_infinity__";
var NEGATIVE_INFINITY = "__vue_devtool_negative_infinity__";
var NAN = "__vue_devtool_nan__";
Object.entries({
	[UNDEFINED]: "undefined",
	[NAN]: "NaN",
	[INFINITY]: "Infinity",
	[NEGATIVE_INFINITY]: "-Infinity"
}).reduce((acc, [key, value]) => {
	acc[value] = key;
	return acc;
}, {});
target.__VUE_DEVTOOLS_KIT__REGISTERED_PLUGIN_APPS__ ??= /* @__PURE__ */ new Set();
function setupDevToolsPlugin(pluginDescriptor, setupFn) {
	return hook.setupDevToolsPlugin(pluginDescriptor, setupFn);
}
function callDevToolsPluginSetupFn(plugin, app) {
	const [pluginDescriptor, setupFn] = plugin;
	if (pluginDescriptor.app !== app) return;
	const api = new DevToolsPluginAPI({
		plugin: {
			setupFn,
			descriptor: pluginDescriptor
		},
		ctx: devtoolsContext
	});
	if (pluginDescriptor.packageName === "vuex") api.on.editInspectorState((payload) => {
		api.sendInspectorState(payload.inspectorId);
	});
	setupFn(api);
}
function registerDevToolsPlugin(app, options) {
	if (target.__VUE_DEVTOOLS_KIT__REGISTERED_PLUGIN_APPS__.has(app)) return;
	if (devtoolsState.highPerfModeEnabled && !options?.inspectingComponent) return;
	target.__VUE_DEVTOOLS_KIT__REGISTERED_PLUGIN_APPS__.add(app);
	devtoolsPluginBuffer.forEach((plugin) => {
		callDevToolsPluginSetupFn(plugin, app);
	});
}
var ROUTER_KEY = "__VUE_DEVTOOLS_ROUTER__";
var ROUTER_INFO_KEY = "__VUE_DEVTOOLS_ROUTER_INFO__";
target[ROUTER_INFO_KEY] ??= {
	currentRoute: null,
	routes: []
};
target[ROUTER_KEY] ??= {};
new Proxy(target[ROUTER_INFO_KEY], { get(target$1, property) {
	return target[ROUTER_INFO_KEY][property];
} });
new Proxy(target[ROUTER_KEY], { get(target$2, property) {
	if (property === "value") return target[ROUTER_KEY];
} });
function getRoutes(router) {
	const routesMap = /* @__PURE__ */ new Map();
	return (router?.getRoutes() || []).filter((i) => !routesMap.has(i.path) && routesMap.set(i.path, 1));
}
function filterRoutes(routes) {
	return routes.map((item) => {
		let { path, name, children, meta } = item;
		if (children?.length) children = filterRoutes(children);
		return {
			path,
			name,
			children,
			meta
		};
	});
}
function filterCurrentRoute(route) {
	if (route) {
		const { fullPath, hash, href, path, name, matched, params, query } = route;
		return {
			fullPath,
			hash,
			href,
			path,
			name,
			params,
			query,
			matched: filterRoutes(matched)
		};
	}
	return route;
}
function normalizeRouterInfo(appRecord, activeAppRecord) {
	function init() {
		const router = appRecord.app?.config.globalProperties.$router;
		const currentRoute = filterCurrentRoute(router?.currentRoute.value);
		const routes = filterRoutes(getRoutes(router));
		const c = console.warn;
		console.warn = () => {};
		target[ROUTER_INFO_KEY] = {
			currentRoute: currentRoute ? deepClone(currentRoute) : {},
			routes: deepClone(routes)
		};
		target[ROUTER_KEY] = router;
		console.warn = c;
	}
	init();
	hook.on.componentUpdated(debounce(() => {
		if (activeAppRecord.value?.app !== appRecord.app) return;
		init();
		if (devtoolsState.highPerfModeEnabled) return;
		devtoolsContext.hooks.callHook(DevToolsMessagingHookKeys.ROUTER_INFO_UPDATED, { state: target[ROUTER_INFO_KEY] });
	}, 200));
}
function createDevToolsApi(hooks) {
	return {
		async getInspectorTree(payload) {
			const _payload = {
				...payload,
				app: activeAppRecord.value.app,
				rootNodes: []
			};
			await new Promise((resolve) => {
				hooks.callHookWith(async (callbacks) => {
					await Promise.all(callbacks.map((cb) => cb(_payload)));
					resolve();
				}, DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_TREE);
			});
			return _payload.rootNodes;
		},
		async getInspectorState(payload) {
			const _payload = {
				...payload,
				app: activeAppRecord.value.app,
				state: null
			};
			const ctx = { currentTab: `custom-inspector:${payload.inspectorId}` };
			await new Promise((resolve) => {
				hooks.callHookWith(async (callbacks) => {
					await Promise.all(callbacks.map((cb) => cb(_payload, ctx)));
					resolve();
				}, DevToolsV6PluginAPIHookKeys.GET_INSPECTOR_STATE);
			});
			return _payload.state;
		},
		editInspectorState(payload) {
			const stateEditor = new StateEditor();
			const _payload = {
				...payload,
				app: activeAppRecord.value.app,
				set: (obj, path = payload.path, value = payload.state.value, cb) => {
					stateEditor.set(obj, path, value, cb || stateEditor.createDefaultSetCallback(payload.state));
				}
			};
			hooks.callHookWith((callbacks) => {
				callbacks.forEach((cb) => cb(_payload));
			}, DevToolsV6PluginAPIHookKeys.EDIT_INSPECTOR_STATE);
		},
		sendInspectorState(inspectorId) {
			const inspector = getInspector(inspectorId);
			hooks.callHook(DevToolsContextHookKeys.SEND_INSPECTOR_STATE, {
				inspectorId,
				plugin: {
					descriptor: inspector.descriptor,
					setupFn: () => ({})
				}
			});
		},
		inspectComponentInspector() {
			return inspectComponentHighLighter();
		},
		cancelInspectComponentInspector() {
			return cancelInspectComponentHighLighter();
		},
		getComponentRenderCode(id) {
			const instance = getComponentInstance(activeAppRecord.value, id);
			if (instance) return !(typeof instance?.type === "function") ? instance.render.toString() : instance.type.toString();
		},
		scrollToComponent(id) {
			return scrollToComponent({ id });
		},
		openInEditor,
		getVueInspector: getComponentInspector,
		toggleApp(id, options) {
			const appRecord = devtoolsAppRecords.value.find((record) => record.id === id);
			if (appRecord) {
				setActiveAppRecordId(id);
				setActiveAppRecord(appRecord);
				normalizeRouterInfo(appRecord, activeAppRecord);
				callInspectorUpdatedHook();
				registerDevToolsPlugin(appRecord.app, options);
			}
		},
		inspectDOM(instanceId) {
			const instance = getComponentInstance(activeAppRecord.value, instanceId);
			if (instance) {
				const [el] = getRootElementsFromComponentInstance(instance);
				if (el) target.__VUE_DEVTOOLS_INSPECT_DOM_TARGET__ = el;
			}
		},
		updatePluginSettings(pluginId, key, value) {
			setPluginSettings(pluginId, key, value);
		},
		getPluginSettings(pluginId) {
			return {
				options: getPluginSettingsOptions(pluginId),
				values: getPluginSettings(pluginId)
			};
		}
	};
}
target.__VUE_DEVTOOLS_ENV__ ??= { vitePluginDetected: false };
var hooks = createDevToolsCtxHooks();
target.__VUE_DEVTOOLS_KIT_CONTEXT__ ??= {
	hooks,
	get state() {
		return {
			...devtoolsState,
			activeAppRecordId: activeAppRecord.id,
			activeAppRecord: activeAppRecord.value,
			appRecords: devtoolsAppRecords.value
		};
	},
	api: createDevToolsApi(hooks)
};
var devtoolsContext = target.__VUE_DEVTOOLS_KIT_CONTEXT__;
var require_speakingurl$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root) {
		"use strict";
		/**
		* charMap
		* @type {Object}
		*/
		var charMap = {
			"À": "A",
			"Á": "A",
			"Â": "A",
			"Ã": "A",
			"Ä": "Ae",
			"Å": "A",
			"Æ": "AE",
			"Ç": "C",
			"È": "E",
			"É": "E",
			"Ê": "E",
			"Ë": "E",
			"Ì": "I",
			"Í": "I",
			"Î": "I",
			"Ï": "I",
			"Ð": "D",
			"Ñ": "N",
			"Ò": "O",
			"Ó": "O",
			"Ô": "O",
			"Õ": "O",
			"Ö": "Oe",
			"Ő": "O",
			"Ø": "O",
			"Ù": "U",
			"Ú": "U",
			"Û": "U",
			"Ü": "Ue",
			"Ű": "U",
			"Ý": "Y",
			"Þ": "TH",
			"ß": "ss",
			"à": "a",
			"á": "a",
			"â": "a",
			"ã": "a",
			"ä": "ae",
			"å": "a",
			"æ": "ae",
			"ç": "c",
			"è": "e",
			"é": "e",
			"ê": "e",
			"ë": "e",
			"ì": "i",
			"í": "i",
			"î": "i",
			"ï": "i",
			"ð": "d",
			"ñ": "n",
			"ò": "o",
			"ó": "o",
			"ô": "o",
			"õ": "o",
			"ö": "oe",
			"ő": "o",
			"ø": "o",
			"ù": "u",
			"ú": "u",
			"û": "u",
			"ü": "ue",
			"ű": "u",
			"ý": "y",
			"þ": "th",
			"ÿ": "y",
			"ẞ": "SS",
			"ا": "a",
			"أ": "a",
			"إ": "i",
			"آ": "aa",
			"ؤ": "u",
			"ئ": "e",
			"ء": "a",
			"ب": "b",
			"ت": "t",
			"ث": "th",
			"ج": "j",
			"ح": "h",
			"خ": "kh",
			"د": "d",
			"ذ": "th",
			"ر": "r",
			"ز": "z",
			"س": "s",
			"ش": "sh",
			"ص": "s",
			"ض": "dh",
			"ط": "t",
			"ظ": "z",
			"ع": "a",
			"غ": "gh",
			"ف": "f",
			"ق": "q",
			"ك": "k",
			"ل": "l",
			"م": "m",
			"ن": "n",
			"ه": "h",
			"و": "w",
			"ي": "y",
			"ى": "a",
			"ة": "h",
			"ﻻ": "la",
			"ﻷ": "laa",
			"ﻹ": "lai",
			"ﻵ": "laa",
			"گ": "g",
			"چ": "ch",
			"پ": "p",
			"ژ": "zh",
			"ک": "k",
			"ی": "y",
			"َ": "a",
			"ً": "an",
			"ِ": "e",
			"ٍ": "en",
			"ُ": "u",
			"ٌ": "on",
			"ْ": "",
			"٠": "0",
			"١": "1",
			"٢": "2",
			"٣": "3",
			"٤": "4",
			"٥": "5",
			"٦": "6",
			"٧": "7",
			"٨": "8",
			"٩": "9",
			"۰": "0",
			"۱": "1",
			"۲": "2",
			"۳": "3",
			"۴": "4",
			"۵": "5",
			"۶": "6",
			"۷": "7",
			"۸": "8",
			"۹": "9",
			"က": "k",
			"ခ": "kh",
			"ဂ": "g",
			"ဃ": "ga",
			"င": "ng",
			"စ": "s",
			"ဆ": "sa",
			"ဇ": "z",
			"စျ": "za",
			"ည": "ny",
			"ဋ": "t",
			"ဌ": "ta",
			"ဍ": "d",
			"ဎ": "da",
			"ဏ": "na",
			"တ": "t",
			"ထ": "ta",
			"ဒ": "d",
			"ဓ": "da",
			"န": "n",
			"ပ": "p",
			"ဖ": "pa",
			"ဗ": "b",
			"ဘ": "ba",
			"မ": "m",
			"ယ": "y",
			"ရ": "ya",
			"လ": "l",
			"ဝ": "w",
			"သ": "th",
			"ဟ": "h",
			"ဠ": "la",
			"အ": "a",
			"ြ": "y",
			"ျ": "ya",
			"ွ": "w",
			"ြွ": "yw",
			"ျွ": "ywa",
			"ှ": "h",
			"ဧ": "e",
			"၏": "-e",
			"ဣ": "i",
			"ဤ": "-i",
			"ဉ": "u",
			"ဦ": "-u",
			"ဩ": "aw",
			"သြော": "aw",
			"ဪ": "aw",
			"၀": "0",
			"၁": "1",
			"၂": "2",
			"၃": "3",
			"၄": "4",
			"၅": "5",
			"၆": "6",
			"၇": "7",
			"၈": "8",
			"၉": "9",
			"္": "",
			"့": "",
			"း": "",
			"č": "c",
			"ď": "d",
			"ě": "e",
			"ň": "n",
			"ř": "r",
			"š": "s",
			"ť": "t",
			"ů": "u",
			"ž": "z",
			"Č": "C",
			"Ď": "D",
			"Ě": "E",
			"Ň": "N",
			"Ř": "R",
			"Š": "S",
			"Ť": "T",
			"Ů": "U",
			"Ž": "Z",
			"ހ": "h",
			"ށ": "sh",
			"ނ": "n",
			"ރ": "r",
			"ބ": "b",
			"ޅ": "lh",
			"ކ": "k",
			"އ": "a",
			"ވ": "v",
			"މ": "m",
			"ފ": "f",
			"ދ": "dh",
			"ތ": "th",
			"ލ": "l",
			"ގ": "g",
			"ޏ": "gn",
			"ސ": "s",
			"ޑ": "d",
			"ޒ": "z",
			"ޓ": "t",
			"ޔ": "y",
			"ޕ": "p",
			"ޖ": "j",
			"ޗ": "ch",
			"ޘ": "tt",
			"ޙ": "hh",
			"ޚ": "kh",
			"ޛ": "th",
			"ޜ": "z",
			"ޝ": "sh",
			"ޞ": "s",
			"ޟ": "d",
			"ޠ": "t",
			"ޡ": "z",
			"ޢ": "a",
			"ޣ": "gh",
			"ޤ": "q",
			"ޥ": "w",
			"ަ": "a",
			"ާ": "aa",
			"ި": "i",
			"ީ": "ee",
			"ު": "u",
			"ޫ": "oo",
			"ެ": "e",
			"ޭ": "ey",
			"ޮ": "o",
			"ޯ": "oa",
			"ް": "",
			"ა": "a",
			"ბ": "b",
			"გ": "g",
			"დ": "d",
			"ე": "e",
			"ვ": "v",
			"ზ": "z",
			"თ": "t",
			"ი": "i",
			"კ": "k",
			"ლ": "l",
			"მ": "m",
			"ნ": "n",
			"ო": "o",
			"პ": "p",
			"ჟ": "zh",
			"რ": "r",
			"ს": "s",
			"ტ": "t",
			"უ": "u",
			"ფ": "p",
			"ქ": "k",
			"ღ": "gh",
			"ყ": "q",
			"შ": "sh",
			"ჩ": "ch",
			"ც": "ts",
			"ძ": "dz",
			"წ": "ts",
			"ჭ": "ch",
			"ხ": "kh",
			"ჯ": "j",
			"ჰ": "h",
			"α": "a",
			"β": "v",
			"γ": "g",
			"δ": "d",
			"ε": "e",
			"ζ": "z",
			"η": "i",
			"θ": "th",
			"ι": "i",
			"κ": "k",
			"λ": "l",
			"μ": "m",
			"ν": "n",
			"ξ": "ks",
			"ο": "o",
			"π": "p",
			"ρ": "r",
			"σ": "s",
			"τ": "t",
			"υ": "y",
			"φ": "f",
			"χ": "x",
			"ψ": "ps",
			"ω": "o",
			"ά": "a",
			"έ": "e",
			"ί": "i",
			"ό": "o",
			"ύ": "y",
			"ή": "i",
			"ώ": "o",
			"ς": "s",
			"ϊ": "i",
			"ΰ": "y",
			"ϋ": "y",
			"ΐ": "i",
			"Α": "A",
			"Β": "B",
			"Γ": "G",
			"Δ": "D",
			"Ε": "E",
			"Ζ": "Z",
			"Η": "I",
			"Θ": "TH",
			"Ι": "I",
			"Κ": "K",
			"Λ": "L",
			"Μ": "M",
			"Ν": "N",
			"Ξ": "KS",
			"Ο": "O",
			"Π": "P",
			"Ρ": "R",
			"Σ": "S",
			"Τ": "T",
			"Υ": "Y",
			"Φ": "F",
			"Χ": "X",
			"Ψ": "PS",
			"Ω": "O",
			"Ά": "A",
			"Έ": "E",
			"Ί": "I",
			"Ό": "O",
			"Ύ": "Y",
			"Ή": "I",
			"Ώ": "O",
			"Ϊ": "I",
			"Ϋ": "Y",
			"ā": "a",
			"ē": "e",
			"ģ": "g",
			"ī": "i",
			"ķ": "k",
			"ļ": "l",
			"ņ": "n",
			"ū": "u",
			"Ā": "A",
			"Ē": "E",
			"Ģ": "G",
			"Ī": "I",
			"Ķ": "k",
			"Ļ": "L",
			"Ņ": "N",
			"Ū": "U",
			"Ќ": "Kj",
			"ќ": "kj",
			"Љ": "Lj",
			"љ": "lj",
			"Њ": "Nj",
			"њ": "nj",
			"Тс": "Ts",
			"тс": "ts",
			"ą": "a",
			"ć": "c",
			"ę": "e",
			"ł": "l",
			"ń": "n",
			"ś": "s",
			"ź": "z",
			"ż": "z",
			"Ą": "A",
			"Ć": "C",
			"Ę": "E",
			"Ł": "L",
			"Ń": "N",
			"Ś": "S",
			"Ź": "Z",
			"Ż": "Z",
			"Є": "Ye",
			"І": "I",
			"Ї": "Yi",
			"Ґ": "G",
			"є": "ye",
			"і": "i",
			"ї": "yi",
			"ґ": "g",
			"ă": "a",
			"Ă": "A",
			"ș": "s",
			"Ș": "S",
			"ț": "t",
			"Ț": "T",
			"ţ": "t",
			"Ţ": "T",
			"а": "a",
			"б": "b",
			"в": "v",
			"г": "g",
			"д": "d",
			"е": "e",
			"ё": "yo",
			"ж": "zh",
			"з": "z",
			"и": "i",
			"й": "i",
			"к": "k",
			"л": "l",
			"м": "m",
			"н": "n",
			"о": "o",
			"п": "p",
			"р": "r",
			"с": "s",
			"т": "t",
			"у": "u",
			"ф": "f",
			"х": "kh",
			"ц": "c",
			"ч": "ch",
			"ш": "sh",
			"щ": "sh",
			"ъ": "",
			"ы": "y",
			"ь": "",
			"э": "e",
			"ю": "yu",
			"я": "ya",
			"А": "A",
			"Б": "B",
			"В": "V",
			"Г": "G",
			"Д": "D",
			"Е": "E",
			"Ё": "Yo",
			"Ж": "Zh",
			"З": "Z",
			"И": "I",
			"Й": "I",
			"К": "K",
			"Л": "L",
			"М": "M",
			"Н": "N",
			"О": "O",
			"П": "P",
			"Р": "R",
			"С": "S",
			"Т": "T",
			"У": "U",
			"Ф": "F",
			"Х": "Kh",
			"Ц": "C",
			"Ч": "Ch",
			"Ш": "Sh",
			"Щ": "Sh",
			"Ъ": "",
			"Ы": "Y",
			"Ь": "",
			"Э": "E",
			"Ю": "Yu",
			"Я": "Ya",
			"ђ": "dj",
			"ј": "j",
			"ћ": "c",
			"џ": "dz",
			"Ђ": "Dj",
			"Ј": "j",
			"Ћ": "C",
			"Џ": "Dz",
			"ľ": "l",
			"ĺ": "l",
			"ŕ": "r",
			"Ľ": "L",
			"Ĺ": "L",
			"Ŕ": "R",
			"ş": "s",
			"Ş": "S",
			"ı": "i",
			"İ": "I",
			"ğ": "g",
			"Ğ": "G",
			"ả": "a",
			"Ả": "A",
			"ẳ": "a",
			"Ẳ": "A",
			"ẩ": "a",
			"Ẩ": "A",
			"đ": "d",
			"Đ": "D",
			"ẹ": "e",
			"Ẹ": "E",
			"ẽ": "e",
			"Ẽ": "E",
			"ẻ": "e",
			"Ẻ": "E",
			"ế": "e",
			"Ế": "E",
			"ề": "e",
			"Ề": "E",
			"ệ": "e",
			"Ệ": "E",
			"ễ": "e",
			"Ễ": "E",
			"ể": "e",
			"Ể": "E",
			"ỏ": "o",
			"ọ": "o",
			"Ọ": "o",
			"ố": "o",
			"Ố": "O",
			"ồ": "o",
			"Ồ": "O",
			"ổ": "o",
			"Ổ": "O",
			"ộ": "o",
			"Ộ": "O",
			"ỗ": "o",
			"Ỗ": "O",
			"ơ": "o",
			"Ơ": "O",
			"ớ": "o",
			"Ớ": "O",
			"ờ": "o",
			"Ờ": "O",
			"ợ": "o",
			"Ợ": "O",
			"ỡ": "o",
			"Ỡ": "O",
			"Ở": "o",
			"ở": "o",
			"ị": "i",
			"Ị": "I",
			"ĩ": "i",
			"Ĩ": "I",
			"ỉ": "i",
			"Ỉ": "i",
			"ủ": "u",
			"Ủ": "U",
			"ụ": "u",
			"Ụ": "U",
			"ũ": "u",
			"Ũ": "U",
			"ư": "u",
			"Ư": "U",
			"ứ": "u",
			"Ứ": "U",
			"ừ": "u",
			"Ừ": "U",
			"ự": "u",
			"Ự": "U",
			"ữ": "u",
			"Ữ": "U",
			"ử": "u",
			"Ử": "ư",
			"ỷ": "y",
			"Ỷ": "y",
			"ỳ": "y",
			"Ỳ": "Y",
			"ỵ": "y",
			"Ỵ": "Y",
			"ỹ": "y",
			"Ỹ": "Y",
			"ạ": "a",
			"Ạ": "A",
			"ấ": "a",
			"Ấ": "A",
			"ầ": "a",
			"Ầ": "A",
			"ậ": "a",
			"Ậ": "A",
			"ẫ": "a",
			"Ẫ": "A",
			"ắ": "a",
			"Ắ": "A",
			"ằ": "a",
			"Ằ": "A",
			"ặ": "a",
			"Ặ": "A",
			"ẵ": "a",
			"Ẵ": "A",
			"⓪": "0",
			"①": "1",
			"②": "2",
			"③": "3",
			"④": "4",
			"⑤": "5",
			"⑥": "6",
			"⑦": "7",
			"⑧": "8",
			"⑨": "9",
			"⑩": "10",
			"⑪": "11",
			"⑫": "12",
			"⑬": "13",
			"⑭": "14",
			"⑮": "15",
			"⑯": "16",
			"⑰": "17",
			"⑱": "18",
			"⑲": "18",
			"⑳": "18",
			"⓵": "1",
			"⓶": "2",
			"⓷": "3",
			"⓸": "4",
			"⓹": "5",
			"⓺": "6",
			"⓻": "7",
			"⓼": "8",
			"⓽": "9",
			"⓾": "10",
			"⓿": "0",
			"⓫": "11",
			"⓬": "12",
			"⓭": "13",
			"⓮": "14",
			"⓯": "15",
			"⓰": "16",
			"⓱": "17",
			"⓲": "18",
			"⓳": "19",
			"⓴": "20",
			"Ⓐ": "A",
			"Ⓑ": "B",
			"Ⓒ": "C",
			"Ⓓ": "D",
			"Ⓔ": "E",
			"Ⓕ": "F",
			"Ⓖ": "G",
			"Ⓗ": "H",
			"Ⓘ": "I",
			"Ⓙ": "J",
			"Ⓚ": "K",
			"Ⓛ": "L",
			"Ⓜ": "M",
			"Ⓝ": "N",
			"Ⓞ": "O",
			"Ⓟ": "P",
			"Ⓠ": "Q",
			"Ⓡ": "R",
			"Ⓢ": "S",
			"Ⓣ": "T",
			"Ⓤ": "U",
			"Ⓥ": "V",
			"Ⓦ": "W",
			"Ⓧ": "X",
			"Ⓨ": "Y",
			"Ⓩ": "Z",
			"ⓐ": "a",
			"ⓑ": "b",
			"ⓒ": "c",
			"ⓓ": "d",
			"ⓔ": "e",
			"ⓕ": "f",
			"ⓖ": "g",
			"ⓗ": "h",
			"ⓘ": "i",
			"ⓙ": "j",
			"ⓚ": "k",
			"ⓛ": "l",
			"ⓜ": "m",
			"ⓝ": "n",
			"ⓞ": "o",
			"ⓟ": "p",
			"ⓠ": "q",
			"ⓡ": "r",
			"ⓢ": "s",
			"ⓣ": "t",
			"ⓤ": "u",
			"ⓦ": "v",
			"ⓥ": "w",
			"ⓧ": "x",
			"ⓨ": "y",
			"ⓩ": "z",
			"“": "\"",
			"”": "\"",
			"‘": "'",
			"’": "'",
			"∂": "d",
			"ƒ": "f",
			"™": "(TM)",
			"©": "(C)",
			"œ": "oe",
			"Œ": "OE",
			"®": "(R)",
			"†": "+",
			"℠": "(SM)",
			"…": "...",
			"˚": "o",
			"º": "o",
			"ª": "a",
			"•": "*",
			"၊": ",",
			"။": ".",
			"$": "USD",
			"€": "EUR",
			"₢": "BRN",
			"₣": "FRF",
			"£": "GBP",
			"₤": "ITL",
			"₦": "NGN",
			"₧": "ESP",
			"₩": "KRW",
			"₪": "ILS",
			"₫": "VND",
			"₭": "LAK",
			"₮": "MNT",
			"₯": "GRD",
			"₱": "ARS",
			"₲": "PYG",
			"₳": "ARA",
			"₴": "UAH",
			"₵": "GHS",
			"¢": "cent",
			"¥": "CNY",
			"元": "CNY",
			"円": "YEN",
			"﷼": "IRR",
			"₠": "EWE",
			"฿": "THB",
			"₨": "INR",
			"₹": "INR",
			"₰": "PF",
			"₺": "TRY",
			"؋": "AFN",
			"₼": "AZN",
			"лв": "BGN",
			"៛": "KHR",
			"₡": "CRC",
			"₸": "KZT",
			"ден": "MKD",
			"zł": "PLN",
			"₽": "RUB",
			"₾": "GEL"
		};
		/**
		* special look ahead character array
		* These characters form with consonants to become 'single'/consonant combo
		* @type [Array]
		*/
		var lookAheadCharArray = ["်", "ް"];
		/**
		* diatricMap for languages where transliteration changes entirely as more diatrics are added
		* @type {Object}
		*/
		var diatricMap = {
			"ာ": "a",
			"ါ": "a",
			"ေ": "e",
			"ဲ": "e",
			"ိ": "i",
			"ီ": "i",
			"ို": "o",
			"ု": "u",
			"ူ": "u",
			"ေါင်": "aung",
			"ော": "aw",
			"ော်": "aw",
			"ေါ": "aw",
			"ေါ်": "aw",
			"်": "်",
			"က်": "et",
			"ိုက်": "aik",
			"ောက်": "auk",
			"င်": "in",
			"ိုင်": "aing",
			"ောင်": "aung",
			"စ်": "it",
			"ည်": "i",
			"တ်": "at",
			"ိတ်": "eik",
			"ုတ်": "ok",
			"ွတ်": "ut",
			"ေတ်": "it",
			"ဒ်": "d",
			"ိုဒ်": "ok",
			"ုဒ်": "ait",
			"န်": "an",
			"ာန်": "an",
			"ိန်": "ein",
			"ုန်": "on",
			"ွန်": "un",
			"ပ်": "at",
			"ိပ်": "eik",
			"ုပ်": "ok",
			"ွပ်": "ut",
			"န်ုပ်": "nub",
			"မ်": "an",
			"ိမ်": "ein",
			"ုမ်": "on",
			"ွမ်": "un",
			"ယ်": "e",
			"ိုလ်": "ol",
			"ဉ်": "in",
			"ံ": "an",
			"ိံ": "ein",
			"ုံ": "on",
			"ައް": "ah",
			"ަށް": "ah"
		};
		/**
		* langCharMap language specific characters translations
		* @type   {Object}
		*/
		var langCharMap = {
			"en": {},
			"az": {
				"ç": "c",
				"ə": "e",
				"ğ": "g",
				"ı": "i",
				"ö": "o",
				"ş": "s",
				"ü": "u",
				"Ç": "C",
				"Ə": "E",
				"Ğ": "G",
				"İ": "I",
				"Ö": "O",
				"Ş": "S",
				"Ü": "U"
			},
			"cs": {
				"č": "c",
				"ď": "d",
				"ě": "e",
				"ň": "n",
				"ř": "r",
				"š": "s",
				"ť": "t",
				"ů": "u",
				"ž": "z",
				"Č": "C",
				"Ď": "D",
				"Ě": "E",
				"Ň": "N",
				"Ř": "R",
				"Š": "S",
				"Ť": "T",
				"Ů": "U",
				"Ž": "Z"
			},
			"fi": {
				"ä": "a",
				"Ä": "A",
				"ö": "o",
				"Ö": "O"
			},
			"hu": {
				"ä": "a",
				"Ä": "A",
				"ö": "o",
				"Ö": "O",
				"ü": "u",
				"Ü": "U",
				"ű": "u",
				"Ű": "U"
			},
			"lt": {
				"ą": "a",
				"č": "c",
				"ę": "e",
				"ė": "e",
				"į": "i",
				"š": "s",
				"ų": "u",
				"ū": "u",
				"ž": "z",
				"Ą": "A",
				"Č": "C",
				"Ę": "E",
				"Ė": "E",
				"Į": "I",
				"Š": "S",
				"Ų": "U",
				"Ū": "U"
			},
			"lv": {
				"ā": "a",
				"č": "c",
				"ē": "e",
				"ģ": "g",
				"ī": "i",
				"ķ": "k",
				"ļ": "l",
				"ņ": "n",
				"š": "s",
				"ū": "u",
				"ž": "z",
				"Ā": "A",
				"Č": "C",
				"Ē": "E",
				"Ģ": "G",
				"Ī": "i",
				"Ķ": "k",
				"Ļ": "L",
				"Ņ": "N",
				"Š": "S",
				"Ū": "u",
				"Ž": "Z"
			},
			"pl": {
				"ą": "a",
				"ć": "c",
				"ę": "e",
				"ł": "l",
				"ń": "n",
				"ó": "o",
				"ś": "s",
				"ź": "z",
				"ż": "z",
				"Ą": "A",
				"Ć": "C",
				"Ę": "e",
				"Ł": "L",
				"Ń": "N",
				"Ó": "O",
				"Ś": "S",
				"Ź": "Z",
				"Ż": "Z"
			},
			"sv": {
				"ä": "a",
				"Ä": "A",
				"ö": "o",
				"Ö": "O"
			},
			"sk": {
				"ä": "a",
				"Ä": "A"
			},
			"sr": {
				"љ": "lj",
				"њ": "nj",
				"Љ": "Lj",
				"Њ": "Nj",
				"đ": "dj",
				"Đ": "Dj"
			},
			"tr": {
				"Ü": "U",
				"Ö": "O",
				"ü": "u",
				"ö": "o"
			}
		};
		/**
		* symbolMap language specific symbol translations
		* translations must be transliterated already
		* @type   {Object}
		*/
		var symbolMap = {
			"ar": {
				"∆": "delta",
				"∞": "la-nihaya",
				"♥": "hob",
				"&": "wa",
				"|": "aw",
				"<": "aqal-men",
				">": "akbar-men",
				"∑": "majmou",
				"¤": "omla"
			},
			"az": {},
			"ca": {
				"∆": "delta",
				"∞": "infinit",
				"♥": "amor",
				"&": "i",
				"|": "o",
				"<": "menys que",
				">": "mes que",
				"∑": "suma dels",
				"¤": "moneda"
			},
			"cs": {
				"∆": "delta",
				"∞": "nekonecno",
				"♥": "laska",
				"&": "a",
				"|": "nebo",
				"<": "mensi nez",
				">": "vetsi nez",
				"∑": "soucet",
				"¤": "mena"
			},
			"de": {
				"∆": "delta",
				"∞": "unendlich",
				"♥": "Liebe",
				"&": "und",
				"|": "oder",
				"<": "kleiner als",
				">": "groesser als",
				"∑": "Summe von",
				"¤": "Waehrung"
			},
			"dv": {
				"∆": "delta",
				"∞": "kolunulaa",
				"♥": "loabi",
				"&": "aai",
				"|": "noonee",
				"<": "ah vure kuda",
				">": "ah vure bodu",
				"∑": "jumula",
				"¤": "faisaa"
			},
			"en": {
				"∆": "delta",
				"∞": "infinity",
				"♥": "love",
				"&": "and",
				"|": "or",
				"<": "less than",
				">": "greater than",
				"∑": "sum",
				"¤": "currency"
			},
			"es": {
				"∆": "delta",
				"∞": "infinito",
				"♥": "amor",
				"&": "y",
				"|": "u",
				"<": "menos que",
				">": "mas que",
				"∑": "suma de los",
				"¤": "moneda"
			},
			"fa": {
				"∆": "delta",
				"∞": "bi-nahayat",
				"♥": "eshgh",
				"&": "va",
				"|": "ya",
				"<": "kamtar-az",
				">": "bishtar-az",
				"∑": "majmooe",
				"¤": "vahed"
			},
			"fi": {
				"∆": "delta",
				"∞": "aarettomyys",
				"♥": "rakkaus",
				"&": "ja",
				"|": "tai",
				"<": "pienempi kuin",
				">": "suurempi kuin",
				"∑": "summa",
				"¤": "valuutta"
			},
			"fr": {
				"∆": "delta",
				"∞": "infiniment",
				"♥": "Amour",
				"&": "et",
				"|": "ou",
				"<": "moins que",
				">": "superieure a",
				"∑": "somme des",
				"¤": "monnaie"
			},
			"ge": {
				"∆": "delta",
				"∞": "usasruloba",
				"♥": "siqvaruli",
				"&": "da",
				"|": "an",
				"<": "naklebi",
				">": "meti",
				"∑": "jami",
				"¤": "valuta"
			},
			"gr": {},
			"hu": {
				"∆": "delta",
				"∞": "vegtelen",
				"♥": "szerelem",
				"&": "es",
				"|": "vagy",
				"<": "kisebb mint",
				">": "nagyobb mint",
				"∑": "szumma",
				"¤": "penznem"
			},
			"it": {
				"∆": "delta",
				"∞": "infinito",
				"♥": "amore",
				"&": "e",
				"|": "o",
				"<": "minore di",
				">": "maggiore di",
				"∑": "somma",
				"¤": "moneta"
			},
			"lt": {
				"∆": "delta",
				"∞": "begalybe",
				"♥": "meile",
				"&": "ir",
				"|": "ar",
				"<": "maziau nei",
				">": "daugiau nei",
				"∑": "suma",
				"¤": "valiuta"
			},
			"lv": {
				"∆": "delta",
				"∞": "bezgaliba",
				"♥": "milestiba",
				"&": "un",
				"|": "vai",
				"<": "mazak neka",
				">": "lielaks neka",
				"∑": "summa",
				"¤": "valuta"
			},
			"my": {
				"∆": "kwahkhyaet",
				"∞": "asaonasme",
				"♥": "akhyait",
				"&": "nhin",
				"|": "tho",
				"<": "ngethaw",
				">": "kyithaw",
				"∑": "paungld",
				"¤": "ngwekye"
			},
			"mk": {},
			"nl": {
				"∆": "delta",
				"∞": "oneindig",
				"♥": "liefde",
				"&": "en",
				"|": "of",
				"<": "kleiner dan",
				">": "groter dan",
				"∑": "som",
				"¤": "valuta"
			},
			"pl": {
				"∆": "delta",
				"∞": "nieskonczonosc",
				"♥": "milosc",
				"&": "i",
				"|": "lub",
				"<": "mniejsze niz",
				">": "wieksze niz",
				"∑": "suma",
				"¤": "waluta"
			},
			"pt": {
				"∆": "delta",
				"∞": "infinito",
				"♥": "amor",
				"&": "e",
				"|": "ou",
				"<": "menor que",
				">": "maior que",
				"∑": "soma",
				"¤": "moeda"
			},
			"ro": {
				"∆": "delta",
				"∞": "infinit",
				"♥": "dragoste",
				"&": "si",
				"|": "sau",
				"<": "mai mic ca",
				">": "mai mare ca",
				"∑": "suma",
				"¤": "valuta"
			},
			"ru": {
				"∆": "delta",
				"∞": "beskonechno",
				"♥": "lubov",
				"&": "i",
				"|": "ili",
				"<": "menshe",
				">": "bolshe",
				"∑": "summa",
				"¤": "valjuta"
			},
			"sk": {
				"∆": "delta",
				"∞": "nekonecno",
				"♥": "laska",
				"&": "a",
				"|": "alebo",
				"<": "menej ako",
				">": "viac ako",
				"∑": "sucet",
				"¤": "mena"
			},
			"sr": {},
			"tr": {
				"∆": "delta",
				"∞": "sonsuzluk",
				"♥": "ask",
				"&": "ve",
				"|": "veya",
				"<": "kucuktur",
				">": "buyuktur",
				"∑": "toplam",
				"¤": "para birimi"
			},
			"uk": {
				"∆": "delta",
				"∞": "bezkinechnist",
				"♥": "lubov",
				"&": "i",
				"|": "abo",
				"<": "menshe",
				">": "bilshe",
				"∑": "suma",
				"¤": "valjuta"
			},
			"vn": {
				"∆": "delta",
				"∞": "vo cuc",
				"♥": "yeu",
				"&": "va",
				"|": "hoac",
				"<": "nho hon",
				">": "lon hon",
				"∑": "tong",
				"¤": "tien te"
			}
		};
		var uricChars = [
			";",
			"?",
			":",
			"@",
			"&",
			"=",
			"+",
			"$",
			",",
			"/"
		].join("");
		var uricNoSlashChars = [
			";",
			"?",
			":",
			"@",
			"&",
			"=",
			"+",
			"$",
			","
		].join("");
		var markChars = [
			".",
			"!",
			"~",
			"*",
			"'",
			"(",
			")"
		].join("");
		/**
		* getSlug
		* @param  {string} input input string
		* @param  {object|string} opts config object or separator string/char
		* @api    public
		* @return {string}  sluggified string
		*/
		var getSlug = function getSlug(input, opts) {
			var separator = "-";
			var result = "";
			var diatricString = "";
			var convertSymbols = true;
			var customReplacements = {};
			var maintainCase;
			var titleCase;
			var truncate;
			var uricFlag;
			var uricNoSlashFlag;
			var markFlag;
			var symbol;
			var langChar;
			var lucky;
			var i;
			var ch;
			var l;
			var lastCharWasSymbol;
			var lastCharWasDiatric;
			var allowedChars = "";
			if (typeof input !== "string") return "";
			if (typeof opts === "string") separator = opts;
			symbol = symbolMap.en;
			langChar = langCharMap.en;
			if (typeof opts === "object") {
				maintainCase = opts.maintainCase || false;
				customReplacements = opts.custom && typeof opts.custom === "object" ? opts.custom : customReplacements;
				truncate = +opts.truncate > 1 && opts.truncate || false;
				uricFlag = opts.uric || false;
				uricNoSlashFlag = opts.uricNoSlash || false;
				markFlag = opts.mark || false;
				convertSymbols = opts.symbols === false || opts.lang === false ? false : true;
				separator = opts.separator || separator;
				if (uricFlag) allowedChars += uricChars;
				if (uricNoSlashFlag) allowedChars += uricNoSlashChars;
				if (markFlag) allowedChars += markChars;
				symbol = opts.lang && symbolMap[opts.lang] && convertSymbols ? symbolMap[opts.lang] : convertSymbols ? symbolMap.en : {};
				langChar = opts.lang && langCharMap[opts.lang] ? langCharMap[opts.lang] : opts.lang === false || opts.lang === true ? {} : langCharMap.en;
				if (opts.titleCase && typeof opts.titleCase.length === "number" && Array.prototype.toString.call(opts.titleCase)) {
					opts.titleCase.forEach(function(v) {
						customReplacements[v + ""] = v + "";
					});
					titleCase = true;
				} else titleCase = !!opts.titleCase;
				if (opts.custom && typeof opts.custom.length === "number" && Array.prototype.toString.call(opts.custom)) opts.custom.forEach(function(v) {
					customReplacements[v + ""] = v + "";
				});
				Object.keys(customReplacements).forEach(function(v) {
					var r;
					if (v.length > 1) r = new RegExp("\\b" + escapeChars(v) + "\\b", "gi");
					else r = new RegExp(escapeChars(v), "gi");
					input = input.replace(r, customReplacements[v]);
				});
				for (ch in customReplacements) allowedChars += ch;
			}
			allowedChars += separator;
			allowedChars = escapeChars(allowedChars);
			input = input.replace(/(^\s+|\s+$)/g, "");
			lastCharWasSymbol = false;
			lastCharWasDiatric = false;
			for (i = 0, l = input.length; i < l; i++) {
				ch = input[i];
				if (isReplacedCustomChar(ch, customReplacements)) lastCharWasSymbol = false;
				else if (langChar[ch]) {
					ch = lastCharWasSymbol && langChar[ch].match(/[A-Za-z0-9]/) ? " " + langChar[ch] : langChar[ch];
					lastCharWasSymbol = false;
				} else if (ch in charMap) {
					if (i + 1 < l && lookAheadCharArray.indexOf(input[i + 1]) >= 0) {
						diatricString += ch;
						ch = "";
					} else if (lastCharWasDiatric === true) {
						ch = diatricMap[diatricString] + charMap[ch];
						diatricString = "";
					} else ch = lastCharWasSymbol && charMap[ch].match(/[A-Za-z0-9]/) ? " " + charMap[ch] : charMap[ch];
					lastCharWasSymbol = false;
					lastCharWasDiatric = false;
				} else if (ch in diatricMap) {
					diatricString += ch;
					ch = "";
					if (i === l - 1) ch = diatricMap[diatricString];
					lastCharWasDiatric = true;
				} else if (symbol[ch] && !(uricFlag && uricChars.indexOf(ch) !== -1) && !(uricNoSlashFlag && uricNoSlashChars.indexOf(ch) !== -1)) {
					ch = lastCharWasSymbol || result.substr(-1).match(/[A-Za-z0-9]/) ? separator + symbol[ch] : symbol[ch];
					ch += input[i + 1] !== void 0 && input[i + 1].match(/[A-Za-z0-9]/) ? separator : "";
					lastCharWasSymbol = true;
				} else {
					if (lastCharWasDiatric === true) {
						ch = diatricMap[diatricString] + ch;
						diatricString = "";
						lastCharWasDiatric = false;
					} else if (lastCharWasSymbol && (/[A-Za-z0-9]/.test(ch) || result.substr(-1).match(/A-Za-z0-9]/))) ch = " " + ch;
					lastCharWasSymbol = false;
				}
				result += ch.replace(new RegExp("[^\\w\\s" + allowedChars + "_-]", "g"), separator);
			}
			if (titleCase) result = result.replace(/(\w)(\S*)/g, function(_, i, r) {
				var j = i.toUpperCase() + (r !== null ? r : "");
				return Object.keys(customReplacements).indexOf(j.toLowerCase()) < 0 ? j : j.toLowerCase();
			});
			result = result.replace(/\s+/g, separator).replace(new RegExp("\\" + separator + "+", "g"), separator).replace(new RegExp("(^\\" + separator + "+|\\" + separator + "+$)", "g"), "");
			if (truncate && result.length > truncate) {
				lucky = result.charAt(truncate) === separator;
				result = result.slice(0, truncate);
				if (!lucky) result = result.slice(0, result.lastIndexOf(separator));
			}
			if (!maintainCase && !titleCase) result = result.toLowerCase();
			return result;
		};
		/**
		* createSlug curried(opts)(input)
		* @param   {object|string} opts config object or input string
		* @return  {Function} function getSlugWithConfig()
		**/
		var createSlug = function createSlug(opts) {
			/**
			* getSlugWithConfig
			* @param   {string} input string
			* @return  {string} slug string
			*/
			return function getSlugWithConfig(input) {
				return getSlug(input, opts);
			};
		};
		/**
		* escape Chars
		* @param   {string} input string
		*/
		var escapeChars = function escapeChars(input) {
			return input.replace(/[-\\^$*+?.()|[\]{}\/]/g, "\\$&");
		};
		/**
		* check if the char is an already converted char from custom list
		* @param   {char} ch character to check
		* @param   {object} customReplacements custom translation map
		*/
		var isReplacedCustomChar = function(ch, customReplacements) {
			for (var c in customReplacements) if (customReplacements[c] === ch) return true;
		};
		if (typeof module !== "undefined" && module.exports) {
			module.exports = getSlug;
			module.exports.createSlug = createSlug;
		} else if (typeof define !== "undefined" && define.amd) define([], function() {
			return getSlug;
		});
		else try {
			if (root.getSlug || root.createSlug) throw "speakingurl: globals exists /(getSlug|createSlug)/";
			else {
				root.getSlug = getSlug;
				root.createSlug = createSlug;
			}
		} catch (e) {}
	})(exports);
}));
(/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_speakingurl$1();
})))();
target.__VUE_DEVTOOLS_NEXT_APP_RECORD_INFO__ ??= {
	id: 0,
	appIds: /* @__PURE__ */ new Set()
};
function onDevToolsClientConnected(fn) {
	return new Promise((resolve) => {
		if (devtoolsState.connected && devtoolsState.clientConnected) {
			fn();
			resolve();
			return;
		}
		devtoolsContext.hooks.hook(DevToolsMessagingHookKeys.DEVTOOLS_CONNECTED_UPDATED, ({ state }) => {
			if (state.connected && state.clientConnected) {
				fn();
				resolve();
			}
		});
	});
}
function toggleHighPerfMode(state) {
	devtoolsState.highPerfModeEnabled = state ?? !devtoolsState.highPerfModeEnabled;
	if (!state && activeAppRecord.value) registerDevToolsPlugin(activeAppRecord.value.app);
}
function updateDevToolsClientDetected(params) {
	devtoolsState.devtoolsClientDetected = {
		...devtoolsState.devtoolsClientDetected,
		...params
	};
	toggleHighPerfMode(!Object.values(devtoolsState.devtoolsClientDetected).some(Boolean));
}
target.__VUE_DEVTOOLS_UPDATE_CLIENT_DETECTED__ ??= updateDevToolsClientDetected;
var DoubleIndexedKV = class {
	constructor() {
		this.keyToValue = /* @__PURE__ */ new Map();
		this.valueToKey = /* @__PURE__ */ new Map();
	}
	set(key, value) {
		this.keyToValue.set(key, value);
		this.valueToKey.set(value, key);
	}
	getByKey(key) {
		return this.keyToValue.get(key);
	}
	getByValue(value) {
		return this.valueToKey.get(value);
	}
	clear() {
		this.keyToValue.clear();
		this.valueToKey.clear();
	}
};
var Registry = class {
	constructor(generateIdentifier) {
		this.generateIdentifier = generateIdentifier;
		this.kv = new DoubleIndexedKV();
	}
	register(value, identifier) {
		if (this.kv.getByValue(value)) return;
		if (!identifier) identifier = this.generateIdentifier(value);
		this.kv.set(identifier, value);
	}
	clear() {
		this.kv.clear();
	}
	getIdentifier(value) {
		return this.kv.getByValue(value);
	}
	getValue(identifier) {
		return this.kv.getByKey(identifier);
	}
};
var ClassRegistry = class extends Registry {
	constructor() {
		super((c) => c.name);
		this.classToAllowedProps = /* @__PURE__ */ new Map();
	}
	register(value, options) {
		if (typeof options === "object") {
			if (options.allowProps) this.classToAllowedProps.set(value, options.allowProps);
			super.register(value, options.identifier);
		} else super.register(value, options);
	}
	getAllowedProps(value) {
		return this.classToAllowedProps.get(value);
	}
};
function valuesOfObj(record) {
	if ("values" in Object) return Object.values(record);
	const values = [];
	for (const key in record) if (record.hasOwnProperty(key)) values.push(record[key]);
	return values;
}
function find(record, predicate) {
	const values = valuesOfObj(record);
	if ("find" in values) return values.find(predicate);
	const valuesNotNever = values;
	for (let i = 0; i < valuesNotNever.length; i++) {
		const value = valuesNotNever[i];
		if (predicate(value)) return value;
	}
}
function forEach(record, run) {
	Object.entries(record).forEach(([key, value]) => run(value, key));
}
function includes(arr, value) {
	return arr.indexOf(value) !== -1;
}
function findArr(record, predicate) {
	for (let i = 0; i < record.length; i++) {
		const value = record[i];
		if (predicate(value)) return value;
	}
}
var CustomTransformerRegistry = class {
	constructor() {
		this.transfomers = {};
	}
	register(transformer) {
		this.transfomers[transformer.name] = transformer;
	}
	findApplicable(v) {
		return find(this.transfomers, (transformer) => transformer.isApplicable(v));
	}
	findByName(name) {
		return this.transfomers[name];
	}
};
var getType$1 = (payload) => Object.prototype.toString.call(payload).slice(8, -1);
var isUndefined$1 = (payload) => typeof payload === "undefined";
var isNull$1 = (payload) => payload === null;
var isPlainObject$2 = (payload) => {
	if (typeof payload !== "object" || payload === null) return false;
	if (payload === Object.prototype) return false;
	if (Object.getPrototypeOf(payload) === null) return true;
	return Object.getPrototypeOf(payload) === Object.prototype;
};
var isEmptyObject = (payload) => isPlainObject$2(payload) && Object.keys(payload).length === 0;
var isArray$2 = (payload) => Array.isArray(payload);
var isString = (payload) => typeof payload === "string";
var isNumber = (payload) => typeof payload === "number" && !isNaN(payload);
var isBoolean = (payload) => typeof payload === "boolean";
var isRegExp = (payload) => payload instanceof RegExp;
var isMap = (payload) => payload instanceof Map;
var isSet = (payload) => payload instanceof Set;
var isSymbol = (payload) => getType$1(payload) === "Symbol";
var isDate = (payload) => payload instanceof Date && !isNaN(payload.valueOf());
var isError = (payload) => payload instanceof Error;
var isNaNValue = (payload) => typeof payload === "number" && isNaN(payload);
var isPrimitive = (payload) => isBoolean(payload) || isNull$1(payload) || isUndefined$1(payload) || isNumber(payload) || isString(payload) || isSymbol(payload);
var isBigint = (payload) => typeof payload === "bigint";
var isInfinite = (payload) => payload === Infinity || payload === -Infinity;
var isTypedArray = (payload) => ArrayBuffer.isView(payload) && !(payload instanceof DataView);
var isURL = (payload) => payload instanceof URL;
var escapeKey = (key) => key.replace(/\./g, "\\.");
var stringifyPath = (path) => path.map(String).map(escapeKey).join(".");
var parsePath = (string) => {
	const result = [];
	let segment = "";
	for (let i = 0; i < string.length; i++) {
		let char = string.charAt(i);
		if (char === "\\" && string.charAt(i + 1) === ".") {
			segment += ".";
			i++;
			continue;
		}
		if (char === ".") {
			result.push(segment);
			segment = "";
			continue;
		}
		segment += char;
	}
	const lastSegment = segment;
	result.push(lastSegment);
	return result;
};
function simpleTransformation(isApplicable, annotation, transform, untransform) {
	return {
		isApplicable,
		annotation,
		transform,
		untransform
	};
}
var simpleRules = [
	simpleTransformation(isUndefined$1, "undefined", () => null, () => void 0),
	simpleTransformation(isBigint, "bigint", (v) => v.toString(), (v) => {
		if (typeof BigInt !== "undefined") return BigInt(v);
		console.error("Please add a BigInt polyfill.");
		return v;
	}),
	simpleTransformation(isDate, "Date", (v) => v.toISOString(), (v) => new Date(v)),
	simpleTransformation(isError, "Error", (v, superJson) => {
		const baseError = {
			name: v.name,
			message: v.message
		};
		superJson.allowedErrorProps.forEach((prop) => {
			baseError[prop] = v[prop];
		});
		return baseError;
	}, (v, superJson) => {
		const e = new Error(v.message);
		e.name = v.name;
		e.stack = v.stack;
		superJson.allowedErrorProps.forEach((prop) => {
			e[prop] = v[prop];
		});
		return e;
	}),
	simpleTransformation(isRegExp, "regexp", (v) => "" + v, (regex) => {
		const body = regex.slice(1, regex.lastIndexOf("/"));
		const flags = regex.slice(regex.lastIndexOf("/") + 1);
		return new RegExp(body, flags);
	}),
	simpleTransformation(isSet, "set", (v) => [...v.values()], (v) => new Set(v)),
	simpleTransformation(isMap, "map", (v) => [...v.entries()], (v) => new Map(v)),
	simpleTransformation((v) => isNaNValue(v) || isInfinite(v), "number", (v) => {
		if (isNaNValue(v)) return "NaN";
		if (v > 0) return "Infinity";
		else return "-Infinity";
	}, Number),
	simpleTransformation((v) => v === 0 && 1 / v === -Infinity, "number", () => {
		return "-0";
	}, Number),
	simpleTransformation(isURL, "URL", (v) => v.toString(), (v) => new URL(v))
];
function compositeTransformation(isApplicable, annotation, transform, untransform) {
	return {
		isApplicable,
		annotation,
		transform,
		untransform
	};
}
var symbolRule = compositeTransformation((s, superJson) => {
	if (isSymbol(s)) return !!superJson.symbolRegistry.getIdentifier(s);
	return false;
}, (s, superJson) => {
	return ["symbol", superJson.symbolRegistry.getIdentifier(s)];
}, (v) => v.description, (_, a, superJson) => {
	const value = superJson.symbolRegistry.getValue(a[1]);
	if (!value) throw new Error("Trying to deserialize unknown symbol");
	return value;
});
var constructorToName = [
	Int8Array,
	Uint8Array,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array,
	Uint8ClampedArray
].reduce((obj, ctor) => {
	obj[ctor.name] = ctor;
	return obj;
}, {});
var typedArrayRule = compositeTransformation(isTypedArray, (v) => ["typed-array", v.constructor.name], (v) => [...v], (v, a) => {
	const ctor = constructorToName[a[1]];
	if (!ctor) throw new Error("Trying to deserialize unknown typed array");
	return new ctor(v);
});
function isInstanceOfRegisteredClass(potentialClass, superJson) {
	if (potentialClass?.constructor) return !!superJson.classRegistry.getIdentifier(potentialClass.constructor);
	return false;
}
var classRule = compositeTransformation(isInstanceOfRegisteredClass, (clazz, superJson) => {
	return ["class", superJson.classRegistry.getIdentifier(clazz.constructor)];
}, (clazz, superJson) => {
	const allowedProps = superJson.classRegistry.getAllowedProps(clazz.constructor);
	if (!allowedProps) return { ...clazz };
	const result = {};
	allowedProps.forEach((prop) => {
		result[prop] = clazz[prop];
	});
	return result;
}, (v, a, superJson) => {
	const clazz = superJson.classRegistry.getValue(a[1]);
	if (!clazz) throw new Error(`Trying to deserialize unknown class '${a[1]}' - check https://github.com/blitz-js/superjson/issues/116#issuecomment-773996564`);
	return Object.assign(Object.create(clazz.prototype), v);
});
var customRule = compositeTransformation((value, superJson) => {
	return !!superJson.customTransformerRegistry.findApplicable(value);
}, (value, superJson) => {
	return ["custom", superJson.customTransformerRegistry.findApplicable(value).name];
}, (value, superJson) => {
	return superJson.customTransformerRegistry.findApplicable(value).serialize(value);
}, (v, a, superJson) => {
	const transformer = superJson.customTransformerRegistry.findByName(a[1]);
	if (!transformer) throw new Error("Trying to deserialize unknown custom value");
	return transformer.deserialize(v);
});
var compositeRules = [
	classRule,
	symbolRule,
	customRule,
	typedArrayRule
];
var transformValue = (value, superJson) => {
	const applicableCompositeRule = findArr(compositeRules, (rule) => rule.isApplicable(value, superJson));
	if (applicableCompositeRule) return {
		value: applicableCompositeRule.transform(value, superJson),
		type: applicableCompositeRule.annotation(value, superJson)
	};
	const applicableSimpleRule = findArr(simpleRules, (rule) => rule.isApplicable(value, superJson));
	if (applicableSimpleRule) return {
		value: applicableSimpleRule.transform(value, superJson),
		type: applicableSimpleRule.annotation
	};
};
var simpleRulesByAnnotation = {};
simpleRules.forEach((rule) => {
	simpleRulesByAnnotation[rule.annotation] = rule;
});
var untransformValue = (json, type, superJson) => {
	if (isArray$2(type)) switch (type[0]) {
		case "symbol": return symbolRule.untransform(json, type, superJson);
		case "class": return classRule.untransform(json, type, superJson);
		case "custom": return customRule.untransform(json, type, superJson);
		case "typed-array": return typedArrayRule.untransform(json, type, superJson);
		default: throw new Error("Unknown transformation: " + type);
	}
	else {
		const transformation = simpleRulesByAnnotation[type];
		if (!transformation) throw new Error("Unknown transformation: " + type);
		return transformation.untransform(json, superJson);
	}
};
var getNthKey = (value, n) => {
	if (n > value.size) throw new Error("index out of bounds");
	const keys = value.keys();
	while (n > 0) {
		keys.next();
		n--;
	}
	return keys.next().value;
};
function validatePath(path) {
	if (includes(path, "__proto__")) throw new Error("__proto__ is not allowed as a property");
	if (includes(path, "prototype")) throw new Error("prototype is not allowed as a property");
	if (includes(path, "constructor")) throw new Error("constructor is not allowed as a property");
}
var getDeep = (object, path) => {
	validatePath(path);
	for (let i = 0; i < path.length; i++) {
		const key = path[i];
		if (isSet(object)) object = getNthKey(object, +key);
		else if (isMap(object)) {
			const row = +key;
			const type = +path[++i] === 0 ? "key" : "value";
			const keyOfRow = getNthKey(object, row);
			switch (type) {
				case "key":
					object = keyOfRow;
					break;
				case "value":
					object = object.get(keyOfRow);
					break;
			}
		} else object = object[key];
	}
	return object;
};
var setDeep = (object, path, mapper) => {
	validatePath(path);
	if (path.length === 0) return mapper(object);
	let parent = object;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (isArray$2(parent)) {
			const index = +key;
			parent = parent[index];
		} else if (isPlainObject$2(parent)) parent = parent[key];
		else if (isSet(parent)) {
			const row = +key;
			parent = getNthKey(parent, row);
		} else if (isMap(parent)) {
			if (i === path.length - 2) break;
			const row = +key;
			const type = +path[++i] === 0 ? "key" : "value";
			const keyOfRow = getNthKey(parent, row);
			switch (type) {
				case "key":
					parent = keyOfRow;
					break;
				case "value":
					parent = parent.get(keyOfRow);
					break;
			}
		}
	}
	const lastKey = path[path.length - 1];
	if (isArray$2(parent)) parent[+lastKey] = mapper(parent[+lastKey]);
	else if (isPlainObject$2(parent)) parent[lastKey] = mapper(parent[lastKey]);
	if (isSet(parent)) {
		const oldValue = getNthKey(parent, +lastKey);
		const newValue = mapper(oldValue);
		if (oldValue !== newValue) {
			parent.delete(oldValue);
			parent.add(newValue);
		}
	}
	if (isMap(parent)) {
		const row = +path[path.length - 2];
		const keyToRow = getNthKey(parent, row);
		switch (+lastKey === 0 ? "key" : "value") {
			case "key": {
				const newKey = mapper(keyToRow);
				parent.set(newKey, parent.get(keyToRow));
				if (newKey !== keyToRow) parent.delete(keyToRow);
				break;
			}
			case "value":
				parent.set(keyToRow, mapper(parent.get(keyToRow)));
				break;
		}
	}
	return object;
};
function traverse(tree, walker, origin = []) {
	if (!tree) return;
	if (!isArray$2(tree)) {
		forEach(tree, (subtree, key) => traverse(subtree, walker, [...origin, ...parsePath(key)]));
		return;
	}
	const [nodeValue, children] = tree;
	if (children) forEach(children, (child, key) => {
		traverse(child, walker, [...origin, ...parsePath(key)]);
	});
	walker(nodeValue, origin);
}
function applyValueAnnotations(plain, annotations, superJson) {
	traverse(annotations, (type, path) => {
		plain = setDeep(plain, path, (v) => untransformValue(v, type, superJson));
	});
	return plain;
}
function applyReferentialEqualityAnnotations(plain, annotations) {
	function apply(identicalPaths, path) {
		const object = getDeep(plain, parsePath(path));
		identicalPaths.map(parsePath).forEach((identicalObjectPath) => {
			plain = setDeep(plain, identicalObjectPath, () => object);
		});
	}
	if (isArray$2(annotations)) {
		const [root, other] = annotations;
		root.forEach((identicalPath) => {
			plain = setDeep(plain, parsePath(identicalPath), () => plain);
		});
		if (other) forEach(other, apply);
	} else forEach(annotations, apply);
	return plain;
}
var isDeep = (object, superJson) => isPlainObject$2(object) || isArray$2(object) || isMap(object) || isSet(object) || isInstanceOfRegisteredClass(object, superJson);
function addIdentity(object, path, identities) {
	const existingSet = identities.get(object);
	if (existingSet) existingSet.push(path);
	else identities.set(object, [path]);
}
function generateReferentialEqualityAnnotations(identitites, dedupe) {
	const result = {};
	let rootEqualityPaths = void 0;
	identitites.forEach((paths) => {
		if (paths.length <= 1) return;
		if (!dedupe) paths = paths.map((path) => path.map(String)).sort((a, b) => a.length - b.length);
		const [representativePath, ...identicalPaths] = paths;
		if (representativePath.length === 0) rootEqualityPaths = identicalPaths.map(stringifyPath);
		else result[stringifyPath(representativePath)] = identicalPaths.map(stringifyPath);
	});
	if (rootEqualityPaths) if (isEmptyObject(result)) return [rootEqualityPaths];
	else return [rootEqualityPaths, result];
	else return isEmptyObject(result) ? void 0 : result;
}
var walker = (object, identities, superJson, dedupe, path = [], objectsInThisPath = [], seenObjects = /* @__PURE__ */ new Map()) => {
	const primitive = isPrimitive(object);
	if (!primitive) {
		addIdentity(object, path, identities);
		const seen = seenObjects.get(object);
		if (seen) return dedupe ? { transformedValue: null } : seen;
	}
	if (!isDeep(object, superJson)) {
		const transformed = transformValue(object, superJson);
		const result = transformed ? {
			transformedValue: transformed.value,
			annotations: [transformed.type]
		} : { transformedValue: object };
		if (!primitive) seenObjects.set(object, result);
		return result;
	}
	if (includes(objectsInThisPath, object)) return { transformedValue: null };
	const transformationResult = transformValue(object, superJson);
	const transformed = transformationResult?.value ?? object;
	const transformedValue = isArray$2(transformed) ? [] : {};
	const innerAnnotations = {};
	forEach(transformed, (value, index) => {
		if (index === "__proto__" || index === "constructor" || index === "prototype") throw new Error(`Detected property ${index}. This is a prototype pollution risk, please remove it from your object.`);
		const recursiveResult = walker(value, identities, superJson, dedupe, [...path, index], [...objectsInThisPath, object], seenObjects);
		transformedValue[index] = recursiveResult.transformedValue;
		if (isArray$2(recursiveResult.annotations)) innerAnnotations[index] = recursiveResult.annotations;
		else if (isPlainObject$2(recursiveResult.annotations)) forEach(recursiveResult.annotations, (tree, key) => {
			innerAnnotations[escapeKey(index) + "." + key] = tree;
		});
	});
	const result = isEmptyObject(innerAnnotations) ? {
		transformedValue,
		annotations: !!transformationResult ? [transformationResult.type] : void 0
	} : {
		transformedValue,
		annotations: !!transformationResult ? [transformationResult.type, innerAnnotations] : innerAnnotations
	};
	if (!primitive) seenObjects.set(object, result);
	return result;
};
function getType(payload) {
	return Object.prototype.toString.call(payload).slice(8, -1);
}
function isArray$1(payload) {
	return getType(payload) === "Array";
}
function isPlainObject$1(payload) {
	if (getType(payload) !== "Object") return false;
	const prototype = Object.getPrototypeOf(payload);
	return !!prototype && prototype.constructor === Object && prototype === Object.prototype;
}
function assignProp(carry, key, newVal, originalObject, includeNonenumerable) {
	const propType = {}.propertyIsEnumerable.call(originalObject, key) ? "enumerable" : "nonenumerable";
	if (propType === "enumerable") carry[key] = newVal;
	if (includeNonenumerable && propType === "nonenumerable") Object.defineProperty(carry, key, {
		value: newVal,
		enumerable: false,
		writable: true,
		configurable: true
	});
}
function copy(target, options = {}) {
	if (isArray$1(target)) return target.map((item) => copy(item, options));
	if (!isPlainObject$1(target)) return target;
	const props = Object.getOwnPropertyNames(target);
	const symbols = Object.getOwnPropertySymbols(target);
	return [...props, ...symbols].reduce((carry, key) => {
		if (isArray$1(options.props) && !options.props.includes(key)) return carry;
		const val = target[key];
		assignProp(carry, key, copy(val, options), target, options.nonenumerable);
		return carry;
	}, {});
}
var SuperJSON = class {
	/**
	* @param dedupeReferentialEqualities  If true, SuperJSON will make sure only one instance of referentially equal objects are serialized and the rest are replaced with `null`.
	*/
	constructor({ dedupe = false } = {}) {
		this.classRegistry = new ClassRegistry();
		this.symbolRegistry = new Registry((s) => s.description ?? "");
		this.customTransformerRegistry = new CustomTransformerRegistry();
		this.allowedErrorProps = [];
		this.dedupe = dedupe;
	}
	serialize(object) {
		const identities = /* @__PURE__ */ new Map();
		const output = walker(object, identities, this, this.dedupe);
		const res = { json: output.transformedValue };
		if (output.annotations) res.meta = {
			...res.meta,
			values: output.annotations
		};
		const equalityAnnotations = generateReferentialEqualityAnnotations(identities, this.dedupe);
		if (equalityAnnotations) res.meta = {
			...res.meta,
			referentialEqualities: equalityAnnotations
		};
		return res;
	}
	deserialize(payload) {
		const { json, meta } = payload;
		let result = copy(json);
		if (meta?.values) result = applyValueAnnotations(result, meta.values, this);
		if (meta?.referentialEqualities) result = applyReferentialEqualityAnnotations(result, meta.referentialEqualities);
		return result;
	}
	stringify(object) {
		return JSON.stringify(this.serialize(object));
	}
	parse(string) {
		return this.deserialize(JSON.parse(string));
	}
	registerClass(v, options) {
		this.classRegistry.register(v, options);
	}
	registerSymbol(v, identifier) {
		this.symbolRegistry.register(v, identifier);
	}
	registerCustom(transformer, name) {
		this.customTransformerRegistry.register({
			name,
			...transformer
		});
	}
	allowErrorProps(...props) {
		this.allowedErrorProps.push(...props);
	}
};
SuperJSON.defaultInstance = new SuperJSON();
SuperJSON.serialize = SuperJSON.defaultInstance.serialize.bind(SuperJSON.defaultInstance);
SuperJSON.deserialize = SuperJSON.defaultInstance.deserialize.bind(SuperJSON.defaultInstance);
SuperJSON.stringify = SuperJSON.defaultInstance.stringify.bind(SuperJSON.defaultInstance);
SuperJSON.parse = SuperJSON.defaultInstance.parse.bind(SuperJSON.defaultInstance);
SuperJSON.registerClass = SuperJSON.defaultInstance.registerClass.bind(SuperJSON.defaultInstance);
SuperJSON.registerSymbol = SuperJSON.defaultInstance.registerSymbol.bind(SuperJSON.defaultInstance);
SuperJSON.registerCustom = SuperJSON.defaultInstance.registerCustom.bind(SuperJSON.defaultInstance);
SuperJSON.allowErrorProps = SuperJSON.defaultInstance.allowErrorProps.bind(SuperJSON.defaultInstance);
SuperJSON.serialize;
SuperJSON.deserialize;
SuperJSON.stringify;
SuperJSON.parse;
SuperJSON.registerClass;
SuperJSON.registerCustom;
SuperJSON.registerSymbol;
SuperJSON.allowErrorProps;
target.__VUE_DEVTOOLS_KIT_MESSAGE_CHANNELS__ ??= [];
target.__VUE_DEVTOOLS_KIT_RPC_CLIENT__ ??= null;
target.__VUE_DEVTOOLS_KIT_RPC_SERVER__ ??= null;
target.__VUE_DEVTOOLS_KIT_VITE_RPC_CLIENT__ ??= null;
target.__VUE_DEVTOOLS_KIT_VITE_RPC_SERVER__ ??= null;
target.__VUE_DEVTOOLS_KIT_BROADCAST_RPC_SERVER__ ??= null;
//#endregion
export { addCustomCommand, addCustomTab, onDevToolsClientConnected, onDevToolsConnected, removeCustomCommand, setupDevToolsPlugin, setupDevToolsPlugin as setupDevtoolsPlugin };
