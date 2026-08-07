import { genId } from "./id";

/**
 * 深拷贝元素 props，避免 defaults.props 中的嵌套对象在多个实例间共享引用。
 * 优先 structuredClone，环境不支持时降级 JSON。
 */
export const cloneProps = (props) =>
  props === undefined || props === null
    ? {}
    : typeof structuredClone === "function"
      ? structuredClone(props)
      : JSON.parse(JSON.stringify(props));

/** 取元素的 parentId（统一 null） */
export const getParentId = (el) => el.parentId ?? null;

/** 不可变更新：替换指定 id 的元素 */
export const patchElement = (elements, id, patch) =>
  elements.map((el) =>
    el.id === id
      ? { ...el, ...patch, props: patch.props ? { ...el.props, ...patch.props } : el.props }
      : el,
  );

/**
 * 不可变批量更新。patches 形状: [{ id, patch: { x, y, ... } }]。
 */
export const patchElements = (elements, patches) => {
  const map = new Map(patches.map((p) => [p.id, p.patch]));
  return elements.map((el) => {
    const patch = map.get(el.id);
    if (!patch) return el;
    return { ...el, ...patch, props: patch.props ? { ...el.props, ...patch.props } : el.props };
  });
};

/**
 * 计算选中元素所属分组的全部成员 id 集合。
 * 选中某分组任一成员时，整组成员都视为「分组选中」。
 */
export const buildGroupedIds = (elements, selectedIds) => {
  const selectedSet = new Set(selectedIds);
  const selectedGroupIds = new Set();
  for (const e of elements) {
    if (e.groupId && selectedSet.has(e.id)) selectedGroupIds.add(e.groupId);
  }
  if (!selectedGroupIds.size) return new Set();
  const grouped = new Set();
  for (const e of elements) {
    if (e.groupId && selectedGroupIds.has(e.groupId)) grouped.add(e.id);
  }
  return grouped;
};

/**
 * 展开选择：若选中元素属于某个分组，则把同组元素一并纳入选择。
 */
export function expandGroupSelection(elements, ids) {
  const idSet = new Set(ids);
  const groupIds = new Set(
    elements.filter((el) => idSet.has(el.id) && el.groupId).map((el) => el.groupId),
  );
  if (!groupIds.size) return [...ids];
  const expanded = new Set(ids);
  for (const el of elements) {
    if (el.groupId && groupIds.has(el.groupId)) expanded.add(el.id);
  }
  return [...expanded];
}

/**
 * 容器-子孙去重：若某元素的任一祖先容器也在选中集合内，则剔除该元素。
 */
export const excludeDescendantsOfSelected = (elements, ids) => {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const idSet = new Set(ids);
  return ids.filter((id) => {
    let parentId = byId.get(id)?.parentId ?? null;
    while (parentId) {
      if (idSet.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  });
};

/**
 * 克隆一组元素到新模板：新 id、新 templateId、重映射 parentId/groupId。
 */
export function cloneElementsForTemplate(elements, newTemplateId) {
  const idMap = new Map();
  const groupIdMap = new Map();
  for (const e of elements) {
    idMap.set(e.id, genId());
    if (e.groupId && !groupIdMap.has(e.groupId)) groupIdMap.set(e.groupId, genId("grp"));
  }
  return elements.map((e) => ({
    ...e,
    id: idMap.get(e.id),
    templateId: newTemplateId,
    parentId: e.parentId ? (idMap.get(e.parentId) ?? null) : null,
    groupId: e.groupId ? groupIdMap.get(e.groupId) : null,
    props: cloneProps(e.props),
  }));
}
