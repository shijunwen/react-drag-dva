import { useEffect, useMemo } from "react";
import { useSetAtom } from "jotai";
import { selectAtom } from "../../../atoms/selection";
import { DEFAULT_TEMPLATE_ID } from "../../../atoms/templates";

/**
 * 选中元素 -> moveable targets 的派生 + 无效选中清理(从 useMoveableGestures 抽出)。
 * - targets:selectedIds 经 elementRefs 映射到 DOM 节点(moveable targets)
 * - isGroup / elementIds / hasLockedSelected
 * - undo/redo 后选中元素可能已不存在,过滤无效选中
 * - parentId / firstTemplateId / isInContainer:父容器与模板归属(吸附与手势均需)
 */
export function useMoveableTargets({ selectedIds, elements, elementRefs }) {
  const select = useSetAtom(selectAtom);

  // id -> element 的 O(1) 索引,供锁定检测与失效选中过滤
  const elementsById = useMemo(() => {
    const m = new Map();
    for (const el of elements) m.set(el.id, el);
    return m;
  }, [elements]);

  // 选中元素引用(即 moveable targets)
  const targets = useMemo(
    () => selectedIds.map((id) => elementRefs.current.get(id)).filter(Boolean),
    [selectedIds, elementRefs],
  );

  const isGroup = targets.length > 1;
  const hasLockedSelected = selectedIds.some((id) => elementsById.get(id)?.locked);

  // 有效选中 id(仍存在于 elements 中,供失效过滤复用)
  const elementIds = useMemo(
    () => selectedIds.filter((id) => elementsById.has(id)),
    [selectedIds, elementsById],
  );

  // undo/redo 后选中元素可能已不存在,过滤无效选中
  const hasInvalidSelection = useMemo(
    () => selectedIds.length > 0 && elementIds.length < selectedIds.length,
    [selectedIds, elementIds],
  );
  useEffect(() => {
    if (hasInvalidSelection) {
      select(selectedIds.filter((id) => elementsById.has(id)));
    }
  }, [hasInvalidSelection, selectedIds, elementsById, select]);

  // 判断是否是容器内元素(共用一次 idSet / firstSelected 计算)
  const idSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const firstSelected = useMemo(() => {
    for (const el of elements) {
      if (idSet.has(el.id)) return el;
    }
    return null;
  }, [elements, idSet]);
  const parentId = firstSelected?.parentId ?? null;
  const firstTemplateId = firstSelected?.templateId ?? DEFAULT_TEMPLATE_ID;
  const isInContainer = targets.length > 0 && parentId !== null;

  return {
    targets,
    isGroup,
    elementIds,
    hasLockedSelected,
    parentId,
    firstTemplateId,
    isInContainer,
  };
}
