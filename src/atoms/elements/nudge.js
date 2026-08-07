import { atom } from "jotai";
import { elementsAtom } from "../base";
import { selectedIdsAtom } from "../selection";
import { beginChangeAtom } from "../history";
import { templatesAtom, getTemplateSize } from "../templates";

export const nudgeSelectedAtom = atom(null, (get, set, { dx, dy }) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  const idSet = new Set(ids);
  const templates = get(templatesAtom);
  set(beginChangeAtom);
  set(elementsAtom, (list) =>
    list.map((e) => {
      if (!idSet.has(e.id) || e.parentId || e.locked) return e;
      const { width: tplW, height: tplH } = getTemplateSize(templates, e.templateId);
      const isPercent = (e.unit || "px") === "%";
      const gx = isPercent && tplW ? (dx / tplW) * 100 : dx;
      const maxX = isPercent ? 100 - e.width : tplW - e.width;
      const x = Math.max(
        0,
        Math.min(maxX, isPercent ? +((e.x || 0) + gx).toFixed(2) : Math.round((e.x || 0) + gx)),
      );
      const y = Math.max(0, Math.min((tplH || Infinity) - e.height, Math.round((e.y || 0) + dy)));
      return { ...e, x, y };
    }),
  );
});
