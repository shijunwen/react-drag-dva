import { useRef, useCallback, useMemo, useState } from "react";
import InfiniteViewer from "react-infinite-viewer";
import { useAtomValue, useStore } from "jotai";
import { zoomAtom } from "../../atoms/viewport";
import { DEFAULT_TEMPLATE_ID } from "../../atoms/templates";
import { useEditor } from "../useEditor";
import { buildGroupedIds } from "../utils";
import MoveableLayer from "./MoveableLayer";
import BoardResizer from "./BoardResizer";
import Board from "./components/Board";
import RulerGuides from "./components/RulerGuides";
import ZoomBar from "./components/ZoomBar";
import MarqueeSelect from "./components/MarqueeSelect";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useGuidesSync } from "./hooks/useGuidesSync";
import { useDndBoardHitTest } from "./hooks/useDndBoardHitTest";
import { useSelectionCapture } from "./hooks/useSelectionCapture";
import { RULER_AREA_ABS_STYLE, SPACER_STYLE, ZOOM_RANGE, GRID_GAP } from "./canvasConstants";
import styles from "./Canvas.module.less";

// 稳定空数组:模板无顶层元素时作为 fallback,保持 Board props 引用稳定
const EMPTY_ARRAY = [];

/**
 * 画布组合层:持有共享 ref + 派生数据,组合视口/标尺/命中/选中逻辑 hooks,
 * 渲染标尺、多板网格、MoveableLayer 与底部控制条。业务逻辑见各 hook。
 */
export default function Canvas({ dndActive }) {
  const {
    elements,
    selectedIds,
    select,
    toggleSelect,
    templates,
    activeTemplateId,
    templateColumns,
    setActiveTemplate,
    duplicateTemplate,
    deleteTemplate,
    renameTemplate,
    setTemplateSize,
  } = useEditor();

  // 网格吸附:本地 UI 状态,MoveableLayer 与 ZoomBar 共用
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [gridSnapSize, setGridSnapSize] = useState(6);

  const viewerRef = useRef(null);
  const gridRef = useRef(null);
  const guidesHRef = useRef(null);
  const guidesVRef = useRef(null);
  const elementRefs = useRef(new Map());
  const moveableRef = useRef(null);
  const canvasWrapRef = useRef(null);
  // 唯一尺寸标签 DOM(选中/框选共用),由 useMoveableGestures / MarqueeSelect 命令式定位
  const sizeLabelRef = useRef(null);

  const zoom = useAtomValue(zoomAtom);
  const store = useStore();

  const {
    canDrag,
    panEnabled,
    togglePan,
    zoomIn,
    zoomOut,
    zoomReset,
    handleScroll,
    handlePinch,
    handleViewerDragStart,
  } = useCanvasViewport({ viewerRef, gridRef, dndActive, selectedIds });

  const { horizontalGuides, verticalGuides, onChangeGuidesH, onChangeGuidesV } = useGuidesSync({
    guidesHRef,
    guidesVRef,
    zoom,
    activeTemplateId,
    templates,
    templateColumns,
    store,
  });

  const pointerOverTemplateId = useDndBoardHitTest({ dndActive });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groupedIds = useMemo(() => buildGroupedIds(elements, selectedIds), [elements, selectedIds]);

  const handlePointerDownCapture = useSelectionCapture({
    elements,
    selectedSet,
    moveableRef,
    setActiveTemplate,
    select,
    toggleSelect,
  });

  const registerRef = useCallback((id, node) => {
    if (node) elementRefs.current.set(id, node);
    else elementRefs.current.delete(id);
  }, []);

  // 按模板分组顶层元素(容器内子元素由各自 ContainerBox 渲染)
  const topLevelByTemplate = useMemo(() => {
    const map = new Map();
    for (const el of elements) {
      if (el.parentId || el.hidden) continue;
      const tid = el.templateId ?? DEFAULT_TEMPLATE_ID;
      const arr = map.get(tid);
      if (arr) arr.push(el);
      else map.set(tid, [el]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.z || 0) - (b.z || 0));
    }
    return map;
  }, [elements]);

  const handleBoardRename = useCallback((id, name) => renameTemplate({ id, name }), [renameTemplate]);
  const handleBoardDuplicate = useCallback((id) => duplicateTemplate(id), [duplicateTemplate]);
  const handleBoardDelete = useCallback((id) => deleteTemplate(id), [deleteTemplate]);
  const handleBoardResize = useCallback(
    (id, width, height) => setTemplateSize({ id, width, height }),
    [setTemplateSize],
  );

  return (
    <div className={styles.canvas} ref={canvasWrapRef}>
      {/* 选中/框选的尺寸标签(唯一实例,命令式定位) */}
      <div ref={sizeLabelRef} className={styles.elementSizeLabel} />
      {/* 覆盖层用于显示辅助线 */}
      <RulerGuides
        zoom={zoom}
        horizontalGuides={horizontalGuides}
        verticalGuides={verticalGuides}
        onChangeGuidesH={onChangeGuidesH}
        onChangeGuidesV={onChangeGuidesV}
        guidesHRef={guidesHRef}
        guidesVRef={guidesVRef}
      />

      {/* 画布区域 */}
      <div className={styles.rulerArea} style={RULER_AREA_ABS_STYLE}>
        <div style={SPACER_STYLE} />
        <div className={styles.viewerArea}>
          <InfiniteViewer
            ref={viewerRef}
            className={`${styles.viewer} ${canDrag ? styles.grabbing : ""}`}
            useMouseDrag={canDrag}
            usePinch
            useWheelPinch
            useWheelScroll={!dndActive}
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
              ref={gridRef}
              className={styles.boardGrid}
              data-boards-grid
              style={{
                gridTemplateColumns: `repeat(${templateColumns}, max-content)`,
                gap: GRID_GAP,
                padding: GRID_GAP,
              }}
            >
              {templates.map((tpl) => (
                <Board
                  key={tpl.id}
                  template={tpl}
                  elements={topLevelByTemplate.get(tpl.id) ?? EMPTY_ARRAY}
                  selectedSet={selectedSet}
                  groupedIds={groupedIds}
                  registerRef={registerRef}
                  elementRefs={elementRefs}
                  active={activeTemplateId === tpl.id}
                  pointerOver={pointerOverTemplateId === tpl.id}
                  onPointerDownCapture={handlePointerDownCapture}
                  onRename={handleBoardRename}
                  onDuplicate={handleBoardDuplicate}
                  onDelete={handleBoardDelete}
                  horizontalGuides={activeTemplateId === tpl.id ? horizontalGuides : undefined}
                  verticalGuides={activeTemplateId === tpl.id ? verticalGuides : undefined}
                />
              ))}
              {/* MarqueeSelect 放在 gridRef 内部，让 react-selecto 自动取 gridRef 为 container */}
              <MarqueeSelect
                canvasWrapRef={canvasWrapRef}
                moveableRef={moveableRef}
                sizeLabelRef={sizeLabelRef}
                zoom={zoom}
                dndActive={dndActive}
                canDrag={canDrag}
              />
            </div>
            <MoveableLayer
              viewerRef={viewerRef}
              elementRefs={elementRefs}
              moveableRef={moveableRef}
              canvasWrapRef={canvasWrapRef}
              sizeLabelRef={sizeLabelRef}
              gridSnapEnabled={gridSnapEnabled}
              gridSnapSize={gridSnapSize}
              horizontalGuides={horizontalGuides}
              verticalGuides={verticalGuides}
            />
            {/* 无选中时:对激活板开启 resize(复用 react-moveable),与元素 moveable 互斥避免控制柄冲突 */}
            {!selectedIds.length && (
              <BoardResizer
                target={`[data-template-id="${activeTemplateId}"]`}
                templateId={activeTemplateId}
                zoom={zoom}
                onResizeSize={handleBoardResize}
              />
            )}
          </InfiniteViewer>
        </div>
      </div>

      {/* 底部居中控制条:光标坐标 + 缩放 + 网格吸附 + 画布拖拽 + 选中元素尺寸 */}
      <ZoomBar
        canvasWrapRef={canvasWrapRef}
        zoom={zoom}
        templates={templates}
        zoomOut={zoomOut}
        zoomReset={zoomReset}
        zoomIn={zoomIn}
        gridSnapEnabled={gridSnapEnabled}
        setGridSnapEnabled={setGridSnapEnabled}
        gridSnapSize={gridSnapSize}
        setGridSnapSize={setGridSnapSize}
        panEnabled={panEnabled}
        togglePan={togglePan}
        selectedIds={selectedIds}
        elements={elements}
      />
    </div>
  );
}
