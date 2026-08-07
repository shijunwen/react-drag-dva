import { useMemo, useCallback } from "react";
import { Tree, Empty } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import { elementsAtom } from "../../atoms/base";
import { selectedIdsAtom, selectAtom } from "../../atoms/selection";
import { templatesAtom, setActiveTemplateAtom } from "../../atoms/templates";
import { deleteElementsAtom } from "../../atoms/elements/crud";
import { toggleElementLockAtom, renameElementAtom } from "../../atoms/elements/properties";
import { reorderContainerAtom, moveElementToContainerAtom, dropElementAtom } from "../../atoms/elements/reorder";
import { ELEMENT_ICONS } from "../elements";
import { useTreeData } from "./hooks/useTreeData";
import { useTreeDnd } from "./hooks/useTreeDnd";
import TreeNodeTitle from "./components/TreeNodeTitle";
import styles from "./ComponentTree.module.less";

/**
 * 纯数据节点 -> antd Tree 节点(带 JSX title)。展示逻辑:图标/徽标/标签/操作。
 * handlers 全部为稳定引用(useSetAtom / useCallback),保证 TreeNodeTitle 的 memo 生效。
 * - 模板节点:点击切换激活模板,显示子元素计数;不可锁定/删除(其增删在属性面板)。
 * - 元素节点:TreeNodeTitle 渲染,支持 hover 锁定/删除 + 双击重命名。
 */
function toAntdNode(node, handlers) {
  // 模板节点
  if (node.templateId !== undefined) {
    return {
      key: node.key,
      title: (
        <span
          className={styles.treeNode}
          onClick={() => handlers.setActiveTemplate(node.templateId)}
          role="button"
          tabIndex={0}
        >
          <span className={styles.treeNodeLabel}>{node.name}</span>
          <span className={styles.treeBadge}>{node.count}</span>
        </span>
      ),
      isLeaf: false,
      selectable: false,
      children: node.children?.map((c) => toAntdNode(c, handlers)),
    };
  }
  // 元素节点
  const Icon = ELEMENT_ICONS[node.iconType];
  return {
    key: node.key,
    title: (
      <TreeNodeTitle
        id={node.key}
        icon={Icon}
        label={node.label}
        placeholder={node.typeLabel}
        locked={node.locked}
        hidden={node.hidden}
        onRename={handlers.handleRename}
        onToggleLock={handlers.handleToggleLock}
        onDelete={handlers.handleDelete}
      />
    ),
    isLeaf: !node.isContainer,
    children: node.isContainer
      ? node.children?.map((c) => toAntdNode(c, handlers))
      : undefined,
  };
}

/**
 * 组件树。树数据构建见 useTreeData,拖放落点逻辑见 useTreeDnd。
 * 本组件只负责选中/渲染。
 */
export default function ComponentTree() {
  const elements = useAtomValue(elementsAtom);
  const templates = useAtomValue(templatesAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const select = useSetAtom(selectAtom);
  const reorderContainer = useSetAtom(reorderContainerAtom);
  const moveElementToContainer = useSetAtom(moveElementToContainerAtom);
  const dropElement = useSetAtom(dropElementAtom);
  const setActiveTemplate = useSetAtom(setActiveTemplateAtom);
  const deleteElements = useSetAtom(deleteElementsAtom);
  const toggleElementLock = useSetAtom(toggleElementLockAtom);
  const renameElement = useSetAtom(renameElementAtom);

  const { treeNodes, expandedKeys, handleExpand } = useTreeData(elements, templates);
  const handleDrop = useTreeDnd({ elements, reorderContainer, moveElementToContainer, dropElement });

  // 稳定回调(useSetAtom setter 稳定):以 id 为首参,供 TreeNodeTitle memo 生效
  const handleDelete = useCallback((id) => deleteElements([id]), [deleteElements]);
  const handleToggleLock = useCallback((id) => toggleElementLock({ id }), [toggleElementLock]);
  const handleRename = useCallback((id, name) => renameElement({ id, name }), [renameElement]);

  const handleSelect = useCallback(
    (selectedKeys, info) => {
      if (info.selected && selectedKeys.length > 0) {
        select(selectedKeys);
      } else if (!info.selected && selectedKeys.length === 0) {
        select([]);
      }
    },
    [select],
  );

  const treeData = useMemo(
    () =>
      treeNodes.map((node) =>
        toAntdNode(node, { setActiveTemplate, handleDelete, handleToggleLock, handleRename }),
      ),
    [treeNodes, setActiveTemplate, handleDelete, handleToggleLock, handleRename],
  );

  return (
    <div className={styles.panel}>
      {treeData.length === 0 ? (
        <Empty description="暂无组件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Tree
          className={styles.tree}
          treeData={treeData}
          expandedKeys={expandedKeys}
          selectedKeys={selectedIds}
          onSelect={handleSelect}
          onExpand={handleExpand}
          draggable
          onDrop={handleDrop}
          blockNode
        />
      )}
    </div>
  );
}
