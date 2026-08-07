import { useSetAtom } from "jotai";
import {
  addTemplateAtom,
  duplicateTemplateAtom,
  deleteTemplateAtom,
  renameTemplateAtom,
  setTemplateSizeAtom,
  setActiveTemplateAtom,
  setTemplateColumnsAtom,
} from "../atoms/templates";

/**
 * 模板操作 actions。
 */
export function useTemplateActions() {
  return {
    addTemplate: useSetAtom(addTemplateAtom),
    duplicateTemplate: useSetAtom(duplicateTemplateAtom),
    deleteTemplate: useSetAtom(deleteTemplateAtom),
    renameTemplate: useSetAtom(renameTemplateAtom),
    setTemplateSize: useSetAtom(setTemplateSizeAtom),
    setActiveTemplate: useSetAtom(setActiveTemplateAtom),
    setTemplateColumns: useSetAtom(setTemplateColumnsAtom),
  };
}
