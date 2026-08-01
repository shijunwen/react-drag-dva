import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { elementsAtom, selectedIdsAtom, dragOverContainerIdAtom } from "@/atoms";
import CanvasElement from "./CanvasElement";
import styles from "./ContainerBox.module.less";

/**
 * 容器：内部子元素使用流式布局（flex wrap）。
 * - Palette 拖入新元素经 dnd-kit 落入容器（useDroppable）
 * - 容器内元素的拖拽排序 / 跨容器移动 / 拖出容器，统一由 MoveableLayer
 *   拖拽落地碰撞处理（见 MoveableLayer.resolveDrop + dropElementAtom）
 */
export default function ContainerBox({ el, elementRefs, registerRef }) {
  const allElements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);

  const { setNodeRef, isOver } = useDroppable({ id: `container-${el.id}` });
  // moveable 拖拽元素悬停时的容器高亮（palette 拖拽走 dnd-kit 的 isOver）
  const dragOverId = useAtomValue(dragOverContainerIdAtom);
  const highlighted = isOver || dragOverId === el.id;

  // 容器内子元素按 z 排序（z 作为流式顺序索引）
  const children = useMemo(() => {
    return allElements
      .filter((c) => (c.parentId ?? null) === el.id)
      .toSorted((a, b) => (a.z || 0) - (b.z || 0));
  }, [allElements, el.id]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groupedIds = useMemo(() => {
    const groupIds = new Set();
    const selectedGroupIds = new Set();
    allElements.forEach((e) => {
      if (e.groupId && selectedSet.has(e.id)) {
        selectedGroupIds.add(e.groupId);
      }
    });
    allElements.forEach((e) => {
      if (e.groupId && selectedGroupIds.has(e.groupId)) {
        groupIds.add(e.id);
      }
    });
    return groupIds;
  }, [allElements, selectedSet]);

  return (
    <div
      ref={setNodeRef}
      className={`${styles.container}${highlighted ? ` ${styles.over}` : ""}`}
    >
      <div className={styles.visual} />
      {/* 流式布局内容区 */}
      <div className={styles.content}>
        {children.map((child) => (
          <div
            key={child.id}
            className={`${styles.childWrapper}${selectedSet.has(child.id) ? ` ${styles.selected}` : ""}`}
          >
            <CanvasElement
              el={child}
              selected={selectedSet.has(child.id)}
              grouped={groupedIds.has(child.id)}
              registerRef={registerRef}
              elementRefs={elementRefs}
              isInContainer
            />
          </div>
        ))}
      </div>
    </div>
  );
}
