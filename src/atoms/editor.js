import { atom } from "jotai";
import { createElement, patchElement, patchElements, expandGroupSelection, getBounds, reorderContainerChildren } from "@/editor/utils";
import { UNIT } from "@/editor/constants";

const HISTORY_LIMIT = 50;

/** 画布内全部元素 */
export const elementsAtom = atom([]);

/** 当前选中的元素 id 列表（支持多选 / 分组） */
export const selectedIdsAtom = atom([]);

/** 撤销 / 重做栈（保存元素快照） */
export const pastAtom = atom([]);
export const futureAtom = atom([]);

/** 画布视口状态（缩放 + 平移 + 画布尺寸），由 InfiniteViewer 驱动 */
export const viewportAtom = atom({
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
  canvasWidth: 1200,
  canvasHeight: 720,
});
export const setViewportAtom = atom(null, (get, set, patch) => {
  set(viewportAtom, { ...get(viewportAtom), ...patch });
});
export const setZoomAtom = atom(null, (get, set, zoom) => {
  set(viewportAtom, { ...get(viewportAtom), zoom });
});
export const setCanvasSizeAtom = atom(null, (get, set, { width, height }) => {
  set(viewportAtom, { ...get(viewportAtom), canvasWidth: width, canvasHeight: height });
});

/** 预览模式开关 */
export const previewModeAtom = atom(false);
export const setPreviewModeAtom = atom(null, (get, set, value) => {
  set(previewModeAtom, value);
});

/** 派生：当前选中的元素对象列表 */
export const selectedElementsAtom = atom((get) => {
  const els = get(elementsAtom);
  const ids = get(selectedIdsAtom);
  const idSet = new Set(ids);
  return els.filter((el) => idSet.has(el.id));
});

/** 在一次离散变更前快照当前状态（一次手势 = 一条撤销记录） */
export const beginChangeAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  set(pastAtom, [...past, get(elementsAtom)].slice(-HISTORY_LIMIT));
  set(futureAtom, []);
});

/* ----------------------------- 元素增删改 ----------------------------- */

/** 新增元素并选中（parentId 为空=画布顶层；否则为容器内子元素） */
export const addElementAtom = atom(null, (get, set, { type, x, y, parentId = null }) => {
  set(beginChangeAtom);
  // 容器内元素不需要 x/y，给默认值 0
  const el = createElement(type, x ?? 0, y ?? 0);
  el.parentId = parentId;
  const siblings = get(elementsAtom).filter((e) => (e.parentId ?? null) === parentId);
  // z 作为容器内排序索引使用
  el.z = siblings.length ? Math.max(...siblings.map((e) => e.z || 0)) + 1 : 0;
  set(elementsAtom, (els) => [...els, el]);
  set(selectedIdsAtom, [el.id]);
});

/** 实时更新单个元素（手势进行中，不记历史） */
export const updateElementAtom = atom(null, (get, set, { id, patch }) => {
  set(elementsAtom, (els) => patchElement(els, id, patch));
});

/** 实时批量更新（分组拖拽/缩放进行中，不记历史） */
export const updateElementsAtom = atom(null, (get, set, patches) => {
  set(elementsAtom, (els) => patchElements(els, patches));
});

/**
 * 切换单位（px <-> %）：同时把 x/width 在两种单位间换算。
 * y/height 始终为 px，不受单位影响。
 * - px -> %：x/width 除以画布宽度换算为百分比（保留 2 位小数）
 * - % -> px：x/width 乘以画布宽度换算回像素（取整）
 * 这是一次离散变更，记入撤销栈。
 */
export const setElementUnitAtom = atom(null, (get, set, { id, unit }) => {
  const el = get(elementsAtom).find((e) => e.id === id);
  if (!el || el.unit === unit) return;
  const { canvasWidth } = get(viewportAtom);
  const patch = { unit };
  if (unit === UNIT.PERCENT) {
    patch.x = canvasWidth ? +((el.x / canvasWidth) * 100).toFixed(2) : el.x;
    patch.width = canvasWidth ? +((el.width / canvasWidth) * 100).toFixed(2) : el.width;
  } else {
    patch.x = Math.round((el.x / 100) * canvasWidth);
    patch.width = Math.round((el.width / 100) * canvasWidth);
  }
  set(beginChangeAtom);
  set(elementsAtom, (list) => patchElement(list, id, patch));
});

/**
 * 用外部 state 整体替换元素列表(受控模式同步用)。
 * 整体替换会使撤销/重做栈失效,故一并清空。
 */
export const setElementsAtom = atom(null, (get, set, elements) => {
  set(elementsAtom, elements);
  set(pastAtom, []);
  set(futureAtom, []);
});

/** 删除选中（级联删除容器内的子孙元素） */
export const deleteSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  set(beginChangeAtom);
  const els = get(elementsAtom);
  const toDelete = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of els) {
      if (e.parentId && toDelete.has(e.parentId) && !toDelete.has(e.id)) {
        toDelete.add(e.id);
        changed = true;
      }
    }
  }
  set(elementsAtom, (list) => list.filter((el) => !toDelete.has(el.id)));
  set(selectedIdsAtom, []);
});

/* ----------------------------- 选择 ----------------------------- */

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

/* ----------------------------- 分组 / 合并 ----------------------------- */

/** 将选中元素合并成一个块（赋同一 groupId） */
export const groupSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (ids.length < 2) return;
  set(beginChangeAtom);
  const idSet = new Set(ids);
  const gid = `grp_${Date.now().toString(36)}`;
  set(elementsAtom, (els) =>
    els.map((el) => (idSet.has(el.id) ? { ...el, groupId: gid } : el))
  );
});

/** 解除分组合并 */
export const ungroupSelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  const els = get(elementsAtom);
  const idSet = new Set(ids);
  const groupIds = new Set(
    els.filter((el) => idSet.has(el.id) && el.groupId).map((el) => el.groupId)
  );
  if (!groupIds.size) return;
  set(beginChangeAtom);
  set(elementsAtom, (list) =>
    list.map((el) => (el.groupId && groupIds.has(el.groupId) ? { ...el, groupId: null } : el))
  );
});

/* ----------------------------- 对齐 ----------------------------- */

const ALIGN_HANDLERS = {
  left: (b) => ({ x: b.minX }),
  right: (b) => ({ x: b.maxX }),
  centerH: (b) => ({ x: Math.round((b.minX + b.maxX) / 2) }),
  top: (b) => ({ y: b.minY }),
  bottom: (b) => ({ y: b.maxY }),
  centerV: (b) => ({ y: Math.round((b.minY + b.maxY) / 2) }),
};

/** 对齐选中元素（对齐到选中集包围盒） */
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
  set(elementsAtom, (list) =>
    list.map((el) => {
      if (!idSet.has(el.id)) return el;
      const patch = handler(bounds);
      if ("x" in patch) return { ...el, x: patch.x };
      return { ...el, y: patch.y };
    })
  );
});

/* ----------------------------- 历史 ----------------------------- */

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

/** 清空画布 */
export const clearCanvasAtom = atom(null, (get, set) => {
  if (!get(elementsAtom).length) return;
  set(beginChangeAtom);
  set(elementsAtom, []);
  set(selectedIdsAtom, []);
});

/* ----------------------------- 层叠排序 ----------------------------- */

/** 同级层叠顺序调整：front/back/forward/backward */
export const reorderZAtom = atom(null, (get, set, { id, to }) => {
  const els = get(elementsAtom);
  const target = els.find((e) => e.id === id);
  if (!target) return;
  const parentId = target.parentId ?? null;
  const siblings = els
    .filter((e) => (e.parentId ?? null) === parentId)
    .sort((a, b) => (a.z || 0) - (b.z || 0));
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
    list.map((e) => (zMap.has(e.id) ? { ...e, z: zMap.get(e.id) } : e))
  );
});

/** 容器内元素重排：将元素移动到新位置 */
export const reorderContainerAtom = atom(null, (get, set, { parentId, activeId, overId, position }) => {
  const els = get(elementsAtom);
  const siblings = els
    .filter((e) => (e.parentId ?? null) === parentId)
    .sort((a, b) => (a.z || 0) - (b.z || 0));

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

/** 移动元素到新容器 */
export const moveElementToContainerAtom = atom(null, (get, set, { elementId, targetContainerId }) => {
  const els = get(elementsAtom);
  const element = els.find((e) => e.id === elementId);
  if (!element || element.parentId === targetContainerId) return;

  // 防止将容器移入自身或其子容器
  const isDescendant = (parent, childId) => {
    const children = els.filter((e) => e.parentId === parent.id);
    for (const child of children) {
      if (child.id === childId) return true;
      if (isDescendant(child, childId)) return true;
    }
    return false;
  };
  if (targetContainerId && element.id === targetContainerId) return;
  const targetContainer = els.find((e) => e.id === targetContainerId);
  if (targetContainer && isDescendant(element, targetContainerId)) return;

  set(beginChangeAtom);

  // 计算新位置的 z 索引
  const newSiblings = els.filter((e) => (e.parentId ?? null) === targetContainerId);
  const newZ = newSiblings.length ? Math.max(...newSiblings.map((e) => e.z || 0)) + 1 : 0;

  set(elementsAtom, (list) =>
    list.map((e) => (e.id === elementId ? { ...e, parentId: targetContainerId, z: newZ } : e))
  );
});
