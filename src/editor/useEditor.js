import { atom, useAtomValue, useSetAtom } from "jotai";
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
  copySelectedAtom,
  duplicateSelectedAtom,
  pasteClipboardAtom,
  toggleLockAtom,
  toggleHiddenAtom,
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

// 派生为布尔值:撤销栈变化但布尔值未翻转时,jotai 不通知订阅者,
// 避免所有 useEditor 消费者随每次 beginChange(每手势一次)无谓重渲染。
const canUndoAtom = atom((get) => get(pastAtom).length > 0);
const canRedoAtom = atom((get) => get(futureAtom).length > 0);

/**
 * 编辑器统一 action 入口。
 * 用 useSetAtom 绑定 write atom，内部通过 get 读取最新状态，避免手势回调闭包陈旧。
 */
export function useEditor() {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const selectedElements = useAtomValue(selectedElementsAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);

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
    copySelected: useSetAtom(copySelectedAtom),
    duplicateSelected: useSetAtom(duplicateSelectedAtom),
    pasteClipboard: useSetAtom(pasteClipboardAtom),
    toggleLock: useSetAtom(toggleLockAtom),
    toggleHidden: useSetAtom(toggleHiddenAtom),
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
