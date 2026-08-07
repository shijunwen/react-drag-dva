/**
 * @deprecated 请直接从 atoms/elements/<submodule> 导入。
 * 保留此文件仅用于渐进迁移。
 */
export {
  addElementAtom,
  updateElementAtom,
  updateElementsAtom,
  setElementsAtom,
  deleteSelectedAtom,
  deleteElementsAtom,
  clearCanvasAtom,
  getNextZ,
} from "./elements/crud";

export {
  toggleElementLockAtom,
  renameElementAtom,
  setElementUnitAtom,
} from "./elements/properties";

export {
  groupSelectedAtom,
  ungroupSelectedAtom,
} from "./elements/group";

export { alignSelectedAtom } from "./elements/align";

export { nudgeSelectedAtom } from "./elements/nudge";

export {
  clipboardAtom,
  copySelectedAtom,
  pasteAtom,
  duplicateSelectedAtom,
} from "./elements/clipboard";

export {
  reorderZAtom,
  reorderContainerAtom,
  moveElementToContainerAtom,
  dropElementAtom,
} from "./elements/reorder";
