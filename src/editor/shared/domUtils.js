/**
 * DOM 相关工具函数 — 依赖浏览器 API，不进 core/。
 */

/** 判断元素是否为可编辑表单控件（快捷键在此类元素聚焦时应放行原生行为） */
export const isEditable = (el) => {
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
};

/**
 * 在一组 DOM 元素中，找到包含指定点且面积最小（最内层）的元素。
 * 用于拖放命中测试：画板/容器嵌套时取最内层。
 * @param {Iterable<HTMLElement>} els - 候选 DOM 元素
 * @param {number} x - 屏幕坐标 x(clientX)
 * @param {number} y - 屏幕坐标 y(clientY)
 * @returns {HTMLElement|null}
 */
export const findSmallestHit = (els, x, y) => {
  let best = null;
  let bestArea = Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = el;
      }
    }
  }
  return best;
};

/**
 * 在流式子元素序列中，按落点中心找到插入索引。
 * 按渲染顺序遍历，找第一个「落点中心在其左半」的兄弟，插其前面；否则追加末尾。
 */
export const findFlowInsertIndex = (orderedSiblings, center) => {
  for (let i = 0; i < orderedSiblings.length; i++) {
    const mid = orderedSiblings[i].rect.left + orderedSiblings[i].rect.width / 2;
    if (center.x < mid) return i;
  }
  return orderedSiblings.length;
};
