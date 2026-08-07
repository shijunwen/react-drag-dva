import { useSetAtom } from "jotai";
import { selectAtom, toggleSelectAtom, clearSelectionAtom } from "../atoms/selection";

/**
 * 选区操作 actions — 仅供需要选择操作而不关心元素状态的场景。
 */
export function useSelectionActions() {
  return {
    select: useSetAtom(selectAtom),
    toggleSelect: useSetAtom(toggleSelectAtom),
    clearSelection: useSetAtom(clearSelectionAtom),
  };
}
