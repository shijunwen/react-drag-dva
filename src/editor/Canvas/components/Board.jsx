import { memo, useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Input } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import CanvasElement from "../CanvasElement";
import styles from "../Canvas.module.less";

/**
 * 单个模板画板。memo 化:仅自身 props 变化时重渲染(CanvasElement 自身也 memo,
 * 未变元素不会重渲染)。每个 board 是独立的 useDroppable 目标,接收面板拖放。
 */
const Board = memo(function Board({
  template,
  elements,
  selectedSet,
  groupedIds,
  registerRef,
  elementRefs,
  active,
  pointerOver,
  onPointerDownCapture,
  onRename,
  onDuplicate,
  onDelete,
}) {
  const { setNodeRef } = useDroppable({ id: `template-${template.id}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(template.name);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== template.name) onRename(template.id, trimmed);
    setEditing(false);
  }, [draft, template.id, template.name, onRename]);

  const startEdit = useCallback(() => {
    setDraft(template.name);
    setEditing(true);
  }, [template.name]);

  return (
    <div className={styles.boardCell}>
      <div className={styles.boardHeader} data-no-drag onPointerDownCapture={(e) => e.stopPropagation()}>
        {editing ? (
          <Input
            size="small"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={commitRename}
            onBlur={commitRename}
            className={styles.nameInput}
          />
        ) : (
          <span
            className={`${styles.boardName}${active ? ` ${styles.boardNameActive}` : ""}`}
            onDoubleClick={startEdit}
            title="双击重命名"
          >
            {template.name}
          </span>
        )}
        <span className={styles.boardSize}>
          {template.width}×{template.height}
        </span>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => onDuplicate(template.id)}
          title="复制模板"
        >
          <CopyOutlined />
        </button>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => onDelete(template.id)}
          title="删除模板"
          disabled={false}
        >
          <DeleteOutlined />
        </button>
      </div>
      <div
        ref={setNodeRef}
        data-template-id={template.id}
        data-droppable-id={`template-${template.id}`}
        className={`${styles.board}${active ? ` ${styles.boardActive}` : ""}${pointerOver ? ` ${styles.over}` : ""}`}
        style={{ width: template.width, height: template.height }}
        onPointerDownCapture={(e) => onPointerDownCapture(e, template.id)}
      >
        {elements.map((el) => (
          <CanvasElement
            key={el.id}
            el={el}
            selected={selectedSet.has(el.id)}
            grouped={groupedIds.has(el.id)}
            registerRef={registerRef}
            elementRefs={elementRefs}
          />
        ))}
      </div>
    </div>
  );
});

export default Board;
