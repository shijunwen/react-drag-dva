import { atom } from "jotai";
import { elementsAtom } from "../base";
import { beginChangeAtom } from "../history";
import { templatesAtom, getTemplateSize } from "../templates";
import { patchElement } from "../../core/utils/model";
import { UNIT } from "../../core/constants";

/* ---- 锁定 ---- */

export const toggleElementLockAtom = atom(null, (get, set, { id }) => {
  const el = get(elementsAtom).find((e) => e.id === id);
  if (!el) return;
  set(beginChangeAtom);
  set(elementsAtom, (list) => patchElement(list, id, { locked: !el.locked }));
});

/* ---- 重命名 ---- */

export const renameElementAtom = atom(null, (get, set, { id, name }) => {
  const el = get(elementsAtom).find((e) => e.id === id);
  if (!el) return;
  const next = (name ?? "").trim() || null;
  if (el.name === next) return;
  set(beginChangeAtom);
  set(elementsAtom, (list) => patchElement(list, id, { name: next }));
});

/* ---- 单位切换 ---- */

export const setElementUnitAtom = atom(null, (get, set, { id, unit }) => {
  const el = get(elementsAtom).find((e) => e.id === id);
  if (!el || el.unit === unit) return;
  const { width: tplW } = getTemplateSize(get(templatesAtom), el.templateId);
  const patch = { unit };
  if (unit === UNIT.PERCENT) {
    patch.x = tplW ? +((el.x / tplW) * 100).toFixed(2) : el.x;
    patch.width = tplW ? +((el.width / tplW) * 100).toFixed(2) : el.width;
  } else {
    patch.x = Math.round((el.x / 100) * tplW);
    patch.width = Math.round((el.width / 100) * tplW);
  }
  set(beginChangeAtom);
  set(elementsAtom, (list) => patchElement(list, id, patch));
});
