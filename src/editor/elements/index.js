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

export { ELEMENT_TYPES };
