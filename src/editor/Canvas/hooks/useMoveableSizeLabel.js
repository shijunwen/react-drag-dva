import { useCallback, useEffect } from "react";
import { applySizeLabel, formatSizeLabel } from "../moveableHelpers";

/**
 * 尺寸标签管理(从 useMoveableGestures 抽出):
 * - hideLabel / updateSelectionLabel:隐藏 / 定位到选中框(各选中元素外包矩形并集)上方
 * - 选中 / 缩放 / 滚动 / 框选态变化时刷新标签的 effect(手势进行中由各 handler 实时刷新)
 * 直接写 DOM 的部分收口在 applySizeLabel 内,避免触发 react-hooks/immutability。
 */
export function useMoveableSizeLabel({
  sizeLabelRef,
  canvasWrapRef,
  targets,
  selectedIds,
  elementsById,
  zoom,
  marqueeActive,
  elements,
  scrollLeft,
  scrollTop,
}) {
  const hideLabel = useCallback(() => {
    applySizeLabel(sizeLabelRef.current, null, null, "", false);
  }, [sizeLabelRef]);

  const updateSelectionLabel = useCallback(
    (textOverride) => {
      const label = sizeLabelRef?.current;
      const wrap = canvasWrapRef?.current;
      if (!label || !wrap) return;
      let rect = null;
      for (const t of targets) {
        const r = t.getBoundingClientRect();
        if (!rect) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        else {
          rect.left = Math.min(rect.left, r.left);
          rect.top = Math.min(rect.top, r.top);
          rect.right = Math.max(rect.right, r.right);
          rect.bottom = Math.max(rect.bottom, r.bottom);
        }
      }
      let screenRect = null;
      let text = "";
      if (rect) {
        screenRect = {
          left: rect.left,
          top: rect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
        };
        if (textOverride) {
          text = textOverride;
        } else if (targets.length === 1) {
          const el = elementsById.get(selectedIds[0]);
          text = el ? formatSizeLabel(el.width, el.height, el.unit || "px") : "";
        } else {
          text = `${Math.round(screenRect.width / zoom)}px × ${Math.round(screenRect.height / zoom)}px`;
        }
      }
      applySizeLabel(label, wrap, screenRect, text, !!screenRect);
    },
    [targets, selectedIds, elementsById, zoom, sizeLabelRef, canvasWrapRef],
  );

  // 选中 / 缩放 / 滚动 / 框选态变化时刷新尺寸标签(手势进行中由各 handler 实时刷新)
  useEffect(() => {
    if (marqueeActive || !targets.length) {
      hideLabel();
      return;
    }
    updateSelectionLabel();
  }, [targets, marqueeActive, zoom, elements, scrollLeft, scrollTop, hideLabel, updateSelectionLabel]);

  return { hideLabel, updateSelectionLabel };
}
