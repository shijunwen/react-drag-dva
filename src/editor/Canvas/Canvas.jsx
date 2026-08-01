import { useRef, useCallback, useMemo, useState, useEffect, useLayoutEffect, memo } from "react";
import { flushSync } from "react-dom";
import InfiniteViewer from "react-infinite-viewer";
import Guides from "@scena/react-guides";
import { useDroppable } from "@dnd-kit/core";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { InputNumber, Tooltip } from "antd";
import { DragOutlined } from "@ant-design/icons";
import { useEditor } from "../useEditor";
import { viewportAtom, setViewportAtom, setZoomAtom, setCanvasSizeAtom, zoomAtom, canvasWidthAtom, canvasHeightAtom } from "@/atoms";
import CanvasElement from "./CanvasElement";
import MoveableLayer from "./MoveableLayer";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../constants";
import styles from "./Canvas.module.less";

/**
 * 辅助线数值偏移：
 * - 32px: 侧边 spacer 或顶部标尺高度
 * - 20px: viewerArea 的 padding(--space-5)
 * - +10px: 标尺对齐画板后的微调
 * 辅助线拖拽数值与画布坐标对齐所需的总偏移。
 */
const GUIDES_OFFSET = 62;

/**
 * 自适应缩放边距：画布四周预留像素，避免阴影/边框贴边被裁切。
 */
const FIT_PADDING = 40;

/**
 * 标尺配色与字体。canvas 无法读取 CSS 变量，此处与 tokens.less 中
 * --ruler-bg / --ruler-line / --ruler-text / --font-mono 保持一致。
 */
const RULER_THEME = {
  backgroundColor: "#f7f9fc",
  lineColor: "rgba(30, 41, 59, 0.12)",
  textColor: "#64748b",
  font: "10px 'IBM Plex Mono', Consolas, 'Liberation Mono', monospace",
};
// canvas 默认 inline 会引入基线间隙，block 填满容器
const RULER_STYLE = { display: "block", width: "100%", height: "100%" };
// 主刻度 100px、每主刻度 5 段(20px)，与画板工程网格(20/100)同频
const RULER_UNIT = 100;
const RULER_SEGMENT = 5;

// 提升到模块作用域的静态对象/数组：避免每次 render 产生新引用，
// 既能稳定子组件 prop 身份，也减少 GC 压力。
const RULER_AREA_ABS_STYLE = { position: "absolute", top: 32, left: 0, right: 0, bottom: 0 };
const SPACER_STYLE = { width: 32, flexShrink: 0 };
const ZOOM_RANGE = [MIN_ZOOM, MAX_ZOOM];
const INPUT_NUMBER_STYLE = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };

/**
 * 光标坐标显示。独立持有鼠标位置 state，使鼠标移动只重渲染本叶子组件，
 * 不再波及 Canvas 下的 InfiniteViewer/Guides/MoveableLayer 等重组件。
 * - 监听挂在 canvasWrap 上（与原 onMouseMove 等价）
 * - 落点坐标四舍五入后未变化则返回同一引用，React 跳过此次重渲染
 */
const CursorPos = memo(function CursorPos({ canvasWrapRef, zoom, canvasWidth, canvasHeight }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const onMove = (e) => {
      const board = document.getElementById("canvas-board-el");
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const x = Math.round(Math.max(0, Math.min(canvasWidth, (e.clientX - rect.left) / zoom)));
      const y = Math.round(Math.max(0, Math.min(canvasHeight, (e.clientY - rect.top) / zoom)));
      // 四舍五入后未变化则返回同一引用，React 跳过此次重渲染
      setPos((p) => (p.x === x && p.y === y ? p : { x, y }));
    };
    wrap.addEventListener("mousemove", onMove);
    return () => wrap.removeEventListener("mousemove", onMove);
  }, [canvasWrapRef, zoom, canvasWidth, canvasHeight]);

  return (
    <span className={styles.posLabel}>
      X: <span className={styles.posValue}>{pos.x}</span>
      &nbsp; Y: <span className={styles.posValue}>{pos.y}</span>
    </span>
  );
});

export default function Canvas({ dndActive }) {
  // 空格键按下时才允许拖拽平移画布，避免与顶部拖入组件冲突
  const [spaceHeld, setSpaceHeld] = useState(false);
  // zoomBar 画布拖拽开关：开启后可直接拖拽平移画布（无需按住空格），默认关闭
  const [panEnabled, setPanEnabled] = useState(false);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [gridSnapSize, setGridSnapSize] = useState(20);
  // 辅助线存储
  const [horizontalGuides, setHorizontalGuides] = useState([]);
  const [verticalGuides, setVerticalGuides] = useState([]);
  // 拖放过程中指针是否在画布板上方（可靠的手动命中测试）
  const [pointerOverBoard, setPointerOverBoard] = useState(false);

  const canDrag = (panEnabled || spaceHeld) && !dndActive;
  // 用 ref 同步存储 canDrag，避免事件回调闭包读到过期的 state
  const canDragRef = useRef(canDrag);
  // InfiniteViewer 实例（需在使用前声明，避免 TDZ）
  const viewerRef = useRef(null);
  // Guides 实例（水平、垂直）
  const guidesHRef = useRef(null);
  const guidesVRef = useRef(null);
  // 元素 id -> DOM 节点 映射，供 moveable 读取 target
  const elementRefs = useRef(new Map());
  // moveable 实例引用，用于判定是否点中控制柄
  const moveableRef = useRef(null);
  // 画布区域 ref，用于鼠标位置跟踪
  const canvasWrapRef = useRef(null);
  // 挂载后将画布滚动到视口中心
  const centeredRef = useRef(false);

  const { elements, selectedIds, select, toggleSelect, clearSelection } =
    useEditor();
  const { setNodeRef } = useDroppable({ id: "canvas-board" });
  // 只订阅渲染实际用到的字段：滚动(scrollLeft/Top)不在此处订阅，
  // 故平移/滚动不再触发 Canvas 重渲染（标尺同步改由 store.sub 驱动，见下）。
  const zoom = useAtomValue(zoomAtom);
  const canvasWidth = useAtomValue(canvasWidthAtom);
  const canvasHeight = useAtomValue(canvasHeightAtom);
  const store = useStore();
  const setViewport = useSetAtom(setViewportAtom);
  const setZoom = useSetAtom(setZoomAtom);
  const setCanvasSize = useSetAtom(setCanvasSizeAtom);

  /**
   * 同步 Guides 标尺/辅助线到当前画板屏幕位置（DOM 实测，任意缩放/平移下对齐）。
   * 抽成稳定回调：既被 useLayoutEffect（zoom/尺寸变更）调用，
   * 也被 store.sub 订阅（滚动变更）调用，共用同一份对齐逻辑。
   */
  const syncGuides = useCallback((zoomValue) => {
    const guidesH = guidesHRef.current;
    const guidesV = guidesVRef.current;
    if (!guidesH || !guidesV) return;
    // 测量屏幕上的位置:标尺 0 刻度对齐画板左上角
    const board = document.getElementById('canvas-board-el');
    if (!board) return;
    const bRect = board.getBoundingClientRect();
    const hRulerEl = guidesH.getRulerElement();
    const vRulerEl = guidesV.getRulerElement();
    if (!hRulerEl || !vRulerEl) return;
    const hRect = hRulerEl.getBoundingClientRect();
    const vRect = vRulerEl.getBoundingClientRect();

    // 标尺刻度:pos = (标尺边缘 - 画板边缘) / zoom，即标尺左/上边缘处的内容坐标。
    // 刻度值 v 落在画板内容 v 的屏幕位置上，任意缩放下都对齐(DOM 实测，自动涵盖
    // 侧栏 32px + viewerArea padding + 居中偏移)。
    const rulerScrollH = (hRect.left - bRect.left) / zoomValue;
    const rulerScrollV = (vRect.top - bRect.top) / zoomValue;
    guidesH.scroll(rulerScrollH, zoomValue);
    guidesV.scroll(rulerScrollV, zoomValue);

    // 辅助线:同样按 DOM 实测计算，使其在任意缩放下与画板对齐。
    // 对齐条件为 pos = guidesOffset + (标尺容器边缘 - 画板边缘) / zoom：
    // guidesOffset 是辅助线相对标尺原点的固定内容偏移需叠加，后一项把标尺容器原点
    // 换算到画板内容坐标。旧实现直接传 viewport.scrollTop/scrollLeft(内容坐标)，
    // 仅在 zoom=1 且画板恰好偏移 62px 时凑巧相等，缩放后辅助线会漂移。
    const guideScrollH = GUIDES_OFFSET + (hRect.top - bRect.top) / zoomValue;
    const guideScrollV = GUIDES_OFFSET + (vRect.left - bRect.left) / zoomValue;
    guidesH.scrollGuides(guideScrollH, zoomValue);
    guidesV.scrollGuides(guideScrollV, zoomValue);
  }, []);

  // React 驱动的变更（zoom / 画布尺寸）：Canvas 重渲染后在绘制前同步标尺。
  // useLayoutEffect 在绘制前运行，避免 Guides 用「新 zoom + 旧 scrollPos」重绘导致错位。
  useLayoutEffect(() => {
    syncGuides(zoom);
  }, [zoom, canvasWidth, canvasHeight, syncGuides]);

  // 平移/滚动驱动：viewportAtom 变化时同步触发标尺同步。
  // 订阅回调在 setViewport 期间同步执行，此时 InfiniteViewer 已滚动、DOM 已更新，
  // 早于 React 重渲染，无 1 帧滞后；Canvas 不订阅 scroll，故滚动不再引起重渲染。
  useEffect(() => {
    const sync = () => syncGuides(store.get(zoomAtom));
    sync(); // 订阅建立时同步一次
    return store.sub(viewportAtom, sync);
  }, [store, syncGuides]);

  useEffect(() => {
    const isEditable = (el) => {
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
    };
    const onKeyDown = (e) => {
      if (e.code === "Space" && !isEditable(document.activeElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    canDragRef.current = canDrag;
  }, [canDrag]);

  // 在 InfiniteViewer 根元素上注册原生捕获阶段 wheel 监听：
  // - dnd-kit 拖拽中时阻止滚轮事件到达 InfiniteViewer 的 onWheel
  // - 画布拖拽开关关闭时，阻止普通滚轮平移画布（保留 ctrl/meta+滚轮缩放）
  useEffect(() => {
    const el = viewerRef.current?.getContainer?.();
    if (!el) return;
    const handler = (e) => {
      if (window.__dndActive) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // 画布拖拽关闭时，阻止普通滚轮平移（保留 ctrl/meta+缩放）
      if (!canDragRef.current && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", handler, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, []);

  // 调色板拖拽进行中：用全局 pointermove 实时命中测试画板并高亮。
  // 不用 dnd-kit 的 isOver —— 画板处于 InfiniteViewer 的 zoom/pan 变换内，
  // 其碰撞检测不可靠（onDragEnd 也用手动 getBoundingClientRect 兜底，同理）。
  // DragOverlay 会拦截画布上的 mousemove，故监听挂在 document 上。
  useEffect(() => {
    if (!dndActive) {
      setPointerOverBoard(false);
      return;
    }
    const onMove = (e) => {
      const rect = document.getElementById("canvas-board-el")?.getBoundingClientRect();
      const inBoard =
        !!rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      // 在画板内但落在容器上时,交由容器高亮(容器是更内层放置目标),
      // 避免画板与容器同时高亮。选择器与 onDragEnd 兜底一致。
      const overContainer =
        inBoard &&
        [...document.querySelectorAll('[data-droppable-id^="container-"]')].some((el) => {
          const r = el.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        });
      const next = inBoard && !overContainer;
      // 仅在进出/切换时切换 state,避免指针移动时每帧重渲染
      setPointerOverBoard((prev) => (prev === next ? prev : next));
    };
    document.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("pointermove", onMove);
      setPointerOverBoard(false);
    };
  }, [dndActive]);

  /**
   * 动态计算缩放使画布完整可见且居中（contain）。
   * 取可视区与画布的宽高比最小值，上限 100%（画布小于视口时不放大，仅居中），
   * 留 FIT_PADDING 边距避免阴影/边框被裁切，最终 clamp 到缩放范围。
   */
  const fitToView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const container = viewer.getContainer?.();
    const viewW = container?.clientWidth ?? 0;
    const viewH = container?.clientHeight ?? 0;
    if (!viewW || !viewH || !canvasWidth || !canvasHeight) return;
    const raw = Math.min(
      (viewW - FIT_PADDING * 2) / canvasWidth,
      (viewH - FIT_PADDING * 2) / canvasHeight,
    );
    const fit = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(1, raw)));
    viewer.setZoom(fit);
    // setZoom 后需一帧让 InfiniteViewer 重新测量，再居中并同步视口
    requestAnimationFrame(() => {
      viewer.scrollCenter({ absolute: true });
      setViewport({
        zoom: fit,
        scrollLeft: viewer.getScrollLeft(),
        scrollTop: viewer.getScrollTop(),
      });
    });
  }, [canvasWidth, canvasHeight, setViewport]);

  // 默认进入：动态计算缩放使画布完整可见且居中，并初始化 Guides
  useEffect(() => {
    if (centeredRef.current || !viewerRef.current) return;
    centeredRef.current = true;
    requestAnimationFrame(() => {
      fitToView();
      // 初始化 Guides 尺寸（缩放/平移由上面 viewport 同步 effect 驱动）
      guidesHRef.current?.resize();
      guidesVRef.current?.resize();
    });
  // 仅挂载时执行一次:fitToView 闭包捕获首次渲染的 viewport(默认画布尺寸)，
  // 加入依赖会反复触发本 effect 导致画布漂移；ref 身份稳定无需加入。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 窗口 resize 时更新 Guides 尺寸
  useEffect(() => {
    const onResize = () => {
      guidesHRef.current?.resize();
      guidesVRef.current?.resize();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const registerRef = useCallback((id, node) => {
    if (node) elementRefs.current.set(id, node);
    else elementRefs.current.delete(id);
  }, []);

  // 仅渲染画布顶层元素（容器内的子元素由各自 ContainerBox 渲染）
  // 用 toSorted 保持不可变；memoize 避免每次 render（如鼠标移动）重算。
  const topLevel = useMemo(
    () => elements
      .filter((el) => !el.parentId && !el.hidden)
      .toSorted((a, b) => (a.z || 0) - (b.z || 0)),
    [elements],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groupedIds = useMemo(() => {
    const gIds = new Set();
    const selectedGroupIds = new Set();
    elements.forEach((e) => {
      if (e.groupId && selectedSet.has(e.id)) {
        selectedGroupIds.add(e.groupId);
      }
    });
    elements.forEach((e) => {
      if (e.groupId && selectedGroupIds.has(e.groupId)) {
        gIds.add(e.id);
      }
    });
    return gIds;
  }, [elements, selectedSet]);

  /**
   * 在捕获阶段处理：先于 moveable 的 gesto 决定选中状态。
   * 未选中元素：flushSync 同步选中 -> moveable 重新绑定 gesto -> 同一次 pointerdown
   * 继续传播到元素时被 gesto 接管，自然起手拖拽（含正确的释放）。
   */
  const handlePointerDownCapture = useCallback((e) => {
    // moveable 控制柄(缩放/旋转手柄)交给 moveable 自己处理
    if (moveableRef.current?.isMoveableElement(e.target)) return;
    // 缩放控制条不触发选中
    if (e.target.closest("[data-zoom-bar]")) return;
    // 点击标尺时不处理元素选中
    if (e.target.closest(".ruler-area")) return;

    const elNode = e.target.closest("[data-id]");
    if (!elNode) {
      clearSelection(); // 空白处清空选中
      return;
    }
    const id = elNode.dataset.id;
    // 检查元素是否在容器内
    const element = elements.find(el => el.id === id);
    if (element && element.parentId) {
      // 容器内元素：选中后由 moveable 接管拖拽（落地碰撞定归属/重排）
      if (e.shiftKey) {
        toggleSelect(id);
        e.stopPropagation();
        return;
      }
      if (!selectedSet.has(id) || !moveableRef.current) {
        flushSync(() => select([id]));
      }
      return;
    }
    // 顶层元素的处理逻辑
    if (e.shiftKey) {
      toggleSelect(id);
      e.stopPropagation(); // shift 仅增减选择，不触发拖拽
      return;
    }
    // 未选中 / moveable 尚未挂载：同步选中以便 moveable 接管本次拖拽
    if (!selectedSet.has(id) || !moveableRef.current) {
      flushSync(() => select([id]));
    }
  }, [clearSelection, toggleSelect, select, selectedSet, elements]);

  // InfiniteViewer 滚动/缩放回调：同步到 atom（供 moveable zoom + dnd-kit 坐标换算）
  const handleScroll = useCallback((e) => {
    setViewport({ scrollLeft: e.scrollLeft, scrollTop: e.scrollTop });
  }, [setViewport]);
  const handlePinch = useCallback((e) => {
    // OnPinch 事件只提供 zoom，scrollLeft/Top 需从实例读取
    const v = viewerRef.current;
    setViewport({
      zoom: e.zoom,
      scrollLeft: v?.getScrollLeft() ?? 0,
      scrollTop: v?.getScrollTop() ?? 0,
    });
  }, [setViewport]);

  // 缩放按钮：以视口中心为基准缩放
  const zoomBy = useCallback((delta) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(zoom + delta).toFixed(2)));
    setZoom(z);
    viewerRef.current?.setZoom(z);
  }, [zoom, setZoom]);
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy]);
  const zoomReset = useCallback(() => {
    const viewer = viewerRef.current;
    viewer?.setZoom(1);
    requestAnimationFrame(() => {
      viewer?.scrollCenter({ absolute: true });
      setViewport({
        zoom: 1,
        scrollLeft: viewer?.getScrollLeft() ?? 0,
        scrollTop: viewer?.getScrollTop() ?? 0,
      });
    });
  }, [setViewport]);

  // 画布拖拽开关切换
  const togglePan = useCallback(() => setPanEnabled((v) => !v), []);

  // 画布尺寸设置
  const handleWidthChange = useCallback((v) => {
    if (v && v > 0) setCanvasSize({ width: v, height: canvasHeight });
  }, [canvasHeight, setCanvasSize]);
  const handleHeightChange = useCallback((v) => {
    if (v && v > 0) setCanvasSize({ width: canvasWidth, height: v });
  }, [canvasWidth, setCanvasSize]);

  // 标尺辅助线变更：setState 身份稳定，空依赖即可稳定回调
  const handleChangeGuidesH = useCallback(({ guides }) => setHorizontalGuides(guides), []);
  const handleChangeGuidesV = useCallback(({ guides }) => setVerticalGuides(guides), []);

  // InfiniteViewer 画布平移起手判定：仅读 ref/window，无依赖，回调稳定
  const handleViewerDragStart = useCallback((e) => {
    // dnd-kit 拖拽中（全局标记，同步可读）或非空格模式时阻止画布平移
    if (window.__dndActive || !canDragRef.current) return false;
    // 点中元素或控制条时也阻止
    const target = e.inputEvent?.target;
    if (target?.closest?.("[data-id]") || target?.closest?.("[data-zoom-bar]")) {
      return false;
    }
  }, []);

  return (
    <div
      className={styles.canvas}
      ref={canvasWrapRef}
    >
      {/* 覆盖层用于显示辅助线 */}
      <div className={styles.guidesOverlay}>
        {/* 顶部标尺 */}
        <div className={styles.rulerTop}>
          <div className={styles.rulerCorner} />
          <div className={styles.rulerContent}>
            <Guides
              ref={guidesHRef}
              type="horizontal"
              zoom={zoom}
              unit={RULER_UNIT}
              segment={RULER_SEGMENT}
              rulerStyle={RULER_STYLE}
              guides={horizontalGuides}
              onChangeGuides={handleChangeGuidesH}
              guidesOffset={GUIDES_OFFSET}
              displayDragPos
              {...RULER_THEME}
            />
          </div>
        </div>

        <div className={styles.rulerArea}>
          {/* 左侧标尺 */}
          <div className={styles.rulerLeft}>
            <div className={styles.rulerContent}>
              <Guides
                ref={guidesVRef}
                type="vertical"
                zoom={zoom}
                unit={RULER_UNIT}
                segment={RULER_SEGMENT}
                rulerStyle={RULER_STYLE}
                guides={verticalGuides}
                onChangeGuides={handleChangeGuidesV}
                guidesOffset={GUIDES_OFFSET}
                displayDragPos
                {...RULER_THEME}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 画布区域 */}
      <div className={styles.rulerArea} style={RULER_AREA_ABS_STYLE}>
        <div style={SPACER_STYLE} />
        <div className={styles.viewerArea}>
          <InfiniteViewer
            ref={viewerRef}
            className={`${styles.viewer} ${canDrag ? styles.grabbing : ""}`}
            useMouseDrag
            usePinch
            useWheelPinch
            useWheelScroll={canDrag}
            useGesture
            useAutoZoom
            zoom={zoom}
            zoomRange={ZOOM_RANGE}
            wheelScale={0.0015}
            onScroll={handleScroll}
            onPinch={handlePinch}
            onDragStart={handleViewerDragStart}
          >
            <div
              ref={setNodeRef}
              id="canvas-board-el"
              className={`${styles.board}${pointerOverBoard ? ` ${styles.over}` : ""}`}
              style={{ width: canvasWidth, height: canvasHeight }}
              onPointerDownCapture={handlePointerDownCapture}
            >
              {topLevel.map((el) => (
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
            <MoveableLayer
              elementRefs={elementRefs}
              moveableRef={moveableRef}
              gridSnapEnabled={gridSnapEnabled}
              gridSnapSize={gridSnapSize}
            />
          </InfiniteViewer>
        </div>
      </div>

      {/* 缩放 + 画布尺寸控制条 */}
      <div className={styles.zoomBar} data-zoom-bar onPointerDownCapture={(e) => e.stopPropagation()}>
        <div className={styles.sizeGroup}>
          <CursorPos
            canvasWrapRef={canvasWrapRef}
            zoom={zoom}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
          <span className={styles.dividerInline} />
          <InputNumber
            size="small"
            min={100}
            max={10000}
            step={100}
            value={canvasWidth}
            onChange={handleWidthChange}
            addonAfter="W"
            controls={false}
            style={INPUT_NUMBER_STYLE}
          />
          <span className={styles.sizeSep}>×</span>
          <InputNumber
            size="small"
            min={100}
            max={10000}
            step={100}
            value={canvasHeight}
            onChange={handleHeightChange}
            addonAfter="H"
            controls={false}
            style={INPUT_NUMBER_STYLE}
          />
        </div>
        <span className={styles.divider} />
        <button type="button" className={styles.zoomBtn} onClick={zoomOut} aria-label="缩小">−</button>
        <button type="button" className={styles.zoomLabel} onClick={zoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={styles.zoomBtn} onClick={zoomIn} aria-label="放大">+</button>
        <span className={styles.divider} />
        <label className={styles.gridSnapToggle}>
          <input
            type="checkbox"
            checked={gridSnapEnabled}
            onChange={(e) => setGridSnapEnabled(e.target.checked)}
          />
          网格吸附
        </label>
        <InputNumber
          size="small"
          min={4}
          max={200}
          step={1}
          value={gridSnapSize}
          onChange={(v) => setGridSnapSize(v ?? 20)}
          disabled={!gridSnapEnabled}
          style={{ ...INPUT_NUMBER_STYLE, width: 72 }}
          addonAfter="px"
        />
        <span className={styles.divider} />
        <Tooltip title={panEnabled ? "关闭画布拖拽" : "开启画布拖拽"} placement="top">
          <button
            type="button"
            className={`${styles.zoomBtn}${panEnabled ? ` ${styles.zoomBtnActive}` : ""}`}
            onClick={togglePan}
            aria-label="画布拖拽"
            aria-pressed={panEnabled}
          >
            <DragOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
