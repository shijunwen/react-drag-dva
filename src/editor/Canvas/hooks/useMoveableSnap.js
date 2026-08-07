import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { DEFAULT_TEMPLATE_ID } from "../../../atoms/templates";
import { SNAP_THRESHOLD } from "../../../core/constants";
import { FALLBACK_SIZE } from "../moveableHelpers";

/**
 * 吸附 / 参考线逻辑(从 useMoveableGestures 抽出):
 * - elementGuidelines:同模板同父级元素 + (顶层)当前画板边缘/中心线吸附
 * - rulerGuideElements:标尺辅助线吸附标记(Board 渲染的 0 尺寸 div,commit 后查 DOM)
 * - 网格吸附尺寸 / snappable / 吸附阈值(SNAP_THRESHOLD 由 core/constants 提供)
 * - templateSizeMap + sizeFor:按元素所属模板尺寸换算单位
 */
export function useMoveableSnap({
  templates,
  elements,
  selectedIds,
  elementRefs,
  parentId,
  firstTemplateId,
  isInContainer,
  horizontalGuides,
  verticalGuides,
  gridSnapEnabled,
  gridSnapSize,
}) {
  // templateId -> {width,height} 的 O(1) 索引,供拖拽/缩放按元素所属模板尺寸 clamp/换算
  const templateSizeMap = useMemo(() => {
    const m = new Map();
    for (const t of templates) m.set(t.id, { width: t.width, height: t.height });
    return m;
  }, [templates]);

  const sizeFor = useCallback(
    (el) => templateSizeMap.get(el?.templateId ?? DEFAULT_TEMPLATE_ID) ?? FALLBACK_SIZE,
    [templateSizeMap],
  );

  // 吸附参考线:用 elementGuidelines 传入其他元素的 DOM 节点,
  // moveable 自动读 getBoundingClientRect 算 snap。限定同模板同父级,避免跨板吸附。
  // 顶层元素额外加入「当前画板」元素:moveable 据其 rect 显示画板边缘+中心吸附线
  // (checkBetweenRects 只判范围重叠,目标在画板内 -> 不过滤)。画板恒在 DOM,render 期可取。
  const idSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const elementGuidelines = useMemo(
    () => {
      const siblings = elements
        .filter(
          (el) =>
            (el.parentId ?? null) === parentId &&
            (el.templateId ?? DEFAULT_TEMPLATE_ID) === firstTemplateId &&
            !idSet.has(el.id),
        )
        .map((el) => elementRefs.current.get(el.id))
        .filter(Boolean);
      if (isInContainer) return siblings;
      const board = document.querySelector(`[data-template-id="${firstTemplateId}"]`);
      // 画板开启 center(垂直中线) 和 middle(水平中线),拖拽时可吸附到画板中心并显示距离。
      return board ? [...siblings, { element: board, center: true, middle: true }] : siblings;
    },
    [elements, parentId, firstTemplateId, idSet, elementRefs, isInContainer],
  );

  // 标尺辅助线吸附标记(Board 在激活画板内按 guides 渲染的 0 尺寸不可见 div)。
  // 用 useLayoutEffect(提交后查 DOM):guide 变化当帧 render 期标记尚未提交,需 commit 后重查。
  // 浅比较避免无变化重渲染。{horizontal:true,vertical:false} 限定只产水平线(标记 0 高 -> Y=g);
  // center:false 免冗余。垂直同理。
  const [rulerGuideElements, setRulerGuideElements] = useState([]);
  useLayoutEffect(() => {
    let next = [];
    if (!isInContainer) {
      const board = document.querySelector(`[data-template-id="${firstTemplateId}"]`);
      if (board) {
        next = [
          ...Array.from(
            board.querySelectorAll('[data-snap-guide="h"]'),
            (el) => ({ element: el, top: true, bottom: true, left: false, right: false, center: false, middle: false }),
          ),
          ...Array.from(
            board.querySelectorAll('[data-snap-guide="v"]'),
            (el) => ({ element: el, left: true, right: true, top: false, bottom: false, center: false, middle: false }),
          ),
        ];
      }
    }
    // commit 后测 DOM 标记再同步 state:必要的 post-commit ref 测量(CLAUDE.md set-state-in-effect 例外)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRulerGuideElements((prev) =>
      prev.length === next.length && prev.every((p, i) => p.element === next[i].element)
        ? prev
        : next,
    );
  }, [isInContainer, firstTemplateId, horizontalGuides, verticalGuides]);

  const snapGridWidth = gridSnapEnabled ? gridSnapSize : 0;
  const snapGridHeight = gridSnapEnabled ? gridSnapSize : 0;
  const snappable = !isInContainer;

  return {
    elementGuidelines,
    rulerGuideElements,
    snapGridWidth,
    snapGridHeight,
    snappable,
    snapThreshold: SNAP_THRESHOLD,
    templateSizeMap,
    sizeFor,
  };
}
