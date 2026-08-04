/**
 * Canvas 专属常量:标尺/辅助线、网格、缩放等配置。
 * 供 Canvas.jsx、展示子组件与逻辑 hooks 共享,均为模块作用域稳定引用。
 */
import { MIN_ZOOM, MAX_ZOOM } from "../constants";

/**
 * 辅助线数值偏移：
 * - 32px: 侧边 spacer 或顶部标尺高度
 * - 20px: viewerArea 的 padding(--space-5)
 * - +10px: 标尺对齐画板后的微调
 * 辅助线拖拽数值与画布坐标对齐所需的总偏移。
 */
export const GUIDES_OFFSET = 62;

/** 自适应缩放边距：画布四周预留像素，避免阴影/边框贴边被裁切。 */
export const FIT_PADDING = 40;

/** 多板网格间距与内边距 */
export const GRID_GAP = 40;

/** 标尺配色与字体。canvas 无法读取 CSS 变量，此处与 tokens.less 中
 * --ruler-bg / --ruler-line / --ruler-text / --font-mono 保持一致。 */
export const RULER_THEME = {
  backgroundColor: "#f7f9fc",
  lineColor: "rgba(30, 41, 59, 0.12)",
  textColor: "#64748b",
  font: "10px 'IBM Plex Mono', Consolas, 'Liberation Mono', monospace",
};
// canvas 默认 inline 会引入基线间隙，block 填满容器
export const RULER_STYLE = { display: "block", width: "100%", height: "100%" };
// 主刻度 100px、每主刻度 5 段(20px)，与画板工程网格(20/100)同频
export const RULER_UNIT = 100;
export const RULER_SEGMENT = 5;

// 提升到模块作用域的稳定对象/数组：避免每次 render 产生新引用，
// 既能稳定子组件 prop 身份，也减少 GC 压力。
export const RULER_AREA_ABS_STYLE = { position: "absolute", top: 32, left: 0, right: 0, bottom: 0 };
export const SPACER_STYLE = { width: 32, flexShrink: 0 };
export const ZOOM_RANGE = [MIN_ZOOM, MAX_ZOOM];
export const INPUT_NUMBER_STYLE = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
