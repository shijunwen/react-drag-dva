import { atom } from "jotai";
import { elementsAtom } from "../base";
import { selectedIdsAtom } from "../selection";
import { beginChangeAtom } from "../history";

/* ---- 编组 ---- */

export const groupSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (ids.length < 2) return;
  set(beginChangeAtom);
  const idSet = new Set(ids);
  const gid = `grp_${Date.now().toString(36)}`;
  set(elementsAtom, (els) =>
    els.map((el) => (idSet.has(el.id) ? { ...el, groupId: gid } : el)),
  );
});

/* ---- 解组 ---- */

export const ungroupSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  const els = get(elementsAtom);
  const idSet = new Set(ids);
  const groupIds = new Set(
    els.filter((el) => idSet.has(el.id) && el.groupId).map((el) => el.groupId),
  );
  if (!groupIds.size) return;
  set(beginChangeAtom);
  set(elementsAtom, (list) =>
    list.map((el) => (el.groupId && groupIds.has(el.groupId) ? { ...el, groupId: null } : el)),
  );
});
