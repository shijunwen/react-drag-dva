/**
 * Moveable / InfiniteViewer 共享的纯工具与稳定常量。
 * 从 Canvas.jsx、MoveableLayer.jsx、BoardResizer.jsx 收口,消除重复定义。
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";

/** 取 InfiniteViewer 滚动 wrapper(兼容多版本 API) */
export const getViewerWrapper = (viewer) =>
  viewer?.wrapperElement ||
  viewer?.wrapper ||
  (typeof viewer?.getWrapper === "function" ? viewer.getWrapper() : null) ||
  (typeof viewer?.getContainer === "function" ? viewer.getContainer() : null) ||
  viewer;

export const round = (v, decimals = 0) => {
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
};

export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * 直接写 DOM，拖拽/缩放过程中不触发 React 重渲染（高性能）
 *  根据 unit 决定 x/width 用 % 还是 px，y/height 始终为 px
 */
export const applyToDom = (target, patch, unit = "px") => {
  const xIsPercent = unit === "%";
  if (patch.x !== undefined) target.style.left = xIsPercent ? `${patch.x}%` : `${patch.x}px`;
  if (patch.y !== undefined) target.style.top = `${patch.y}px`;
  if (patch.width !== undefined)
    target.style.width = xIsPercent ? `${patch.width}%` : `${patch.width}px`;
  if (patch.height !== undefined) target.style.height = `${patch.height}px`;
  if (patch.rotation !== undefined)
    target.style.transform = `rotate(${patch.rotation}deg)`;
};

/**
 * 锁定节点的可滚祖先(overflow: auto -> visible),返回可恢复快照。
 * 拖拽时禁用 .content 自动滚动(moveable Scrollable able 会滚它),且 visible
 * 不截断,让拖拽元素能视觉飞出容器边界。到达所属模板画板即停止。
 */
export const lockScrollAncestors = (node) => {
  const locked = [];
  let p = node?.parentElement;
  while (p && p !== document.documentElement) {
    // 到达模板画板即停止:画板之上的 InfiniteViewer .wrapper(overflow:auto)是画布
    // 滚动/缩放容器,锁定它会清空 scrollLeft/Top 导致画布整体漂移。
    if (p.dataset?.templateId !== undefined) break;
    const cs = getComputedStyle(p);
    const isAutoScroll =
      cs.overflow === "auto" || cs.overflowX === "auto" || cs.overflowY === "auto";
    if (isAutoScroll) {
      locked.push({ el: p, prev: p.style.overflow });
      p.style.overflow = "visible";
    }
    p = p.parentElement;
  }
  return locked;
};

export const unlockScrollAncestors = (locked) => {
  locked.forEach(({ el, prev }) => {
    el.style.overflow = prev;
  });
};

/** 组合 translate + rotate 的 transform 字符串 */
export const buildRotationTransform = (translate, rotation) => {
  const parts = [];
  if (translate) parts.push(translate);
  if (rotation !== undefined && rotation !== null) parts.push(`rotate(${rotation}deg)`);
  return parts.join(" ");
};

// 提升到模块作用域的稳定回调/常量：避免每次 render 产生新引用传给 Moveable
export const SNAP_DIST_FORMAT = (v) => `${v}px`;
export const ZERO_SCROLL_POS = [0, 0];
export const GET_SCROLL_POSITION = () => ZERO_SCROLL_POS;
export const FALLBACK_SIZE = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
