import { UNIT } from "../constants";

/**
 * 将带单位的值换算为百分比数值（0~100）。
 * px 值除以 canvasSize 换算；% 值直接返回。
 */
export const toPercent = (value, unit, canvasSize) => {
  if (unit === UNIT.PERCENT) return value;
  if (!canvasSize) return 0;
  return (value / canvasSize) * 100;
};

/**
 * 将逻辑像素值转换为元素存储单位下的值。
 * px 模式原样返回；% 模式按 canvasSize 换算为百分比（0~100）。
 */
export const pxToUnit = (px, unit, canvasSize) => {
  if (unit === UNIT.PERCENT && canvasSize) return (px / canvasSize) * 100;
  return px;
};

/**
 * 将带单位的值转为 CSS 字符串。
 */
export const toCss = (value, unit) => {
  if (unit === UNIT.PERCENT) return `${value}%`;
  return `${value}px`;
};
