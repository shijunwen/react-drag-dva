import { atom } from "jotai";
import { elementsAtom } from "./base";
import { selectedIdsAtom } from "./selection";
import { beginChangeAtom, pastAtom, futureAtom } from "./history";
import { viewportAtom } from "./viewport";
import {
  createElement,
  patchElement,
  patchElements,
  getBounds,
  reorderContainerChildren,
  buildChildrenMap,
  wouldCreateCycle,
  genId,
  cloneProps,
} from "@/editor/utils";
import { UNIT } from "@/editor/constants";

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
  set(selectedIdsAtom, []);
});

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
  // handler(bounds) 仅依赖一次计算的 bounds，提前算一次即可
  const patch = handler(bounds);
  const key = "x" in patch ? "x" : "y";
  set(elementsAtom, (list) =>
    list.map((el) => (idSet.has(el.id) ? { ...el, [key]: patch[key] } : el))
  );
});

/* ----------------------------- 画布 ----------------------------- */

/** 清空画布 */
export const clearCanvasAtom = atom(null, (get, set) => {
  if (!get(elementsAtom).length) return;
  set(beginChangeAtom);
  set(elementsAtom, []);
  set(selectedIdsAtom, []);
});

/* ----------------------------- 剪贴板 / 复制粘贴 ----------------------------- */

/** 剪贴板:存放复制的元素快照(随 Jotai store 隔离,每实例独立) */
export const clipboardAtom = atom([]);

/** 克隆偏移量(px) */
const DUPE_OFFSET = 20;

/**
 * 克隆一组元素:新 id、偏移位置、保持同组关系(新 groupId,与原组分离)、
 * 同级置于顶部(z = 当前最大 + 1)。parentId 保留(容器内复制仍在原容器)。
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

/** 复制选中到剪贴板 */
export const copySelectedAtom = atom(null, (get, set) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  const idSet = new Set(ids);
  set(clipboardAtom, get(elementsAtom).filter((e) => idSet.has(e.id)));
});

/** 粘贴剪贴板(克隆 + 偏移 + 选中新元素) */
export const pasteAtom = atom(null, (get, set) => {
  const clip = get(clipboardAtom);
  if (!clip.length) return;
  set(beginChangeAtom);
  const newEls = cloneElements(clip, get(elementsAtom));
  set(elementsAtom, (list) => [...list, ...newEls]);
  set(selectedIdsAtom, newEls.map((e) => e.id));
});

/** 直接克隆选中(原地复制 + 偏移 + 选中) */
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

/* ----------------------------- 键盘微调 ----------------------------- */

/**
 * 微调选中元素位置(仅顶层元素;容器内子元素为流式布局,x/y 不生效)。
 * % 单位元素按画布宽度换算 dx;y 始终 px。自动夹在画布范围内。
 */
export const nudgeSelectedAtom = atom(null, (get, set, { dx, dy }) => {
  const ids = get(selectedIdsAtom);
  if (!ids.length) return;
  const idSet = new Set(ids);
  const { canvasWidth, canvasHeight } = get(viewportAtom);
  set(beginChangeAtom);
  set(elementsAtom, (list) =>
    list.map((e) => {
      if (!idSet.has(e.id) || e.parentId || e.locked) return e;
      const isPercent = (e.unit || "px") === "%";
      const gx = isPercent && canvasWidth ? (dx / canvasWidth) * 100 : dx;
      const maxX = isPercent ? 100 - e.width : canvasWidth - e.width;
      const x = Math.max(
        0,
        Math.min(maxX, isPercent ? +((e.x || 0) + gx).toFixed(2) : Math.round((e.x || 0) + gx)),
      );
      const y = Math.max(0, Math.min((canvasHeight || Infinity) - e.height, Math.round((e.y || 0) + dy)));
      return { ...e, x, y };
    }),
  );
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
    list.map((e) => (zMap.has(e.id) ? { ...e, z: zMap.get(e.id) } : e))
  );
});

/** 容器内元素重排：将元素移动到新位置 */
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

/** 移动元素到新容器 */
export const moveElementToContainerAtom = atom(null, (get, set, { elementId, targetContainerId }) => {
  const els = get(elementsAtom);
  const element = els.find((e) => e.id === elementId);
  if (!element || element.parentId === targetContainerId) return;

  // 防止将容器移入自身或其子容器（成环）
  if (wouldCreateCycle(els, element.id, targetContainerId)) return;

  set(beginChangeAtom);

  // 计算新位置的 z 索引
  const newSiblings = els.filter((e) => (e.parentId ?? null) === targetContainerId);
  const newZ = newSiblings.length ? Math.max(...newSiblings.map((e) => e.z || 0)) + 1 : 0;

  set(elementsAtom, (list) =>
    list.map((e) => (e.id === elementId ? { ...e, parentId: targetContainerId, z: newZ } : e))
  );
});

/**
 * 拖拽落地:统一处理容器内重排 / 跨容器移动 / 移出为顶层。
 * 一次落地 = 一条撤销记录(beginChange)。
 * - targetParentId === null:移出为顶层绝对元素,赋 x/y
 * - targetParentId === 容器id:移入该容器(同或异),按 insertIndex 重排 z
 * - insertIndex 为 null 时追加到目标容器末尾
 */
export const dropElementAtom = atom(null, (get, set, { id, targetParentId, insertIndex = null, x, y }) => {
  const els = get(elementsAtom);
  const el = els.find((e) => e.id === id);
  if (!el) return;
  const currentParent = el.parentId ?? null;
  if (targetParentId === currentParent && insertIndex === null) return;

  // 防环:不能移入自身或其后代容器
  if (targetParentId !== null && wouldCreateCycle(els, id, targetParentId)) return;

  set(beginChangeAtom);

  if (targetParentId === null) {
    // 移出为顶层:放到顶层末尾,赋绝对坐标
    const topSiblings = els.filter((e) => !e.parentId && e.id !== id);
    const newZ = topSiblings.length ? Math.max(...topSiblings.map((e) => e.z || 0)) + 1 : 0;
    set(elementsAtom, (list) =>
      list.map((e) => (e.id === id ? { ...e, parentId: null, z: newZ, x: x ?? 0, y: y ?? 0 } : e))
    );
    return;
  }

  // 移入容器(同容器重排 / 跨容器迁移):按 insertIndex 重排目标容器兄弟 z
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
      if (e.id === id) return { ...e, parentId: targetParentId, z: zMap.get(e.id) ?? 0, x: 0, y: 0 };
      const z = zMap.get(e.id);
      return z !== undefined ? { ...e, z } : e;
    });
  });
});
