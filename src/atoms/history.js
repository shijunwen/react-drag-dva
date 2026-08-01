import { atom } from "jotai";
import { elementsAtom } from "./base";

const HISTORY_LIMIT = 50;

/** 撤销 / 重做栈（保存元素快照） */
export const pastAtom = atom([]);
export const futureAtom = atom([]);

/** 在一次离散变更前快照当前状态（一次手势 = 一条撤销记录） */
export const beginChangeAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  set(pastAtom, [...past, get(elementsAtom)].slice(-HISTORY_LIMIT));
  set(futureAtom, []);
});

export const undoAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  if (!past.length) return;
  const previous = past[past.length - 1];
  set(pastAtom, past.slice(0, -1));
  set(futureAtom, [get(elementsAtom), ...get(futureAtom)].slice(0, HISTORY_LIMIT));
  set(elementsAtom, previous);
});

export const redoAtom = atom(null, (get, set) => {
  const future = get(futureAtom);
  if (!future.length) return;
  const next = future[0];
  set(futureAtom, future.slice(1));
  set(pastAtom, [...get(pastAtom), get(elementsAtom)].slice(-HISTORY_LIMIT));
  set(elementsAtom, next);
});
