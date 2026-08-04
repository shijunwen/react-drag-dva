import { useState, useRef, useCallback } from "react";
import { PALETTE_ITEM_MAP } from "./elements";
import { findSmallestHit } from "./utils";

const CONTAINER_PREFIX = "container-";
const TEMPLATE_PREFIX = "template-";

/**
 * 调色板拖放:从面板拖入新元素到画布/容器。
 * 拖拽进行中用 document.pointermove 跟踪光标;结束时按命中(优先 dnd-kit over,
 * 兜底手动最小面积命中)决定落点:容器内子元素 / 模板板顶层(坐标相对该板)。
 *
 * 返回 { activeType, handleDragStart, handleDragEnd, handleDragCancel }。
 */
export function usePaletteDnd({ addElement, zoom }) {
  const [activeType, setActiveType] = useState(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const handlePointerMove = useCallback((e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleDragStart = useCallback(
    (e) => {
      const dragType = e.active.data.current?.type;
      window.__dndActive = true;

      if (dragType) {
        // Palette 拖拽 - 拖入新元素
        setActiveType(dragType);
      } else {
        // 画布上已有元素的拖拽由 moveable 处理，不经 DndContext
        setActiveType(null);
      }

      pointerRef.current = {
        x: e.active.activatorEvent?.clientX ?? 0,
        y: e.active.activatorEvent?.clientY ?? 0,
      };
      document.addEventListener("pointermove", handlePointerMove);
    },
    [handlePointerMove],
  );

  const handleDragEnd = useCallback(
    (e) => {
      document.removeEventListener("pointermove", handlePointerMove);
      window.__dndActive = false;
      const { active, over } = e;

      if (!activeType) {
        setActiveType(null);
        return;
      }

      // Palette 拖拽结束
      const type = active.data.current?.type;
      const px = pointerRef.current.x;
      const py = pointerRef.current.y;

      // 优先使用 dnd-kit 的 over（碰撞检测命中）
      let overId = over ? String(over.id) : null;

      // 如果 dnd-kit 未命中任何 droppable，手动检测：鼠标是否在容器或模板板内
      if (!overId) {
        // 检查容器（最内层优先）
        const containerEls = document.querySelectorAll('[data-droppable-id^="container-"]');
        const bestContainer = findSmallestHit(containerEls, px, py);
        if (bestContainer) {
          overId = bestContainer.getAttribute("data-droppable-id");
        } else {
          // 检查模板画板（最内层优先）
          const boardEls = document.querySelectorAll('[data-droppable-id^="template-"]');
          const bestBoard = findSmallestHit(boardEls, px, py);
          if (bestBoard) {
            overId = bestBoard.getAttribute("data-droppable-id");
          }
        }
      }

      if (overId && overId.startsWith(CONTAINER_PREFIX)) {
        // 拖入容器：作为容器内子元素（templateId 由 addElement 从父容器继承）
        addElement({ type, parentId: overId.slice(CONTAINER_PREFIX.length) });
      } else if (overId && overId.startsWith(TEMPLATE_PREFIX)) {
        // 拖入模板画板：以落点为中心放置顶层元素（x/y 相对该板）
        const templateId = overId.slice(TEMPLATE_PREFIX.length);
        const def = PALETTE_ITEM_MAP[type];
        const boardEl = document.querySelector(`[data-template-id="${templateId}"]`);
        const rect = boardEl?.getBoundingClientRect();
        if (rect) {
          const x = (px - rect.left) / zoom - def.defaults.width / 2;
          const y = (py - rect.top) / zoom - def.defaults.height / 2;
          addElement({ type, x, y, templateId });
        }
      }

      setActiveType(null);
    },
    [activeType, addElement, handlePointerMove, zoom],
  );

  const handleDragCancel = useCallback(() => {
    document.removeEventListener("pointermove", handlePointerMove);
    window.__dndActive = false;
    setActiveType(null);
  }, [handlePointerMove]);

  return { activeType, handleDragStart, handleDragEnd, handleDragCancel };
}
