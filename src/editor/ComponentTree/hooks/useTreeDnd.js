import { useCallback } from "react";
import { ELEMENT_TYPES } from "../../elements";

const TEMPLATE_NODE_PREFIX = "tpl-";

/**
 * 组件树拖拽落点逻辑:容器落点判定 / 同级 reorder / 跨容器移动 / 模板迁移。
 * 纯业务逻辑,不含渲染。入参 elements + reorder/move/drop action。
 */
export function useTreeDnd({ elements, reorderContainer, moveElementToContainer, dropElement }) {
  return useCallback(
    (info) => {
      const { node, dragNode, dropPosition, dropToGap } = info;

      const getNodeKey = (n) => n?.eventKey ?? n?.key;
      const dragId = String(getNodeKey(dragNode));
      const dropId = String(getNodeKey(node));

      if (!dragId || !dropId || dragId === dropId) return;
      // 模板节点不可拖拽
      if (dragId.startsWith(TEMPLATE_NODE_PREFIX)) return;

      // 落到模板节点上 -> 移到该模板顶层
      if (dropId.startsWith(TEMPLATE_NODE_PREFIX)) {
        const targetTemplateId = dropId.slice(TEMPLATE_NODE_PREFIX.length);
        dropElement({ id: dragId, targetParentId: null, targetTemplateId });
        return;
      }

      const dragElement = elements.find((el) => el.id === dragId);
      const dropTargetEl = elements.find((el) => el.id === dropId);
      if (!dragElement || !dropTargetEl) return;

      const posArr = String(node.pos ?? "").split("-");
      const relPosition = dropPosition - Number(posArr[posArr.length - 1]);

      // 落到容器节点上
      if (!dropToGap && dropTargetEl.type === ELEMENT_TYPES.CONTAINER) {
        const targetParentId = dropId;
        if ((dragElement.parentId ?? null) !== targetParentId) {
          moveElementToContainer({ elementId: dragId, targetContainerId: targetParentId });
        } else {
          const containerChildren = elements
            .filter((el) => (el.parentId ?? null) === targetParentId)
            .toSorted((a, b) => (a.z || 0) - (b.z || 0));
          const firstChild = containerChildren[0];
          if (firstChild && firstChild.id !== dragId) {
            reorderContainer({
              parentId: targetParentId,
              activeId: dragId,
              overId: firstChild.id,
              position: "left",
            });
          }
        }
        return;
      }

      const dragParentId = dragElement.parentId ?? null;
      const dropParentId = dropTargetEl.parentId ?? null;

      if (dragParentId === dropParentId) {
        reorderContainer({
          parentId: dragParentId,
          activeId: dragId,
          overId: dropId,
          position: relPosition < 0 ? "left" : "right",
        });
      } else {
        moveElementToContainer({ elementId: dragId, targetContainerId: dropParentId });
      }
    },
    [elements, reorderContainer, moveElementToContainer, dropElement],
  );
}
