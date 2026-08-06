import { useCallback } from "react";
import { flushSync } from "react-dom";

/**
 * 捕获阶段处理选中:先于 moveable 的 gesto 决定选中状态,并激活所属模板。
 * 未选中元素:flushSync 同步选中 -> moveable 重新绑定 gesto -> 同一次 pointerdown
 * 继续传播到元素时被 gesto 接管,自然起手拖拽(含正确的释放)。
 *
 * 空白画布不在此处理:框选 / 单击清空交由 MarqueeSelect(react-selecto)接管。
 * 这里若提前 clearSelection 会抹掉 Shift 累加框选的既有选中,故仅激活模板后返回。
 *
 * 入参:elements / selectedSet / moveableRef + 选中/激活 action。
 */
export function useSelectionCapture({
  elements,
  selectedSet,
  moveableRef,
  setActiveTemplate,
  select,
  toggleSelect,
}) {
  return useCallback(
    (e, templateId) => {
      if (templateId) setActiveTemplate(templateId);
      if (moveableRef.current?.isMoveableElement(e.target)) return;
      if (e.target.closest("[data-zoom-bar]")) return;
      if (e.target.closest(".ruler-area")) return;
      if (e.target.closest("[data-no-drag]")) return;

      const elNode = e.target.closest("[data-id]");
      // 空白画布:交给 MarqueeSelect(react-selecto)处理框选/单击清空
      if (!elNode) return;
      const id = elNode.dataset.id;
      const element = elements.find((el) => el.id === id);
      if (element && element.parentId) {
        if (e.shiftKey) {
          toggleSelect(id);
          e.stopPropagation();
          return;
        }
        if (!selectedSet.has(id) || !moveableRef.current) {
          flushSync(() => select([id]));
        }
        return;
      }
      if (e.shiftKey) {
        toggleSelect(id);
        e.stopPropagation();
        return;
      }
      if (!selectedSet.has(id) || !moveableRef.current) {
        flushSync(() => select([id]));
      }
    },
    [setActiveTemplate, toggleSelect, select, selectedSet, elements, moveableRef],
  );
}
