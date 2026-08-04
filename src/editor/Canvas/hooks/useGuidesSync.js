import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { viewportAtom, zoomAtom } from "@/atoms";
import { GUIDES_OFFSET } from "../canvasConstants";

/**
 * 标尺 / 辅助线同步逻辑。
 * 同步 Guides 标尺/辅助线到激活模板画板的屏幕位置（DOM 实测）。
 * 多板下标尺对齐「激活模板」的 board;切换激活/布局变化时由 effect 重新触发。
 * 入参:guides refs + zoom/activeTemplateId/templates/templateColumns + store。
 */
export function useGuidesSync({
  guidesHRef,
  guidesVRef,
  zoom,
  activeTemplateId,
  templates,
  templateColumns,
  store,
}) {
  const [horizontalGuides, setHorizontalGuides] = useState([]);
  const [verticalGuides, setVerticalGuides] = useState([]);

  const initedRef = useRef(false);

  const syncGuides = useCallback(
    (zoomValue) => {
      const guidesH = guidesHRef.current;
      const guidesV = guidesVRef.current;
      if (!guidesH || !guidesV) return;
      const board = document.querySelector(`[data-template-id="${activeTemplateId}"]`);
      if (!board) return;
      const bRect = board.getBoundingClientRect();
      const hRulerEl = guidesH.getRulerElement();
      const vRulerEl = guidesV.getRulerElement();
      if (!hRulerEl || !vRulerEl) return;
      const hRect = hRulerEl.getBoundingClientRect();
      const vRect = vRulerEl.getBoundingClientRect();

      const rulerScrollH = (hRect.left - bRect.left) / zoomValue;
      const rulerScrollV = (vRect.top - bRect.top) / zoomValue;
      guidesH.scroll(rulerScrollH, zoomValue);
      guidesV.scroll(rulerScrollV, zoomValue);

      const guideScrollH = GUIDES_OFFSET + (hRect.top - bRect.top) / zoomValue;
      const guideScrollV = GUIDES_OFFSET + (vRect.left - bRect.left) / zoomValue;
      guidesH.scrollGuides(guideScrollH, zoomValue);
      guidesV.scrollGuides(guideScrollV, zoomValue);
    },
    [guidesHRef, guidesVRef, activeTemplateId],
  );

  // React 驱动的变更（zoom / 激活模板 / 模板尺寸 / 布局）：重绘前同步标尺。
  useLayoutEffect(() => {
    syncGuides(zoom);
  }, [zoom, activeTemplateId, templates, templateColumns, syncGuides]);

  // 平移/滚动驱动：viewportAtom 变化时同步触发标尺同步。
  useEffect(() => {
    const sync = () => syncGuides(store.get(zoomAtom));
    sync();
    return store.sub(viewportAtom, sync);
  }, [store, syncGuides]);

  // 默认进入 + 窗口 resize 时更新 Guides 尺寸
  useEffect(() => {
    const resize = () => {
      guidesHRef.current?.resize();
      guidesVRef.current?.resize();
    };
    if (!initedRef.current) {
      initedRef.current = true;
      requestAnimationFrame(resize);
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [guidesHRef, guidesVRef]);

  const handleChangeGuidesH = useCallback(({ guides }) => setHorizontalGuides(guides), []);
  const handleChangeGuidesV = useCallback(({ guides }) => setVerticalGuides(guides), []);

  return {
    horizontalGuides,
    verticalGuides,
    onChangeGuidesH: handleChangeGuidesH,
    onChangeGuidesV: handleChangeGuidesV,
  };
}
