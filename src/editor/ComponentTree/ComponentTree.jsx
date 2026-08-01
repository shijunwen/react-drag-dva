import { useMemo, useCallback, useState, useEffect } from "react";
import { Tree, Empty } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  selectAtom,
  reorderContainerAtom,
  moveElementToContainerAtom,
} from "@/atoms";
import { ELEMENT_TYPES, PALETTE_ITEM_MAP, ELEMENT_ICONS } from "../elements";
import styles from "./ComponentTree.module.less";

// 获取元素名称
const getElementLabel = (element) => {
  const item = PALETTE_ITEM_MAP[element.type];
  return item?.label || element.type;
};

export default function ComponentTree() {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const select = useSetAtom(selectAtom);
  const reorderContainer = useSetAtom(reorderContainerAtom);
  const moveElementToContainer = useSetAtom(moveElementToContainerAtom);
  const [expandedKeys, setExpandedKeys] = useState([]);

  // 构建树形结构
  const { treeData, expandedKeys: defaultExpandedKeys } = useMemo(() => {
    // 先按 parentId 分组
    const childrenMap = new Map();

    elements.forEach((el) => {
      const parentId = el.parentId ?? null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId).push(el);
    });

    // 对每个分组排序
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.z || 0) - (b.z || 0));
    });

    const allContainerIds = [];

    // 递归构建树
    const buildTree = (parentId = null) => {
      const children = childrenMap.get(parentId) || [];
      return children.map((el) => {
        const IconComponent = ELEMENT_ICONS[el.type];
        if (el.type === ELEMENT_TYPES.CONTAINER) {
          allContainerIds.push(el.id);
        }
        return {
          key: el.id,
          title: (
            <span className={styles.treeNode}>
              {IconComponent && <IconComponent />}
              <span className={styles.treeNodeLabel}>{getElementLabel(el)}</span>
            </span>
          ),
          isLeaf: el.type !== ELEMENT_TYPES.CONTAINER,
          children: el.type === ELEMENT_TYPES.CONTAINER ? buildTree(el.id) : undefined,
        };
      });
    };

    return {
      treeData: buildTree(null),
      expandedKeys: allContainerIds,
    };
  }, [elements]);

  // 仅当容器集合变化时重置展开:elements 频繁变更(拖拽/编辑)但容器集合不变时,
  // defaultExpandedKeys 仍是新数组引用--旧写法每次都 setExpandedKeys,触发多余 Tree 重渲染。
  const containerIdsKey = defaultExpandedKeys.join("\n");
  useEffect(() => {
    setExpandedKeys(defaultExpandedKeys);
    // 依赖容器 id 签名而非数组引用;defaultExpandedKeys 与其在同一次 render 计算,一致
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerIdsKey]);

  const handleSelect = useCallback((selectedKeys, info) => {
    if (info.selected && selectedKeys.length > 0) {
      select(selectedKeys);
    } else if (!info.selected && selectedKeys.length === 0) {
      select([]);
    }
  }, [select]);

  const handleDrop = useCallback((info) => {
    const { node, dragNode, dropPosition, dropToGap } = info;

    // 获取 key - 先尝试 eventKey，再尝试 key
    const getNodeKey = (n) => n?.eventKey ?? n?.key;

    const dragId = String(getNodeKey(dragNode));
    const dropId = String(getNodeKey(node));

    if (!dragId || !dropId || dragId === dropId) return;

    const dragElement = elements.find((el) => el.id === dragId);
    const dropElement = elements.find((el) => el.id === dropId);

    if (!dragElement || !dropElement) return;

    // info.dropPosition 是「绝对插入位置」，需用 node.pos 还原为相对落点：
    // -1 = 节点上方间隙(before)，0 = 落入节点内部，1 = 节点下方间隙(after)
    const posArr = String(node.pos ?? "").split("-");
    const relPosition = dropPosition - Number(posArr[posArr.length - 1]);

    // 落到容器节点上
    if (!dropToGap && dropElement.type === ELEMENT_TYPES.CONTAINER) {
      const targetParentId = dropId;
      if ((dragElement.parentId ?? null) !== targetParentId) {
        // 从外部拖入：移入该容器
        moveElementToContainer({
          elementId: dragId,
          targetContainerId: targetParentId,
        });
      } else {
        // 已在容器内且拖到容器节点上：视作排到容器顶部（放在第一个子元素前面）
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
    const dropParentId = dropElement.parentId ?? null;

    if (dragParentId === dropParentId) {
      // 同一父级下排序
      reorderContainer({
        parentId: dragParentId,
        activeId: dragId,
        overId: dropId,
        position: relPosition < 0 ? "left" : "right",
      });
    } else {
      // 跨容器：移入目标所在父级
      moveElementToContainer({
        elementId: dragId,
        targetContainerId: dropParentId,
      });
    }
  }, [elements, reorderContainer, moveElementToContainer]);

  const handleExpand = useCallback((newExpandedKeys) => {
    setExpandedKeys(newExpandedKeys);
  }, []);

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
