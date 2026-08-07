/**
 * @deprecated 请直接从 core/utils/* 或 editor/shared/domUtils 导入。
 * 保留此文件仅用于渐进迁移，Phase 6 后会删除。
 */

// 纯函数（从 core re-export）
export {
  genId,
  cloneProps,
  toPercent,
  pxToUnit,
  toCss,
  getBounds,
  getParentId,
  expandGroupSelection,
  excludeDescendantsOfSelected,
  buildGroupedIds,
  patchElement,
  patchElements,
  reorderContainerChildren,
  cloneElementsForTemplate,
  buildChildrenMap,
  wouldCreateCycle,
  rectOverlapArea,
} from "../core/utils";

// DOM 工具函数（从 editor/shared re-export 以保持向后兼容）
export { isEditable, findSmallestHit, findFlowInsertIndex } from "./shared/domUtils";

// createElement 依赖 PALETTE_ITEM_MAP（元素注册表），保留在 editor 层
import { PALETTE_ITEM_MAP } from "./elements";
import { UNIT } from "../core/constants";
import { genId, cloneProps } from "../core/utils";

export function createElement(type, x, y) {
  const def = PALETTE_ITEM_MAP[type];
  if (!def) throw new Error(`未知组件类型: ${type}`);

  return {
    id: genId(),
    type,
    x: Math.round(x),
    y: Math.round(y),
    width: def.defaults.width,
    height: def.defaults.height,
    unit: UNIT.PX,
    rotation: 0,
    groupId: null,
    parentId: null,
    templateId: null,
    z: 0,
    locked: false,
    hidden: false,
    name: null,
    props: cloneProps(def.defaults.props),
  };
}
