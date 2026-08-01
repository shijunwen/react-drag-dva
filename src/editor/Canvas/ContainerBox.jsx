import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { elementsAtom, selectedIdsAtom } from "@/atoms";
import CanvasElement from "./CanvasElement";
import styles from "./ContainerBox.module.less";

const SORT_ITEM_PREFIX = "sort-item-";

/**
 * 容器：内部子元素使用流式布局（flex wrap）
 * - 拖入新元素自动加入流布局
 * - 容器内元素可以拖拽排序
 */
export default function ContainerBox({ el, elementRefs, registerRef, sortState }) {
  const allElements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);

  const { setNodeRef, isOver } = useDroppable({ id: `container-${el.id}` });

  // 容器内子元素按 z 排序（z 作为排序索引）
  const children = useMemo(() => {
    return allElements
      .filter((c) => (c.parentId ?? null) === el.id)
      .sort((a, b) => (a.z || 0) - (b.z || 0));
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

  // 渲染带排序指示器的子元素
  const renderChildrenWithIndicators = () => {
    const result = [];
    const isSorting = sortState && sortState.parentId === el.id;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;

      // 如果需要在左侧显示放置指示器
      if (
        isSorting &&
        sortState &&
        sortState.overId === child.id &&
        sortState.position === "left" &&
        sortState.activeId !== child.id
      ) {
        result.push(
          <div
            key={`indicator-left-${child.id}`}
            className={`${styles.dropIndicator} ${styles.visible}`}
          />
        );
      }

      // 渲染子元素包装器
      result.push(
        <SortItemWrapper
          key={child.id}
          child={child}
          isSorting={isSorting}
          sortState={sortState}
          selectedSet={selectedSet}
          groupedIds={groupedIds}
          registerRef={registerRef}
          elementRefs={elementRefs}
        />
      );

      // 如果需要在右侧显示放置指示器
      if (
        isSorting &&
        sortState &&
        sortState.overId === child.id &&
        sortState.position === "right" &&
        sortState.activeId !== child.id
      ) {
        result.push(
          <div
            key={`indicator-right-${child.id}`}
            className={`${styles.dropIndicator} ${styles.visible}`}
          />
        );
      }
    }

    return result;
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.container}${isOver ? ` ${styles.over}` : ""}`}
    >
      <div className={styles.visual} />
      {/* 流式布局内容区 */}
      <div className={styles.content}>
        {renderChildrenWithIndicators()}
      </div>
    </div>
  );
}

/**
 * 排序项目包装器
 */
function SortItemWrapper({ child, isSorting, _sortState, selectedSet, groupedIds, registerRef, elementRefs }) {
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `${SORT_ITEM_PREFIX}${child.id}`,
  });

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: child.id,
  });

  const isSelected = selectedSet.has(child.id);

  let wrapperClass = styles.childWrapper;
  if (isDragging) wrapperClass += ` ${styles.dragging}`;
  if (isSelected) wrapperClass += ` ${styles.selected}`;

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  // 合并 refs
  const setRefs = (node) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  // 只有在未选中或者正在排序时，才启用拖拽排序
  // 选中后，moveable 会接管交互用于调整大小
  const shouldHandleDrag = !isSelected || isSorting;

  return (
    <div
      ref={setRefs}
      className={wrapperClass}
      style={shouldHandleDrag ? style : undefined}
      {...(shouldHandleDrag ? attributes : {})}
      {...(shouldHandleDrag ? listeners : {})}
      data-no-drag={isSelected && !isSorting ? "true" : undefined}
    >
      <CanvasElement
        el={child}
        selected={isSelected}
        grouped={groupedIds.has(child.id)}
        registerRef={registerRef}
        elementRefs={elementRefs}
        isInContainer
      />
    </div>
  );
}
