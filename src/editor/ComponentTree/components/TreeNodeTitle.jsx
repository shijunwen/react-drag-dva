import { memo, useState, useEffect, useRef } from "react";
import { Input } from "antd";
import { LockOutlined, UnlockOutlined, DeleteOutlined } from "@ant-design/icons";
import styles from "../ComponentTree.module.less";

/**
 * 树节点标题(展示型):图标 + 标签 + hover 操作(锁定/删除)+ 双击内联重命名。
 *
 * - memo + 原始类型/稳定引用 props:仅本节点数据变化才重渲染,避免整树重绘。
 *   故 onRename/onToggleLock/onDelete 须为稳定引用(父级用 useCallback 绑定),
 *   以 id 为首参,本组件在内部按 id 调用,不在父级生成每节点新闭包。
 * - 重命名:双击标签进入编辑(本地草稿),Enter/blur 提交、Esc 取消。
 *   editingRef + cancelRef 保证提交幂等、Esc 不误提交。
 * - 操作按钮 stopPropagation,不触发 antd Tree 选中/展开。
 *
 * onToggleLock / onDelete 缺省时不渲染对应按钮(模板节点仅重命名)。
 */
function TreeNodeTitleBase({
  id,
  icon: Icon,
  label,
  placeholder,
  locked,
  hidden,
  onRename,
  onToggleLock,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef(null);
  const editingRef = useRef(false);
  const cancelRef = useRef(false);

  // 进入编辑:聚焦并全选(antd Input focus 支持 cursor 选项)
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus({ cursor: "all" });
  }, [editing]);

  const startEdit = (e) => {
    if (!onRename) return;
    e.stopPropagation();
    setDraft(label);
    editingRef.current = true;
    setEditing(true);
  };

  // 提交:幂等(Enter 后 unmount 可能再触发 blur,用 editingRef 拦截)
  const commit = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      return; // Esc 取消,不提交
    }
    onRename?.(id, draft);
  };

  const cancel = () => {
    cancelRef.current = true;
    inputRef.current?.blur(); // 触发 commit 走取消分支
  };

  if (editing) {
    return (
      <span className={styles.treeNode}>
        <Input
          ref={inputRef}
          size="small"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={commit}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </span>
    );
  }

  return (
    <span className={`${styles.treeNode}${locked ? ` ${styles.nodeLocked}` : ""}`}>
      {Icon && <Icon className={styles.treeIcon} />}
      <span className={styles.treeNodeLabel} onDoubleClick={startEdit} title={label}>
        {label}
      </span>
      {hidden && <span className={styles.treeBadge}>隐藏</span>}
      {(onToggleLock || onDelete) && (
        <span className={styles.actions}>
          {onToggleLock && (
            <button
              type="button"
              className={`${styles.iconBtn}${locked ? ` ${styles.active}` : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(id);
              }}
              title={locked ? "解锁" : "锁定"}
            >
              {locked ? <UnlockOutlined /> : <LockOutlined />}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.danger}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              title="删除"
            >
              <DeleteOutlined />
            </button>
          )}
        </span>
      )}
    </span>
  );
}

const TreeNodeTitle = memo(TreeNodeTitleBase);
export default TreeNodeTitle;
