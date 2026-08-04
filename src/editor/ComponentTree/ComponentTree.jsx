import { useMemo, useCallback } from "react";
import { Tree, Empty } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  selectAtom,
  reorderContainerAtom,
  moveElementToContainerAtom,
  dropElementAtom,
  templatesAtom,
  setActiveTemplateAtom,
} from "@/atoms";
import { ELEMENT_ICONS } from "../elements";
import { useTreeData } from "./hooks/useTreeData";
import { useTreeDnd } from "./hooks/useTreeDnd";
import styles from "./ComponentTree.module.less";

/**
 * 纯数据节点 -> antd Tree 节点(带 JSX title)。展示逻辑:图标/徽标/标签。
 * setActiveTemplate 为稳定 atom setter,作参数传入避免闭包到模块级。
 */
function toAntdNode(node, setActiveTemplate) {
  // 模板节点
  if (node.templateId !== undefined) {
    return {
      key: node.key,
      title: (
        <span
          className={styles.treeNode}
          onClick={() => setActiveTemplate(node.templateId)}
          role="button"
          tabIndex={0}
        >
          <span className={styles.treeNodeLabel}>{node.name}</span>
          <span className={styles.treeBadge}>{node.count}</span>
        </span>
      ),
      isLeaf: false,
      selectable: false,
      children: node.children?.map((c) => toAntdNode(c, setActiveTemplate)),
    };
  }
  // 元素节点
  const Icon = ELEMENT_ICONS[node.iconType];
  return {
    key: node.key,
    title: (
      <span className={styles.treeNode}>
        {Icon && <Icon />}
        <span className={styles.treeNodeLabel}>{node.label}</span>
        {node.locked ? <span className={styles.treeBadge}>锁定</span> : null}
        {node.hidden ? <span className={styles.treeBadge}>隐藏</span> : null}
      </span>
    ),
    isLeaf: !node.isContainer,
    children: node.isContainer
      ? node.children?.map((c) => toAntdNode(c, setActiveTemplate))
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

  const { treeNodes, expandedKeys, handleExpand } = useTreeData(elements, templates);
  const handleDrop = useTreeDnd({ elements, reorderContainer, moveElementToContainer, dropElement });

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
    () => treeNodes.map((node) => toAntdNode(node, setActiveTemplate)),
    [treeNodes, setActiveTemplate],
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
