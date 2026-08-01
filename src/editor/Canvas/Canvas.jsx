import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import InfiniteViewer from "react-infinite-viewer";
import { useDroppable } from "@dnd-kit/core";
import { useAtomValue, useSetAtom } from "jotai";
import { InputNumber } from "antd";
import { useEditor } from "../useEditor";
import { viewportAtom, setViewportAtom, setZoomAtom, setCanvasSizeAtom } from "@/atoms";
import CanvasElement from "./CanvasElement";
import MoveableLayer from "./MoveableLayer";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../constants";
import styles from "./Canvas.module.less";

export default function Canvas({ sortState, dndActive }) {
  // 空格键按下时才允许拖拽平移画布，避免与顶部拖入组件冲突
  const [spaceHeld, setSpaceHeld] = useState(false);
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

  const canDrag = spaceHeld && !dndActive;
  // 用 ref 同步存储 canDrag / dndActive，避免事件回调闭包读到过期的 state
  const canDragRef = useRef(canDrag);
  const dndActiveRef = useRef(dndActive);
  // InfiniteViewer 实例（需在使用前声明，避免 TDZ）
  const viewerRef = useRef(null);
  // 元素 id -> DOM 节点 映射，供 moveable 读取 target
  const elementRefs = useRef(new Map());
  // moveable 实例引用，用于判定是否点中控制柄
  const moveableRef = useRef(null);

  useEffect(() => {
    canDragRef.current = canDrag;
    dndActiveRef.current = dndActive;
  }, [canDrag, dndActive]);

  // 在 InfiniteViewer 根元素上注册原生捕获阶段 wheel 监听，
  // dnd-kit 拖拽中时阻止滚轮事件到达 InfiniteViewer 的 onWheel
  useEffect(() => {
    const el = viewerRef.current?.getContainer?.();
    if (!el) return;
    const handler = (e) => {
      if (window.__dndActive) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    el.addEventListener("wheel", handler, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, []);
  const { elements, selectedIds, select, toggleSelect, clearSelection } =
    useEditor();
  const { setNodeRef } = useDroppable({ id: "canvas-board" });
  const viewport = useAtomValue(viewportAtom);
  const setViewport = useSetAtom(setViewportAtom);
  const setZoom = useSetAtom(setZoomAtom);
  const setCanvasSize = useSetAtom(setCanvasSizeAtom);

  // 挂载后将画布滚动到视口中心
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || !viewerRef.current) return;
    const viewer = viewerRef.current;
    // InfiniteViewer 自带 scrollCenter，内部计算居中偏移
    requestAnimationFrame(() => {
      viewer.scrollCenter({ absolute: true });
      setViewport({
        scrollLeft: viewer.getScrollLeft(),
        scrollTop: viewer.getScrollTop(),
      });
      centeredRef.current = true;
    });
  }, [setViewport]);

  const registerRef = useCallback((id, node) => {
    if (node) elementRefs.current.set(id, node);
    else elementRefs.current.delete(id);
  }, []);

  // 仅渲染画布顶层元素（容器内的子元素由各自 ContainerBox 渲染）
  const topLevel = elements
    .filter((el) => !el.parentId)
    .sort((a, b) => (a.z || 0) - (b.z || 0));

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
    // 如果正在拖拽排序，不处理选中逻辑
    if (sortState !== null) return;
    // moveable 控制柄(缩放/旋转手柄)交给 moveable 自己处理
    if (moveableRef.current?.isMoveableElement(e.target)) return;
    // 缩放控制条不触发选中
    if (e.target.closest("[data-zoom-bar]")) return;

    const elNode = e.target.closest("[data-id]");
    if (!elNode) {
      clearSelection(); // 空白处清空选中
      return;
    }
    const id = elNode.dataset.id;
    // 检查元素是否在容器内
    const element = elements.find(el => el.id === id);
    if (element && element.parentId) {
      // 容器内的元素，直接选中，不做 moveable 接管处理
      // 拖拽排序由 dnd-kit 处理
      if (!selectedSet.has(id)) {
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
  }, [sortState, clearSelection, toggleSelect, select, selectedSet, elements]);

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
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(viewport.zoom + delta).toFixed(2)));
    setZoom(z);
    viewerRef.current?.setZoom(z);
  }, [viewport.zoom, setZoom]);
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

  // 画布尺寸设置
  const handleWidthChange = useCallback((v) => {
    if (v && v > 0) setCanvasSize({ width: v, height: viewport.canvasHeight });
  }, [viewport.canvasHeight, setCanvasSize]);
  const handleHeightChange = useCallback((v) => {
    if (v && v > 0) setCanvasSize({ width: viewport.canvasWidth, height: v });
  }, [viewport.canvasWidth, setCanvasSize]);

  return (
    <div className={styles.canvas}>
      <InfiniteViewer
        ref={viewerRef}
        className={`${styles.viewer} ${canDrag ? styles.grabbing : ""}`}
        useMouseDrag
        usePinch
        useWheelPinch
        useGesture
        useAutoZoom
        zoom={viewport.zoom}
        zoomRange={[MIN_ZOOM, MAX_ZOOM]}
        wheelScale={0.0015}
        onScroll={handleScroll}
        onPinch={handlePinch}
        onDragStart={(e) => {
          // dnd-kit 拖拽中（全局标记，同步可读）或非空格模式时阻止画布平移
          if (window.__dndActive || !canDragRef.current) return false;
          // 点中元素或控制条时也阻止
          const target = e.inputEvent?.target;
          if (target?.closest?.("[data-id]") || target?.closest?.("[data-zoom-bar]")) {
            return false;
          }
        }}
      >
        <div
          ref={setNodeRef}
          id="canvas-board-el"
          className={styles.board}
          style={{ width: viewport.canvasWidth, height: viewport.canvasHeight }}
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
              sortState={sortState}
            />
          ))}
        </div>
        <MoveableLayer elementRefs={elementRefs} moveableRef={moveableRef} />
      </InfiniteViewer>
      {/* 缩放 + 画布尺寸控制条 */}
      <div className={styles.zoomBar} data-zoom-bar>
        <div className={styles.sizeGroup}>
          <InputNumber
            size="small"
            min={100}
            max={10000}
            step={100}
            value={viewport.canvasWidth}
            onChange={handleWidthChange}
            addonAfter="W"
            controls={false}
          />
          <span className={styles.sizeSep}>×</span>
          <InputNumber
            size="small"
            min={100}
            max={10000}
            step={100}
            value={viewport.canvasHeight}
            onChange={handleHeightChange}
            addonAfter="H"
            controls={false}
          />
        </div>
        <span className={styles.divider} />
        <button type="button" className={styles.zoomBtn} onClick={zoomOut} aria-label="缩小">−</button>
        <button type="button" className={styles.zoomLabel} onClick={zoomReset}>
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button type="button" className={styles.zoomBtn} onClick={zoomIn} aria-label="放大">+</button>
      </div>
    </div>
  );
}
