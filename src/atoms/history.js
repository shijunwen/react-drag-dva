import { atom } from "jotai";
import { elementsAtom } from "./base";
import { templatesAtom, activeTemplateIdAtom } from "./templates";

const HISTORY_LIMIT = 50;

/** 撤销 / 重做栈（保存 {elements, templates} 快照,一体撤销） */
export const pastAtom = atom([]);
export const futureAtom = atom([]);

/** 在一次离散变更前快照当前状态（一次手势 = 一条撤销记录） */
export const beginChangeAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  const snapshot = { elements: get(elementsAtom), templates: get(templatesAtom) };
  set(pastAtom, [...past, snapshot].slice(-HISTORY_LIMIT));
  set(futureAtom, []);
});

/** 撤销后 active 可能指向已不存在的模板,兜底重置到首个 */
const fixActiveAfterRestore = (get, set) => {
  const tpls = get(templatesAtom);
  const activeId = get(activeTemplateIdAtom);
  if (tpls.length && !tpls.some((t) => t.id === activeId)) {
    set(activeTemplateIdAtom, tpls[0].id);
  }
};

export const undoAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  if (!past.length) return;
  const previous = past[past.length - 1];
  set(pastAtom, past.slice(0, -1));
  set(
    futureAtom,
    [{ elements: get(elementsAtom), templates: get(templatesAtom) }, ...get(futureAtom)].slice(
      0,
      HISTORY_LIMIT
    )
  );
  set(elementsAtom, previous.elements);
  set(templatesAtom, previous.templates);
  fixActiveAfterRestore(get, set);
});

export const redoAtom = atom(null, (get, set) => {
  const future = get(futureAtom);
  if (!future.length) return;
  const next = future[0];
  set(futureAtom, future.slice(1));
  set(
    pastAtom,
    [...get(pastAtom), { elements: get(elementsAtom), templates: get(templatesAtom) }].slice(
      -HISTORY_LIMIT
    )
  );
  set(elementsAtom, next.elements);
  set(templatesAtom, next.templates);
  fixActiveAfterRestore(get, set);
});
