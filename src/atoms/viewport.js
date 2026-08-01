import { atom } from "jotai";

/** 画布视口状态（缩放 + 平移 + 画布尺寸），由 InfiniteViewer 驱动 */
export const viewportAtom = atom({
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
  canvasWidth: 1200,
  canvasHeight: 720,
});

export const setViewportAtom = atom(null, (get, set, patch) => {
  set(viewportAtom, { ...get(viewportAtom), ...patch });
});

export const setZoomAtom = atom(null, (get, set, zoom) => {
  set(viewportAtom, { ...get(viewportAtom), zoom });
});

export const setCanvasSizeAtom = atom(null, (get, set, { width, height }) => {
  set(viewportAtom, { ...get(viewportAtom), canvasWidth: width, canvasHeight: height });
});

/**
 * 聚焦的只读派生 atom：仅订阅所需字段。
 * Jotai 对派生 atom 做 Object.is 比较，值未变则不触发订阅组件重渲染——
 * 故平移/滚动（仅 scrollLeft/scrollTop 变）时，只读 zoom/canvasSize 的组件不再重渲染，
 * 避免 Editor（仅读 zoom）等在每次滚动时整树重渲染。
 */
export const zoomAtom = atom((get) => get(viewportAtom).zoom);
export const canvasWidthAtom = atom((get) => get(viewportAtom).canvasWidth);
export const canvasHeightAtom = atom((get) => get(viewportAtom).canvasHeight);
