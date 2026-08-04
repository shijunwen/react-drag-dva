/**
 * 拖拽落地判定(纯函数)。从 MoveableLayer 抽出,便于阅读与测试。
 * 与 Editor.jsx 的 pickInnermostDroppable 一致:取面积最小(最内层)命中。
 */
import { rectOverlapArea, findFlowInsertIndex, findSmallestHit } from "../utils";
import { DEFAULT_TEMPLATE_ID } from "@/atoms";

/**
 * 找与给定 rect 重叠的最内层容器(面积最小命中)。
 * 跨模板容器也可命中(落地时元素 templateId 跟随容器)。
 * @param {DOMRect} tRect - 拖拽元素屏幕矩形
 * @param {string} selfId - 拖拽元素自身 id(容器不能拖入自身)
 * @param {string[]} containerIds - 容器 id 列表
 * @param {Map} elementRefs - id -> DOM node
 * @returns {{id:string,area:number}|null}
 */
export const findDropContainer = (tRect, selfId, containerIds, elementRefs) => {
  let best = null;
  for (const id of containerIds) {
    if (id === selfId) continue; // 容器不能拖入自身
    const node = elementRefs.current.get(id);
    if (!node) continue;
    const r = node.getBoundingClientRect();
    if (rectOverlapArea(tRect, r) <= 0) continue;
    const area = r.width * r.height;
    if (!best || area < best.area) best = { id, area };
  }
  return best;
};

/**
 * 拖拽落地判定:
 * - 命中容器(取最内层,可跨模板) -> 移入并按落点算流式插入索引
 * - 未命中容器 -> 按光标中心所在板换算绝对坐标;所在板即目标模板(可跨模板迁移)
 * @param {HTMLElement} target - 拖拽元素 DOM
 * @param {object} el - 拖拽元素数据
 * @param {{containerIds:string[], elementRefs:Map, elements:object[], zoom:number}} ctx
 */
export const resolveDrop = (target, el, { containerIds, elementRefs, elements, zoom }) => {
  const tRect = target.getBoundingClientRect();
  const cx = tRect.left + tRect.width / 2;
  const cy = tRect.top + tRect.height / 2;

  const best = findDropContainer(tRect, el.id, containerIds, elementRefs);
  if (best) {
    const siblings = elements
      .filter((e) => (e.parentId ?? null) === best.id && e.id !== el.id)
      .toSorted((a, b) => (a.z || 0) - (b.z || 0))
      .map((s) => ({ id: s.id, rect: elementRefs.current.get(s.id)?.getBoundingClientRect() }))
      .filter((s) => s.rect);
    const insertIndex = findFlowInsertIndex(siblings, { x: cx, y: cy });
    return { targetParentId: best.id, insertIndex };
  }

  // 找光标中心所在板(最小面积命中);未命中任何板则回退到元素自身所属板
  const boards = document.querySelectorAll("[data-template-id]");
  const overBoard = findSmallestHit(boards, cx, cy);
  const board = overBoard ?? target.closest("[data-template-id]");
  if (!board) {
    return {
      targetParentId: null,
      targetTemplateId: el.templateId ?? DEFAULT_TEMPLATE_ID,
      x: el.x ?? 0,
      y: el.y ?? 0,
    };
  }
  const br = board.getBoundingClientRect();
  const targetTemplateId = board.dataset.templateId;
  const x = Math.round((cx - br.left) / zoom - el.width / 2);
  const y = Math.round((cy - br.top) / zoom - el.height / 2);
  return { targetParentId: null, targetTemplateId, x, y };
};
