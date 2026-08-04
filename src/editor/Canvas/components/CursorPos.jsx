import { memo, useState, useEffect } from "react";
import styles from "../Canvas.module.less";

/**
 * 光标坐标显示。独立持有鼠标位置 state，使鼠标移动只重渲染本叶子组件。
 * 坐标相对「光标所在板」计算;不在任何板上时显示 -。
 */
const CursorPos = memo(function CursorPos({ canvasWrapRef, zoom, templates }) {
  const [pos, setPos] = useState({ x: null, y: null, name: "" });

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const onMove = (e) => {
      const board = e.target?.closest?.("[data-template-id]");
      if (!board) {
        setPos((p) => (p.x === null ? p : { x: null, y: null, name: "" }));
        return;
      }
      const tid = board.dataset.templateId;
      const tpl = templates.find((t) => t.id === tid);
      const w = tpl?.width ?? 0;
      const h = tpl?.height ?? 0;
      const rect = board.getBoundingClientRect();
      const x = Math.round(Math.max(0, Math.min(w, (e.clientX - rect.left) / zoom)));
      const y = Math.round(Math.max(0, Math.min(h, (e.clientY - rect.top) / zoom)));
      const name = tpl?.name ?? "";
      setPos((p) => (p.x === x && p.y === y && p.name === name ? p : { x, y, name }));
    };
    wrap.addEventListener("mousemove", onMove);
    return () => wrap.removeEventListener("mousemove", onMove);
  }, [canvasWrapRef, zoom, templates]);

  return (
    <span className={styles.posLabel}>
      {pos.name ? `${pos.name} ` : ""}
      {pos.x === null ? (
        <span className={styles.posValue}>-</span>
      ) : (
        <>
          X: <span className={styles.posValue}>{pos.x}</span>
          &nbsp; Y: <span className={styles.posValue}>{pos.y}</span>
        </>
      )}
    </span>
  );
});

export default CursorPos;
