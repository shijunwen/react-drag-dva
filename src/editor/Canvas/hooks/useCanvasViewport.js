import { useState, useRef, useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { setViewportAtom, setZoomAtom, zoomAtom } from "@/atoms";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../../constants";
import { FIT_PADDING } from "../canvasConstants";
import { getViewerWrapper } from "../moveableHelpers";
import { isEditable } from "../../utils";

/**
 * 画布视口逻辑:zoom / pan / scroll / 空格键。
 * 自取 zoomAtom / setViewportAtom / setZoomAtom;入参 viewerRef / gridRef / dndActive / selectedIds。
 * 默认进入时 fitToView 居中(原 Canvas 初始 effect)。
 */
export function useCanvasViewport({ viewerRef, gridRef, dndActive, selectedIds }) {
  // 空格键按下时才允许拖拽平移画布，避免与顶部拖入组件冲突
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panEnabled, setPanEnabled] = useState(false);

  const canDrag = (panEnabled || spaceHeld) && !dndActive;
  const canDragRef = useRef(canDrag);
  const selectedIdsRef = useRef(selectedIds);
  const centeredRef = useRef(false);

  const zoom = useAtomValue(zoomAtom);
  const setViewport = useSetAtom(setViewportAtom);
  const setZoom = useSetAtom(setZoomAtom);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" && !isEditable(document.activeElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    canDragRef.current = canDrag;
    selectedIdsRef.current = selectedIds;
  }, [canDrag, selectedIds]);

  // 控制 InfiniteViewer 的滚动容器 overflow 属性，当 !canDrag 时禁止原生滚动
  useEffect(() => {
    if (!viewerRef.current) return;
    const wrapper = getViewerWrapper(viewerRef.current);
    if (!wrapper) return;
    wrapper.style.overflow = canDrag ? "auto" : "hidden";
  }, [canDrag, viewerRef]);

  /**
   * 动态计算缩放使所有模板板完整可见且居中（contain 整个网格）。
   */
  const fitToView = useCallback(() => {
    const viewer = viewerRef.current;
    const grid = gridRef.current;
    if (!viewer || !grid) return;
    const container = viewer.getContainer?.();
    const viewW = container?.clientWidth ?? 0;
    const viewH = container?.clientHeight ?? 0;
    if (!viewW || !viewH) return;
    const rect = grid.getBoundingClientRect();
    // 用网格的「逻辑尺寸」(屏幕尺寸 / 当前 zoom)还原为内容尺寸
    const contentW = rect.width / zoom;
    const contentH = rect.height / zoom;
    if (!contentW || !contentH) return;
    const raw = Math.min(
      (viewW - FIT_PADDING * 2) / contentW,
      (viewH - FIT_PADDING * 2) / contentH,
    );
    const fit = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(1, raw)));
    viewer.setZoom(fit);
    requestAnimationFrame(() => {
      viewer.scrollCenter({ absolute: true });
      setViewport({
        zoom: fit,
        scrollLeft: viewer.getScrollLeft(),
        scrollTop: viewer.getScrollTop(),
      });
    });
  }, [zoom, setViewport, viewerRef, gridRef]);

  // 默认进入：动态计算缩放使画布完整可见且居中
  useEffect(() => {
    if (centeredRef.current || !viewerRef.current) return;
    centeredRef.current = true;
    requestAnimationFrame(() => fitToView());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(
    (e) => setViewport({ scrollLeft: e.scrollLeft, scrollTop: e.scrollTop }),
    [setViewport],
  );
  const handlePinch = useCallback(
    (e) => {
      const v = viewerRef.current;
      setViewport({
        zoom: e.zoom,
        scrollLeft: v?.getScrollLeft() ?? 0,
        scrollTop: v?.getScrollTop() ?? 0,
      });
    },
    [setViewport, viewerRef],
  );

  const zoomBy = useCallback(
    (delta) => {
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(zoom + delta).toFixed(2)));
      setZoom(z);
      viewerRef.current?.setZoom(z);
    },
    [zoom, setZoom, viewerRef],
  );
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy]);
  const zoomReset = useCallback(() => {
    const viewer = viewerRef.current;
    viewer?.setZoom(1);
    requestAnimationFrame(() => {
      viewer?.scrollCenter({ absolute: true });
      setViewport({
        zoom: 1,
        scrollLeft: viewer?.getScrollLeft() ?? 0,
        scrollTop: viewer?.getScrollTop() ?? 0,
      });
    });
  }, [setViewport, viewerRef]);

  const togglePan = useCallback(() => setPanEnabled((v) => !v), []);

  const handleViewerDragStart = useCallback((e) => {
    if (window.__dndActive || !canDragRef.current || selectedIdsRef.current.length > 0) return false;
    const target = e.inputEvent?.target;
    if (
      target?.closest?.("[data-id]") ||
      target?.closest?.("[data-zoom-bar]") ||
      target?.closest?.("[data-no-drag]")
    ) {
      return false;
    }
  }, []);

  return {
    canDrag,
    panEnabled,
    togglePan,
    zoomIn,
    zoomOut,
    zoomReset,
    handleScroll,
    handlePinch,
    handleViewerDragStart,
  };
}
