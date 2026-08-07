import { useSetAtom } from "jotai";
import { addElementAtom } from "../atoms/elements/crud";
import { updateElementAtom } from "../atoms/elements/crud";
import { updateElementsAtom } from "../atoms/elements/crud";
import { setElementsAtom } from "../atoms/elements/crud";
import { deleteSelectedAtom } from "../atoms/elements/crud";
import { deleteElementsAtom } from "../atoms/elements/crud";
import { clearCanvasAtom } from "../atoms/elements/crud";
import { toggleElementLockAtom } from "../atoms/elements/properties";
import { renameElementAtom } from "../atoms/elements/properties";
import { setElementUnitAtom } from "../atoms/elements/properties";
import { groupSelectedAtom } from "../atoms/elements/group";
import { ungroupSelectedAtom } from "../atoms/elements/group";
import { alignSelectedAtom } from "../atoms/elements/align";
import { nudgeSelectedAtom } from "../atoms/elements/nudge";
import { copySelectedAtom } from "../atoms/elements/clipboard";
import { pasteAtom } from "../atoms/elements/clipboard";
import { duplicateSelectedAtom } from "../atoms/elements/clipboard";
import { reorderZAtom } from "../atoms/elements/reorder";

/**
 * 元素操作 actions — 不含只读状态，不触发不必要的重渲染。
 * 适合快捷键等纯 action 调用场景。
 */
export function useElementActions() {
  return {
    addElement: useSetAtom(addElementAtom),
    updateElement: useSetAtom(updateElementAtom),
    updateElements: useSetAtom(updateElementsAtom),
    setElements: useSetAtom(setElementsAtom),
    deleteSelected: useSetAtom(deleteSelectedAtom),
    deleteElements: useSetAtom(deleteElementsAtom),
    clearCanvas: useSetAtom(clearCanvasAtom),
    toggleElementLock: useSetAtom(toggleElementLockAtom),
    renameElement: useSetAtom(renameElementAtom),
    setElementUnit: useSetAtom(setElementUnitAtom),
    groupSelected: useSetAtom(groupSelectedAtom),
    ungroupSelected: useSetAtom(ungroupSelectedAtom),
    alignSelected: useSetAtom(alignSelectedAtom),
    nudgeSelected: useSetAtom(nudgeSelectedAtom),
    copySelected: useSetAtom(copySelectedAtom),
    paste: useSetAtom(pasteAtom),
    duplicateSelected: useSetAtom(duplicateSelectedAtom),
    reorderZ: useSetAtom(reorderZAtom),
  };
}
