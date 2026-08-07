import { atom } from "jotai";
import { elementsAtom } from "../base";
import { selectedIdsAtom } from "../selection";
import { beginChangeAtom, pastAtom, futureAtom } from "../history";
import { activeTemplateIdAtom, DEFAULT_TEMPLATE_ID } from "../templates";
import { patchElement, patchElements } from "../../core/utils/model";
import { buildChildrenMap } from "../../core/utils/tree";
// createElement 依赖元素注册表(PALETTE_ITEM_MAP)，保留在 editor 层
import { createElement } from "../../editor/utils";

/** 获取指定 parentId 下级元素的下一个可用 z 值 */
export const getNextZ = (elements, parentId) => {
  const siblings = elements.filter((e) => (e.parentId ?? null) === parentId);
  return siblings.length ? Math.max(...siblings.map((e) => e.z || 0)) + 1 : 0;
};

/* ---- 新增 ---- */

export const addElementAtom = atom(null, (get, set, { type, x, y, parentId = null, templateId } = {}) => {
  set(beginChangeAtom);
  const el = createElement(type, x ?? 0, y ?? 0);
  el.parentId = parentId;
  if (parentId) {
    const parent = get(elementsAtom).find((e) => e.id === parentId);
    el.templateId = parent?.templateId ?? get(activeTemplateIdAtom) ?? DEFAULT_TEMPLATE_ID;
  } else {
    el.templateId = templateId ?? get(activeTemplateIdAtom) ?? DEFAULT_TEMPLATE_ID;
  }
  el.z = getNextZ(get(elementsAtom), parentId);
  set(elementsAtom, (els) => [...els, el]);
  set(selectedIdsAtom, [el.id]);
});

/* ---- 更新 ---- */

export const updateElementAtom = atom(null, (get, set, { id, patch }) => {
  set(elementsAtom, (els) => patchElement(els, id, patch));
});

export const updateElementsAtom = atom(null, (get, set, patches) => {
  set(elementsAtom, (els) => patchElements(els, patches));
});

/* ---- 全量替换 ---- */

export const setElementsAtom = atom(null, (get, set, elements) => {
  set(elementsAtom, elements);
  set(pastAtom, []);
  set(futureAtom, []);
});

/* ---- 删除 ---- */

export const deleteElementsAtom = atom(null, (get, set, ids) => {
  if (!ids?.length) return;
  set(beginChangeAtom);
  const els = get(elementsAtom);
  const childrenMap = buildChildrenMap(els);
  const toDelete = new Set(ids);
  const stack = [...ids];
  while (stack.length) {
    const children = childrenMap.get(stack.pop());
    if (!children) continue;
    for (const c of children) {
      if (!toDelete.has(c.id)) {
        toDelete.add(c.id);
        stack.push(c.id);
      }
    }
  }
  set(elementsAtom, (list) => list.filter((el) => !toDelete.has(el.id)));
  const sel = get(selectedIdsAtom);
  if (sel.length) {
    const nextSel = sel.filter((sid) => !toDelete.has(sid));
    if (nextSel.length !== sel.length) set(selectedIdsAtom, nextSel);
  }
});

export const deleteSelectedAtom = atom(null, (get, set) => {
  set(deleteElementsAtom, get(selectedIdsAtom));
});

/* ---- 清空画布 ---- */

export const clearCanvasAtom = atom(null, (get, set) => {
  if (!get(elementsAtom).length) return;
  set(beginChangeAtom);
  set(elementsAtom, []);
  set(selectedIdsAtom, []);
});
