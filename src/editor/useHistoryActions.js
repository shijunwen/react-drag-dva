import { useSetAtom } from "jotai";
import { undoAtom, redoAtom, beginChangeAtom } from "../atoms/history";

/**
 * 撤销/重做 actions。
 */
export function useHistoryActions() {
  return {
    undo: useSetAtom(undoAtom),
    redo: useSetAtom(redoAtom),
    beginChange: useSetAtom(beginChangeAtom),
  };
}
