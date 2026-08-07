import { atom } from "jotai";
import { elementsAtom } from "../base";
import { selectedIdsAtom } from "../selection";
import { beginChangeAtom } from "../history";
import { genId } from "../../core/utils/id";
import { cloneProps } from "../../core/utils/model";

/** 剪贴板：存放复制的元素快照（随 Jotai store 隔离，每实例独立） */
export const clipboardAtom = atom([]);

/** 克隆偏移量（px） */
const DUPE_OFFSET = 20;

/**
 * 克隆一组元素：新 id、偏移位置、保持同组关系（新 groupId）、
 * 同级置于顶部（z = 当前最大 + 1）。
 */
const cloneElements = (elements, allElements) => {
  const groupIdMap = new Map();
  const maxZ = new Map();
  for (const e of allElements) {
    const pid = e.parentId ?? null;
    maxZ.set(pid, Math.max(maxZ.get(pid) ?? -1, e.z || 0));
  }
  return elements.map((e) => {
    let ng = e.groupId;
    if (e.groupId) {
      if (!groupIdMap.has(e.groupId)) groupIdMap.set(e.groupId, genId("grp"));
      ng = groupIdMap.get(e.groupId);
    }
    const pid = e.parentId ?? null;
    const z = (maxZ.get(pid) ?? -1) + 1;
    maxZ.set(pid, z);
    return {
      ...e,
      id: genId(),
      x: (e.x || 0) + DUPE_OFFSET,
      y: (e.y || 0) + DUPE_OFFSET,
      z,
      groupId: ng,
      props: cloneProps(e.props),
    };
  });
};

/* ---- 复制 ---- */

export const copySelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  const idSet = new Set(ids);
  set(clipboardAtom, get(elementsAtom).filter((e) => idSet.has(e.id)));
});

/* ---- 粘贴 ---- */

export const pasteAtom = atom(null, (get, set) => {
  const clip = get(clipboardAtom);
  if (!clip.length) return;
  set(beginChangeAtom);
  const newEls = cloneElements(clip, get(elementsAtom));
  set(elementsAtom, (list) => [...list, ...newEls]);
  set(selectedIdsAtom, newEls.map((e) => e.id));
});

/* ---- 原地克隆 ---- */

export const duplicateSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  const idSet = new Set(ids);
  const all = get(elementsAtom);
  set(beginChangeAtom);
  const newEls = cloneElements(all.filter((e) => idSet.has(e.id)), all);
  set(elementsAtom, (list) => [...list, ...newEls]);
  set(selectedIdsAtom, newEls.map((e) => e.id));
});
