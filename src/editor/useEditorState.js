import { atom, useAtomValue } from "jotai";
import { elementsAtom } from "../atoms/base";
import { selectedIdsAtom, selectedElementsAtom } from "../atoms/selection";
import { pastAtom, futureAtom } from "../atoms/history";
import { templatesAtom, activeTemplateIdAtom, templateColumnsAtom } from "../atoms/templates";

const canUndoAtom = atom((get) => get(pastAtom).length > 0);
const canRedoAtom = atom((get) => get(futureAtom).length > 0);

/**
 * 只读编辑器状态 — 按需订阅，不触发不需要的 action 绑定。
 */
export function useEditorState() {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const selectedElements = useAtomValue(selectedElementsAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const templates = useAtomValue(templatesAtom);
  const activeTemplateId = useAtomValue(activeTemplateIdAtom);
  const templateColumns = useAtomValue(templateColumnsAtom);

  return {
    elements,
    selectedIds,
    selectedElements,
    canUndo,
    canRedo,
    templates,
    activeTemplateId,
    templateColumns,
  };
}
