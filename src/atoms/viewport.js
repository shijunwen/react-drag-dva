import { atom } from "jotai";

/** 画布视口状态（缩放 + 平移），由 InfiniteViewer 驱动。
 *  画布尺寸已迁移到 templatesAtom(每模板独立尺寸)。 */
export const viewportAtom = atom({
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
});

export const setViewportAtom = atom(null, (get, set, patch) => {
  set(viewportAtom, { ...get(viewportAtom), ...patch });
});

export const setZoomAtom = atom(null, (get, set, zoom) => {
  set(viewportAtom, { ...get(viewportAtom), zoom });
});

/** 聚焦的只读派生:仅订阅 zoom。平移/滚动(scrollLeft/Top 变化)时不触发只读 zoom 的组件重渲染。 */
export const zoomAtom = atom((get) => get(viewportAtom).zoom);

// canvasWidthAtom / canvasHeightAtom / setCanvasSizeAtom 已迁移至 ./templates
// (按激活模板尺寸派生,支持每模板独立尺寸)。
