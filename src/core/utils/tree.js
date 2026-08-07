/** parentId -> children[] 索引（null 键为顶层），用于 O(1) 子元素查找 */
export const buildChildrenMap = (elements) => {
  const map = new Map();
  for (const el of elements) {
    const pid = el.parentId ?? null;
    const arr = map.get(pid);
    if (arr) arr.push(el);
    else map.set(pid, [el]);
  }
  return map;
};

/**
 * 将 elementId 移入 targetContainerId 是否成环。
 * 基于 childrenMap 的迭代 DFS，O(n)。
 */
export const wouldCreateCycle = (elements, elementId, targetContainerId) => {
  if (elementId === null || targetContainerId === null) return false;
  if (elementId === targetContainerId) return true;
  const childrenMap = buildChildrenMap(elements);
  const stack = [elementId];
  const seen = new Set([elementId]);
  while (stack.length) {
    const children = childrenMap.get(stack.pop());
    if (!children) continue;
    for (const c of children) {
      if (c.id === targetContainerId) return true;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return false;
};

/**
 * 重新排列容器内元素的 z 索引。
 */
export const reorderContainerChildren = (elements, parentId, newOrder) => {
  const zMap = new Map(newOrder.map((id, index) => [id, index]));
  return elements.map((el) => {
    if ((el.parentId ?? null) !== parentId) return el;
    const z = zMap.get(el.id);
    return z !== undefined ? { ...el, z } : el;
  });
};

/**
 * 获取指定 parentId 下的所有子元素，按 z 排序。
 * parentId 为 null 时返回顶层元素。消除 6 处重复过滤。
 */
export const getChildren = (elements, parentId) => {
  const pid = parentId ?? null;
  return elements.filter((el) => (el.parentId ?? null) === pid).sort((a, b) => a.z - b.z);
};
