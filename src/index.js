/**
 * react-drag-dva 公共入口。
 *
 * 用法:
 *   import { Editor } from "react-drag-dva";
 *   import "react-drag-dva/style.css";  // 设计 token + 组件样式
 *
 * Editor 依赖 antd,消费方需自行用 antd 的 ConfigProvider 提供主题/locale。
 */
import "./editor/tokens.less";

// 主组件
export { default as Editor } from "./editor/Editor";
export { default as DraggableElement } from "./editor/DraggableElement";
export { Preview } from "./editor/Preview";

// 编程式访问
export { useEditor } from "./editor/useEditor";

// 状态 atoms(高级:外部读写编辑器状态)
export {
  elementsAtom,
  selectedIdsAtom,
  selectedElementsAtom,
  viewportAtom,
  zoomAtom,
  canvasWidthAtom,
  canvasHeightAtom,
  previewModeAtom,
  templatesAtom,
  activeTemplateIdAtom,
  templateColumnsAtom,
  DEFAULT_TEMPLATE_ID,
  setElementsAtom,
  addElementAtom,
  updateElementAtom,
  updateElementsAtom,
  setElementUnitAtom,
  deleteSelectedAtom,
  selectAtom,
  toggleSelectAtom,
  clearSelectionAtom,
  groupSelectedAtom,
  ungroupSelectedAtom,
  alignSelectedAtom,
  reorderZAtom,
  reorderContainerAtom,
  moveElementToContainerAtom,
  dropElementAtom,
  clipboardAtom,
  copySelectedAtom,
  pasteAtom,
  duplicateSelectedAtom,
  nudgeSelectedAtom,
  undoAtom,
  redoAtom,
  clearCanvasAtom,
  beginChangeAtom,
  setViewportAtom,
  setZoomAtom,
  setPreviewModeAtom,
  addTemplateAtom,
  duplicateTemplateAtom,
  deleteTemplateAtom,
  renameTemplateAtom,
  setTemplateSizeAtom,
  setActiveTemplateAtom,
  setTemplateColumnsAtom,
} from "./atoms";

// 元素注册表(扩展:注册自定义元素类型)
export {
  ELEMENT_DEFS,
  getDef,
  ELEMENT_TYPES,
  PALETTE_ITEMS,
  PALETTE_ITEM_MAP,
  ELEMENT_ICONS,
  registerElement,
} from "./editor/elements";

// 工具函数
export { createElement, getBounds, expandGroupSelection, toPercent, pxToUnit, toCss } from "./editor/utils";

// 画布常量
export { UNIT, CANVAS_WIDTH, CANVAS_HEIGHT } from "./editor/constants";
