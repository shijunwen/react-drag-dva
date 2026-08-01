import { atom } from "jotai";
import { elementsAtom } from "./base";
import { expandGroupSelection } from "@/editor/utils";

/** 当前选中的元素 id 列表（支持多选 / 分组） */
export const selectedIdsAtom = atom([]);

/** 派生：当前选中的元素对象列表 */
export const selectedElementsAtom = atom((get) => {
  const els = get(elementsAtom);
  const ids = get(selectedIdsAtom);
  const idSet = new Set(ids);
  return els.filter((el) => idSet.has(el.id));
});

/** 设置选中（已自动展开到同组元素） */
export const selectAtom = atom(null, (get, set, ids) => {
  const els = get(elementsAtom);
  set(selectedIdsAtom, expandGroupSelection(els, ids));
});

/** 切换选中（Shift 多选，自动展开同组） */
export const toggleSelectAtom = atom(null, (get, set, id) => {
  const els = get(elementsAtom);
  const cur = get(selectedIdsAtom);
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  set(selectedIdsAtom, expandGroupSelection(els, next));
});

export const clearSelectionAtom = atom(null, (get, set) => set(selectedIdsAtom, []));

/**
 * moveable 拖拽过程中当前悬停的容器 id（用于高亮放置目标），null 表示无。
 * 仅在画布上已有元素的拖拽期间由 MoveableLayer 写入；palette 拖拽(dnd-kit)
 * 的高亮走 useDroppable 的 isOver，与此独立。
 */
export const dragOverContainerIdAtom = atom(null);
