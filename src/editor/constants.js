/**
 * 画布常量:单位、画布尺寸、缩放范围、吸附阈值。
 * 元素类型/面板项/图标等元数据已迁移至 src/editor/elements/ 注册表。
 */

/** 单位类型 */
export const UNIT = {
  PX: "px",
  PERCENT: "%",
};

/** 画布尺寸(逻辑像素) */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 720;

/** 缩放范围 */
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;
/** 缩放步进（按钮 +/- 每次倍率） */
export const ZOOM_STEP = 0.1;

/** 吸附阈值（px） */
export const SNAP_THRESHOLD = 6;
