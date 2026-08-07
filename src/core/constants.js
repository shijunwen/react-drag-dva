/**
 * 核心常量 — 纯数据，零 UI / 零框架依赖。
 * 画布尺寸、缩放范围、吸附阈值、元素类型字符串、节点前缀等。
 */

/** 单位类型 */
export const UNIT = {
  PX: "px",
  PERCENT: "%",
};

/** 画布尺寸（逻辑像素） */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 240;

/** 缩放范围 */
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

/** 缩放步进（按钮 +/- 每次倍率） */
export const ZOOM_STEP = 0.1;

/** 吸附阈值（px） */
export const SNAP_THRESHOLD = 6;

/** 组件树模板节点前缀 */
export const TEMPLATE_NODE_PREFIX = "tpl-";

/** droppable id 工厂：容器目标 */
export const containerDroppableId = (id) => `container-${id}`;

/** droppable id 工厂：模板（画板）目标 */
export const templateDroppableId = (id) => `template-${id}`;
