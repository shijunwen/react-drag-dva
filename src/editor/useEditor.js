import { useAtomValue, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  selectedElementsAtom,
  pastAtom,
  futureAtom,
  addElementAtom,
  updateElementAtom,
  updateElementsAtom,
  setElementUnitAtom,
  deleteSelectedAtom,
  selectAtom,
  toggleSelectAtom,
  clearSelectionAtom,
  groupSelectedAtom,
  ungroupSelectedAtom,
  alignSelectedAtom,
  undoAtom,
  redoAtom,
  clearCanvasAtom,
  beginChangeAtom,
  reorderZAtom,
} from "@/atoms";

/**
 * 编辑器统一 action 入口。
 * 用 useSetAtom 绑定 write atom，内部通过 get 读取最新状态，避免手势回调闭包陈旧。
 */
export function useEditor() {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const selectedElements = useAtomValue(selectedElementsAtom);
  const canUndo = useAtomValue(pastAtom).length > 0;
  const canRedo = useAtomValue(futureAtom).length > 0;

  return {
    elements,
    selectedIds,
    selectedElements,
    canUndo,
    canRedo,
    addElement: useSetAtom(addElementAtom),
    updateElement: useSetAtom(updateElementAtom),
    updateElements: useSetAtom(updateElementsAtom),
    setElementUnit: useSetAtom(setElementUnitAtom),
    beginChange: useSetAtom(beginChangeAtom),
    deleteSelected: useSetAtom(deleteSelectedAtom),
    select: useSetAtom(selectAtom),
    toggleSelect: useSetAtom(toggleSelectAtom),
    clearSelection: useSetAtom(clearSelectionAtom),
    groupSelected: useSetAtom(groupSelectedAtom),
    ungroupSelected: useSetAtom(ungroupSelectedAtom),
    alignSelected: useSetAtom(alignSelectedAtom),
    undo: useSetAtom(undoAtom),
    redo: useSetAtom(redoAtom),
    clearCanvas: useSetAtom(clearCanvasAtom),
    reorderZ: useSetAtom(reorderZAtom),
  };
}
