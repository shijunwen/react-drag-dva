// Type declarations for react-drag-dva
import type { Atom, WritableAtom, PrimitiveAtom } from "jotai";
import type { ComponentType, FC, ReactNode, ForwardRefExoticComponent, RefAttributes } from "react";

/* ============================ 基础类型 ============================ */

/** 单位:仅影响元素的 x / width */
export type Unit = "px" | "%";

/** 对齐方向 */
export type AlignDir = "left" | "right" | "centerH" | "top" | "bottom" | "centerV";

/** 层叠顺序调整方向 */
export type ZDir = "front" | "back" | "forward" | "backward";

/** 元素类型字符串 */
export interface ElementTypes {
  readonly TEXT: "text";
  readonly RECT: "rect";
  readonly CIRCLE: "circle";
  readonly IMAGE: "image";
  readonly BUTTON: "button";
  readonly CONTAINER: "container";
}

/** 画布元素数据结构 */
export interface EditorElement {
  /** 唯一 id */
  id: string;
  /** 元素类型(ELEMENT_TYPES 之一) */
  type: string;
  /** 横向位置,单位由 unit 决定 */
  x: number;
  /** 纵向位置,始终 px */
  y: number;
  /** 宽,单位由 unit 决定 */
  width: number;
  /** 高,始终 px */
  height: number;
  /** 仅影响 x / width */
  unit: Unit;
  /** 旋转角度 */
  rotation: number;
  /** 分组标识,null 表示未分组 */
  groupId: string | null;
  /** null=画布顶层; containerId=容器内子元素 */
  parentId: string | null;
  /** 所属模板 id(null 兜底为默认模板) */
  templateId: string | null;
  /** 同级层叠顺序 */
  z: number;
  /** 锁定:不可移动/缩放(仍可选中以解锁) */
  locked?: boolean;
  /** 隐藏:不渲染(保留数据) */
  hidden?: boolean;
  /** 实例名称(null 时回退为类型 label;组件树/属性面板可改) */
  name?: string | null;
  /** 类型专属属性(text/fill/src/label 等) */
  props: Record<string, unknown>;
}

/** 模板:一页独立画布(各自尺寸与元素集合) */
export interface EditorTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
}

/** 视口状态:缩放 + 平移(画布尺寸已迁移到 templatesAtom) */
export interface Viewport {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

/** 包围盒 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/* ============================ 元素注册表 ============================ */

/** Content / Props 组件接收的注入 props */
export interface ContentProps {
  el: EditorElement;
  styles: Record<string, string>;
}

export interface PropsEditorProps {
  el: EditorElement;
  update: (patch: Partial<EditorElement>) => void;
  begin: () => void;
  styles: Record<string, string>;
}

/** 元素定义(注册表项) */
export interface ElementDef {
  type: string;
  label: string;
  icon: ComponentType<Record<string, unknown>>;
  defaults: { width: number; height: number; props: Record<string, unknown> };
  Content: ComponentType<ContentProps> | null;
  Props: ComponentType<PropsEditorProps> | null;
}

/** 面板项(仅元数据) */
export interface PaletteItem {
  type: string;
  label: string;
  defaults: { width: number; height: number; props: Record<string, unknown> };
}

export const ELEMENT_TYPES: ElementTypes;
export const ELEMENT_DEFS: Record<string, ElementDef>;
export function getDef(type: string): ElementDef | undefined;
export const PALETTE_ITEMS: PaletteItem[];
export const PALETTE_ITEM_MAP: Record<string, PaletteItem>;
export const ELEMENT_ICONS: Record<string, ComponentType<Record<string, unknown>>>;

/* ============================ 组件 ============================ */

export interface EditorProps {
  /** 受控元素列表。提供即进入受控模式,外部变更覆盖内部 */
  value?: EditorElement[];
  /** 元素发生已提交变更时回调(手势结束 / 增删 / 对齐 / 撤销 / 单位切换 / 属性编辑) */
  onChange?: (elements: EditorElement[]) => void;
  /** 非受控模式的挂载种子(仅一次,受控模式下忽略) */
  initialElements?: EditorElement[];
  /** 模板列表挂载种子(可选,仅一次) */
  initialTemplates?: EditorTemplate[];
  /** 模板列表变化回调(可选,观察模板增删改) */
  onTemplatesChange?: (templates: EditorTemplate[]) => void;
  /** 顶部自定义 chrome(如工具栏),在 Editor 的 Jotai store 内渲染,可用 useEditor()/atoms 与本实例联动 */
  children?: ReactNode;
  /** 左侧面板内容。提供则替换默认组件树(在 Provider/DndContext 内,可用 useEditor());
   *  欲同时保留默认树可在此嵌入 <ComponentTree/> */
  leftPanel?: ReactNode;
  /** 左侧面板标题;undefined=「组件树」,null=隐藏标题 */
  leftPanelTitle?: ReactNode;
  /** 右侧面板内容。提供则替换默认属性面板(在 Provider/DndContext 内,可用 useEditor());
   *  欲同时保留默认面板可在此嵌入 <PropertiesPanel/> */
  rightPanel?: ReactNode;
  /** 右侧面板标题;undefined=「属性」,null=隐藏标题 */
  rightPanelTitle?: ReactNode;
}

/** 编辑器命令式句柄:通过 <Editor ref={ref} /> 取得,供 Provider 外部父组件调用 */
export interface EditorHandle {
  /** 获取当前画布全部数据快照(templates + elements) */
  getData(): { templates: EditorTemplate[]; elements: EditorElement[] };
}

/** 可视化拖拽编辑器(支持 ref 获取 EditorHandle) */
export const Editor: ForwardRefExoticComponent<EditorProps & RefAttributes<EditorHandle>>;

/** 纯渲染预览态(读 atoms,无编辑能力) */
export const Preview: FC<Record<string, never>>;

/** 默认组件树(可嵌入自定义 leftPanel 中组合使用) */
export const ComponentTree: FC<Record<string, never>>;

/** 默认属性面板(可嵌入自定义 rightPanel 中组合使用) */
export const PropertiesPanel: FC<Record<string, never>>;

/* ============================ useEditor Hook ============================ */

export interface AddElementArgs {
  type: string;
  x?: number;
  y?: number;
  parentId?: string | null;
  templateId?: string;
}

export interface useEditorReturn {
  elements: EditorElement[];
  selectedIds: string[];
  selectedElements: EditorElement[];
  canUndo: boolean;
  canRedo: boolean;
  templates: EditorTemplate[];
  activeTemplateId: string;
  templateColumns: number;
  addElement: (args: AddElementArgs) => void;
  updateElement: (args: { id: string; patch: Partial<EditorElement> }) => void;
  updateElements: (patches: Array<{ id: string } & Partial<EditorElement>>) => void;
  setElementUnit: (args: { id: string; unit: Unit }) => void;
  beginChange: () => void;
  deleteSelected: () => void;
  deleteElements: (ids: string[]) => void;
  toggleElementLock: (args: { id: string }) => void;
  renameElement: (args: { id: string; name: string }) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (dir: AlignDir) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  reorderZ: (args: { id: string; to: ZDir }) => void;
  addTemplate: (opts?: { basedOnId?: string }) => string;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  renameTemplate: (args: { id: string; name: string }) => void;
  setTemplateSize: (args: { id: string; width?: number; height?: number }) => void;
  setActiveTemplate: (id: string) => void;
  setTemplateColumns: (n: number) => void;
}

export function useEditor(): useEditorReturn;

/* ============================ 状态 atoms ============================ */

export const elementsAtom: PrimitiveAtom<EditorElement[]>;
export const selectedIdsAtom: PrimitiveAtom<string[]>;
export const selectedElementsAtom: Atom<EditorElement[]>;
export const viewportAtom: PrimitiveAtom<Viewport>;
export const zoomAtom: Atom<number>;
export const canvasWidthAtom: Atom<number>;
export const canvasHeightAtom: Atom<number>;
export const previewModeAtom: PrimitiveAtom<boolean>;
export const templatesAtom: PrimitiveAtom<EditorTemplate[]>;
export const activeTemplateIdAtom: PrimitiveAtom<string>;
export const templateColumnsAtom: PrimitiveAtom<number>;
export const DEFAULT_TEMPLATE_ID: string;

export const setElementsAtom: WritableAtom<null, [EditorElement[]]>;
export const addElementAtom: WritableAtom<null, [AddElementArgs]>;
export const updateElementAtom: WritableAtom<null, [{ id: string; patch: Partial<EditorElement> }]>;
export const updateElementsAtom: WritableAtom<
  null,
  [Array<{ id: string } & Partial<EditorElement>>]
>;
export const setElementUnitAtom: WritableAtom<null, [{ id: string; unit: Unit }]>;
export const deleteSelectedAtom: WritableAtom<null, []>;
export const deleteElementsAtom: WritableAtom<null, [string[]]>;
export const toggleElementLockAtom: WritableAtom<null, [{ id: string }]>;
export const renameElementAtom: WritableAtom<null, [{ id: string; name: string }]>;
export const groupSelectedAtom: WritableAtom<null, []>;
export const ungroupSelectedAtom: WritableAtom<null, []>;
export const alignSelectedAtom: WritableAtom<null, [AlignDir]>;
export const reorderZAtom: WritableAtom<null, [{ id: string; to: ZDir }]>;
export const reorderContainerAtom: WritableAtom<
  null,
  [{ parentId: string; activeId: string; overId: string; position: "left" | "right" }]
>;
export const moveElementToContainerAtom: WritableAtom<
  null,
  [{ elementId: string; targetContainerId: string }]
>;
export const undoAtom: WritableAtom<null, []>;
export const redoAtom: WritableAtom<null, []>;
export const clearCanvasAtom: WritableAtom<null, []>;
export const beginChangeAtom: WritableAtom<null, []>;
export const selectAtom: WritableAtom<null, [string[]]>;
export const toggleSelectAtom: WritableAtom<null, [string]>;
export const clearSelectionAtom: WritableAtom<null, []>;
export const setViewportAtom: WritableAtom<null, [Partial<Viewport>]>;
export const setZoomAtom: WritableAtom<null, [number]>;
export const setPreviewModeAtom: WritableAtom<null, [boolean]>;
export const addTemplateAtom: WritableAtom<null, [{ basedOnId?: string }?]>;
export const duplicateTemplateAtom: WritableAtom<null, [string]>;
export const deleteTemplateAtom: WritableAtom<null, [string]>;
export const renameTemplateAtom: WritableAtom<null, [{ id: string; name: string }]>;
export const setTemplateSizeAtom: WritableAtom<null, [{ id: string; width?: number; height?: number }]>;
export const setActiveTemplateAtom: WritableAtom<null, [string]>;
export const setTemplateColumnsAtom: WritableAtom<null, [number]>;

/* ============================ 工具函数 ============================ */

export function createElement(type: string, x?: number, y?: number): EditorElement;
export function getBounds(elements: EditorElement[]): Bounds | null;
export function expandGroupSelection(elements: EditorElement[], ids: string[]): string[];
export function toPercent(value: number, unit: Unit, canvasSize: number): number;
export function pxToUnit(px: number, unit: Unit, canvasSize: number): number;
export function toCss(value: number, unit: Unit): string;

/* ============================ 常量 ============================ */

export const UNIT: { readonly PX: "px"; readonly PERCENT: "%" };
export const CANVAS_WIDTH: number;
export const CANVAS_HEIGHT: number;
