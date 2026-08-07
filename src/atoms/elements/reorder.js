import { atom } from "jotai";
import { elementsAtom } from "../base";
import { beginChangeAtom } from "../history";
import { DEFAULT_TEMPLATE_ID } from "../templates";
import { reorderContainerChildren, wouldCreateCycle } from "../../core/utils/tree";

export const reorderZAtom = atom(null, (get, set, { id, to }) => {
  const els = get(elementsAtom);
  const target = els.find((e) => e.id === id);
  if (!target) return;
  const parentId = target.parentId ?? null;
  const siblings = els
    .filter((e) => (e.parentId ?? null) === parentId)
    .toSorted((a, b) => (a.z || 0) - (b.z || 0));
  const idx = siblings.findIndex((e) => e.id === id);
  if (idx < 0) return;
  let newIdx = idx;
  if (to === "front") newIdx = siblings.length - 1;
  else if (to === "back") newIdx = 0;
  else if (to === "forward") newIdx = Math.min(siblings.length - 1, idx + 1);
  else if (to === "backward") newIdx = Math.max(0, idx - 1);
  if (newIdx === idx) return;
  set(beginChangeAtom);
  const reordered = [...siblings];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(newIdx, 0, moved);
  const zMap = new Map(reordered.map((e, i) => [e.id, i]));
  set(elementsAtom, (list) =>
    list.map((e) => (zMap.has(e.id) ? { ...e, z: zMap.get(e.id) } : e)),
  );
});

/* ---- 容器内重排 ---- */

export const reorderContainerAtom = atom(null, (get, set, { parentId, activeId, overId, position }) => {
  const els = get(elementsAtom);
  const siblings = els
    .filter((e) => (e.parentId ?? null) === parentId)
    .toSorted((a, b) => (a.z || 0) - (b.z || 0));

  const activeIndex = siblings.findIndex((e) => e.id === activeId);
  const overIndex = siblings.findIndex((e) => e.id === overId);
  if (activeIndex < 0 || overIndex < 0) return;

  let newIndex = overIndex;
  if (position === "right") {
    newIndex = activeIndex < overIndex ? overIndex : overIndex + 1;
  } else if (position === "left") {
    newIndex = activeIndex < overIndex ? overIndex - 1 : overIndex;
  }

  if (newIndex === activeIndex || newIndex < 0 || newIndex >= siblings.length) return;

  set(beginChangeAtom);
  const reordered = [...siblings];
  const [moved] = reordered.splice(activeIndex, 1);
  reordered.splice(newIndex, 0, moved);
  const newOrder = reordered.map((e) => e.id);
  set(elementsAtom, (list) => reorderContainerChildren(list, parentId, newOrder));
});

/* ---- 移动到容器 ---- */

export const moveElementToContainerAtom = atom(null, (get, set, { elementId, targetContainerId }) => {
  const els = get(elementsAtom);
  const element = els.find((e) => e.id === elementId);
  if (!element || element.parentId === targetContainerId) return;

  if (wouldCreateCycle(els, element.id, targetContainerId)) return;

  set(beginChangeAtom);

  const newSiblings = els.filter((e) => (e.parentId ?? null) === targetContainerId);
  const newZ = newSiblings.length ? Math.max(...newSiblings.map((e) => e.z || 0)) + 1 : 0;

  set(elementsAtom, (list) =>
    list.map((e) => (e.id === elementId ? { ...e, parentId: targetContainerId, z: newZ } : e)),
  );
});

/* ---- 拖放落地 ---- */

export const dropElementAtom = atom(null, (get, set, { id, targetParentId, targetTemplateId, insertIndex = null, x, y }) => {
  const els = get(elementsAtom);
  const el = els.find((e) => e.id === id);
  if (!el) return;
  const currentParent = el.parentId ?? null;
  const currentTemplateId = el.templateId ?? DEFAULT_TEMPLATE_ID;
  const newTemplateId = targetTemplateId ?? currentTemplateId;
  if (targetParentId === currentParent && insertIndex === null && newTemplateId === currentTemplateId) return;

  if (targetParentId !== null && wouldCreateCycle(els, id, targetParentId)) return;

  set(beginChangeAtom);

  if (targetParentId === null) {
    const topSiblings = els.filter(
      (e) => !e.parentId && e.id !== id && (e.templateId ?? DEFAULT_TEMPLATE_ID) === newTemplateId,
    );
    const newZ = topSiblings.length ? Math.max(...topSiblings.map((e) => e.z || 0)) + 1 : 0;
    set(elementsAtom, (list) =>
      list.map((e) => (e.id === id ? { ...e, parentId: null, templateId: newTemplateId, z: newZ, x: x ?? 0, y: y ?? 0 } : e)),
    );
    return;
  }

  const container = els.find((e) => e.id === targetParentId);
  const containerTemplateId = container?.templateId ?? DEFAULT_TEMPLATE_ID;
  set(elementsAtom, (list) => {
    const siblingIds = list
      .filter((e) => (e.parentId ?? null) === targetParentId && e.id !== id)
      .toSorted((a, b) => (a.z || 0) - (b.z || 0))
      .map((e) => e.id);
    const idx =
      insertIndex !== null ? Math.max(0, Math.min(siblingIds.length, insertIndex)) : siblingIds.length;
    siblingIds.splice(idx, 0, id);
    const zMap = new Map(siblingIds.map((eid, i) => [eid, i]));
    return list.map((e) => {
      if (e.id === id) return { ...e, parentId: targetParentId, templateId: containerTemplateId, z: zMap.get(e.id) ?? 0, x: 0, y: 0 };
      const z = zMap.get(e.id);
      return z !== undefined ? { ...e, z } : e;
    });
  });
});
