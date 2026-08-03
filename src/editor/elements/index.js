/**
 * 元素注册表(组件库风格):每个元素类型自包含 { type, label, icon, defaults, Content, Props },
 * 集中聚合后派生出各消费者需要的形式,消除散落各处的 switch/case 与重复元数据。
 *
 * - Content/Props 为模块级常量组件(非 render 内创建),调用方按需注入 styles。
 * - 新增元素类型只需在此目录加一个定义文件并登记到 DEFS,无需改动各消费者。
 */
import { ELEMENT_TYPES } from "./types";
import text from "./Text";
import rect from "./Rect";
import circle from "./Circle";
import image from "./Image";
import button from "./Button";
import container from "./Container";

/** 元素定义数组(顺序即面板展示顺序) */
const DEFS = [text, rect, circle, image, button, container];

/** type -> 完整定义对象(含 Content/Props/icon 等) */
export const ELEMENT_DEFS = Object.fromEntries(DEFS.map((d) => [d.type, d]));

/** 按 type 取定义(未注册返回 undefined) */
export const getDef = (type) => ELEMENT_DEFS[type];

/** 面板项:仅暴露 { type, label, defaults } */
export const PALETTE_ITEMS = DEFS.map(({ type, label, defaults }) => ({
  type,
  label,
  defaults,
}));

/** type -> { type, label, defaults }(供 createElement 等只读元数据的场景) */
export const PALETTE_ITEM_MAP = Object.fromEntries(
  DEFS.map(({ type, label, defaults }) => [type, { type, label, defaults }]),
);

/** type -> 图标组件 */
export const ELEMENT_ICONS = Object.fromEntries(DEFS.map((d) => [d.type, d.icon]));

/* ------------------------------------------------------------------ */
/* 可变注册层:运行时注册自定义元素类型(扩展)                            */
/* 内置 DEFS 在模块加载时种子化上述映射;registerElement 就地扩展它们,  */
/* 消费者(getDef/createElement/Palette)均在 render/call 时读取,可见更新。*/
/* ------------------------------------------------------------------ */

/** 注册表版本号 + 订阅集合:供 <Palette> 通过 useSyncExternalStore 响应注册变更 */
let registryVersion = 0;
const registryListeners = new Set();

/** 订阅注册表变更,返回取消订阅函数(useSyncExternalStore 的 subscribe) */
export function subscribeRegistry(listener) {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

/** 读取当前注册表版本(getSnapshot,返回原始数值,无变更时引用稳定,不会触发循环) */
export function getRegistryVersion() {
  return registryVersion;
}

function notifyRegistry() {
  registryVersion += 1;
  registryListeners.forEach((l) => l());
}

/**
 * 运行时注册一个元素类型,使其可被拖入画布并正确渲染/创建。
 *
 * @param {Object} def - 元素定义,形状与内置定义一致:
 *   { type, label, icon, defaults: { width, height, props }, Content, Props }
 * @param {Object} [opts]
 * @param {boolean} [opts.palette=true] - true: 同时加入内置 <Palette> 面板;
 *   false: 仅注册为可创建/可渲染(由调用方自行渲染拖拽入口,如 <DraggableElement>)。
 * @returns {Object} def
 */
export function registerElement(def, { palette = true } = {}) {
  if (!def || typeof def.type !== "string" || !def.type) {
    throw new Error("registerElement: def.type 必须是非空字符串");
  }
  if (!def.defaults || typeof def.defaults !== "object") {
    throw new Error("registerElement: def.defaults 必须是对象");
  }

  // 就地更新派生映射:消费者均在 render/call 时读取,无需重新赋值绑定
  ELEMENT_DEFS[def.type] = def;
  PALETTE_ITEM_MAP[def.type] = {
    type: def.type,
    label: def.label,
    defaults: def.defaults,
  };
  if (def.icon) ELEMENT_ICONS[def.type] = def.icon;

  if (palette) {
    const item = { type: def.type, label: def.label, defaults: def.defaults };
    const idx = PALETTE_ITEMS.findIndex((it) => it.type === def.type);
    if (idx >= 0) PALETTE_ITEMS[idx] = item;
    else PALETTE_ITEMS.push(item);
    // 仅在 PALETTE_ITEMS 实际变更时通知,<Palette> 才需重渲染
    notifyRegistry();
  }

  return def;
}

export { ELEMENT_TYPES };
