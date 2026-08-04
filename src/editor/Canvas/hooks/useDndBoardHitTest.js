import { useState, useEffect } from "react";
import { findSmallestHit } from "../../utils";

/**
 * 调色板拖拽进行中:实时命中测试最内层模板板并高亮。
 * 返回当前悬停的模板 id(无命中时为 null)。
 */
export function useDndBoardHitTest({ dndActive }) {
  const [pointerOverTemplateId, setPointerOverTemplateId] = useState(null);

  useEffect(() => {
    if (!dndActive) return;
    const onMove = (e) => {
      const boards = document.querySelectorAll("[data-template-id]");
      const best = findSmallestHit(boards, e.clientX, e.clientY);
      const next = best ? best.dataset.templateId : null;
      setPointerOverTemplateId((prev) => (prev === next ? prev : next));
    };
    document.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("pointermove", onMove);
      setPointerOverTemplateId(null);
    };
  }, [dndActive]);

  return pointerOverTemplateId;
}
