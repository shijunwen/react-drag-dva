import { useMemo, useState, useEffect, useCallback } from "react";
import { DEFAULT_TEMPLATE_ID } from "@/atoms";
import { ELEMENT_TYPES, PALETTE_ITEM_MAP } from "../../elements";

const TEMPLATE_NODE_PREFIX = "tpl-";

const getElementLabel = (element) => {
  const item = PALETTE_ITEM_MAP[element.type];
  return item?.label || element.type;
};

/**
 * 构建组件树数据(纯结构,不含 JSX)。
 * 顶层按模板分组,每个模板节点下为该模板的顶层元素树(容器递归)。
 * 展开 state 由本 hook 持有:仅当容器/模板集合变化时重置,用户手动展开不被覆盖。
 *
 * 节点形状:
 * - 模板节点: { key, templateId, name, count, children }
 * - 元素节点: { key, label, iconType, isContainer, locked, hidden, children }
 */
export function useTreeData(elements, templates) {
  const { treeNodes, defaultExpandedKeys } = useMemo(() => {
    // 先按 parentId 分组
    const childrenMap = new Map();
    elements.forEach((el) => {
      const parentId = el.parentId ?? null;
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId).push(el);
    });
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.z || 0) - (b.z || 0));
    });

    const allContainerIds = [];

    const buildNode = (el) => {
      if (el.type === ELEMENT_TYPES.CONTAINER) allContainerIds.push(el.id);
      return {
        key: el.id,
        label: getElementLabel(el),
        iconType: el.type,
        isContainer: el.type === ELEMENT_TYPES.CONTAINER,
        locked: !!el.locked,
        hidden: !!el.hidden,
        children:
          el.type === ELEMENT_TYPES.CONTAINER
            ? (childrenMap.get(el.id) || []).map(buildNode)
            : undefined,
      };
    };

    // 顶层元素按 templateId 分组
    const topLevel = childrenMap.get(null) || [];
    const byTemplate = new Map();
    for (const el of topLevel) {
      const tid = el.templateId ?? DEFAULT_TEMPLATE_ID;
      const arr = byTemplate.get(tid);
      if (arr) arr.push(el);
      else byTemplate.set(tid, [el]);
    }

    const treeNodes = templates.map((tpl) => {
      const topEls = byTemplate.get(tpl.id) || [];
      return {
        key: TEMPLATE_NODE_PREFIX + tpl.id,
        templateId: tpl.id,
        name: tpl.name,
        count: topEls.length,
        children: topEls.map(buildNode),
      };
    });

    // 默认展开:模板节点 + 全部容器
    const templateKeys = templates.map((tpl) => TEMPLATE_NODE_PREFIX + tpl.id);
    return {
      treeNodes,
      defaultExpandedKeys: [...templateKeys, ...allContainerIds],
    };
  }, [elements, templates]);

  const [expandedKeys, setExpandedKeys] = useState(defaultExpandedKeys);
  // 仅当容器/模板集合变化时重置展开
  const expandKey = defaultExpandedKeys.join("\n");
  useEffect(() => {
    setExpandedKeys(defaultExpandedKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandKey]);

  const handleExpand = useCallback((newExpandedKeys) => setExpandedKeys(newExpandedKeys), []);

  return { treeNodes, expandedKeys, handleExpand };
}
