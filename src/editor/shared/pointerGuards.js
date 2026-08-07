/**
 * 指针仲裁守卫 — 统一判断 DOM 元素是否为交互目标。
 * 消除 useSelectionCapture / MarqueeSelect / useCanvasViewport 三处重复。
 */

/** 交互元素 CSS 选择器（不含 data-id，由调用方按需组合） */
export const INTERACTIVE_SELECTOR =
  '[data-no-drag],[data-zoom-bar],.ruler-area,.moveable-control,.moveable-line';

/** 判断目标元素或其祖先是否匹配交互选择器 */
export const isInteractiveTarget = (el, selector = INTERACTIVE_SELECTOR) => {
  if (!el) return false;
  return !!el.closest(selector);
};
