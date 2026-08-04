import { useCallback } from "react";
import { flushSync } from "react-dom";

/**
 * 捕获阶段处理选中:先于 moveable 的 gesto 决定选中状态,并激活所属模板。
 * 未选中元素:flushSync 同步选中 -> moveable 重新绑定 gesto -> 同一次 pointerdown
 * 继续传播到元素时被 gesto 接管,自然起手拖拽(含正确的释放)。
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
  clearSelection,
}) {
  return useCallback(
    (e, templateId) => {
      if (templateId) setActiveTemplate(templateId);
      if (moveableRef.current?.isMoveableElement(e.target)) return;
      if (e.target.closest("[data-zoom-bar]")) return;
      if (e.target.closest(".ruler-area")) return;
      if (e.target.closest("[data-no-drag]")) return;

      const elNode = e.target.closest("[data-id]");
      if (!elNode) {
        clearSelection();
        return;
      }
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
    [setActiveTemplate, clearSelection, toggleSelect, select, selectedSet, elements, moveableRef],
  );
}
