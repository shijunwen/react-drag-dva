import { atom } from "jotai";
import { elementsAtom } from "../base";
import { selectedIdsAtom } from "../selection";
import { beginChangeAtom } from "../history";
import { getBounds } from "../../core/utils/geometry";

const ALIGN_HANDLERS = {
  left: (b) => ({ x: b.minX }),
  right: (b) => ({ x: b.maxX }),
  centerH: (b) => ({ x: Math.round((b.minX + b.maxX) / 2) }),
  top: (b) => ({ y: b.minY }),
  bottom: (b) => ({ y: b.maxY }),
  centerV: (b) => ({ y: Math.round((b.minY + b.maxY) / 2) }),
};

export const alignSelectedAtom = atom(null, (get, set, dir) => {
  const ids = get(selectedIdsAtom);
  const els = get(elementsAtom);
  const idSet = new Set(ids);
  const targets = els.filter((el) => idSet.has(el.id));
  if (targets.length < 2) return;
  const bounds = getBounds(targets);
  const handler = ALIGN_HANDLERS[dir];
  if (!handler) return;
  set(beginChangeAtom);
  const patch = handler(bounds);
  const key = "x" in patch ? "x" : "y";
  set(elementsAtom, (list) =>
    list.map((el) => (idSet.has(el.id) ? { ...el, [key]: patch[key] } : el)),
  );
});
