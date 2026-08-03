import { useState, useRef, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { useAtomValue, Provider } from "jotai";
import { useKeyPress } from "ahooks";
import Palette from "./Palette/Palette";
import Canvas from "./Canvas/Canvas";
import PropertiesPanel from "./PropertiesPanel/PropertiesPanel";
import ComponentTree from "./ComponentTree";
import { Preview } from "./Preview";
import { useEditor } from "./useEditor";
import { useEditorSync } from "./useEditorSync";
import { PALETTE_ITEM_MAP } from "./elements";
import { EditorPresenceContext } from "./editorPresence";
import { zoomAtom, selectedIdsAtom, previewModeAtom } from "@/atoms";
import styles from "./Editor.module.less";

const CONTAINER_PREFIX = "container-";

/**
 * 自定义碰撞检测：指针落在哪个 droppable 内，取面积最小（最内层）的那个。
 * 这样画布板与容器(嵌套)共存时，拖到容器上会命中容器而非画布。
 */
const pickInnermostDroppable = ({
  pointerCoordinates,
  droppableContainers,
  droppableRects,
}) => {
  if (!pointerCoordinates) return [];
  const { x, y } = pointerCoordinates;
  let best = null;
  for (const c of droppableContainers) {
    const rect = droppableRects.get(c.id);
    if (!rect) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const area = rect.width * rect.height;
      if (!best || area < best.area) best = { id: c.id, area };
    }
  }
  return best ? [{ id: best.id }] : [];
};

export default function Editor({ value, initialElements, onChange, children }) {
  // 每个实例独立 Jotai store:避免多个 <Editor/> 共享全局默认 store 而互相串扰。
  // children(如自定义工具栏)在 Provider 内渲染,可用 useEditor()/atoms 与本实例联动。
  // EditorPresenceContext 标记"已在 <Editor> 内",供 <DraggableElement> 等扩展组件自检。
  return (
    <Provider>
      <EditorPresenceContext.Provider value={true}>
        <EditorInner value={value} initialElements={initialElements} onChange={onChange}>
          {children}
        </EditorInner>
      </EditorPresenceContext.Provider>
    </Provider>
  );
}

function EditorInner({ value, initialElements, onChange, children }) {
  const { addElement, deleteSelected, undo, redo, copySelected, paste, duplicateSelected, nudgeSelected } = useEditor();
  // 受控/非受控同步:外部 value <-> 内部 elementsAtom
  useEditorSync({ value, initialElements, onChange });
  const zoom = useAtomValue(zoomAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const previewMode = useAtomValue(previewModeAtom);

  // 快捷键：Delete / Backspace 删除选中元素（输入框聚焦时不触发）
  const isEditable = useCallback((el) => {
    const tag = el?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
  }, []);
  useKeyPress(
    ["delete", "backspace"],
    () => {
      if (isEditable(document.activeElement)) return;
      if (selectedIds.length) deleteSelected();
    },
    { exactMatch: true },
  );
  // 撤销 Ctrl+Z
  useKeyPress(
    "ctrl.z",
    () => { if (!isEditable(document.activeElement)) undo(); },
    { exactMatch: false },
  );
  // 重做 Ctrl+Shift+Z 或 Ctrl+Y
  useKeyPress(
    ["ctrl.shift.z", "ctrl.y"],
    () => { if (!isEditable(document.activeElement)) redo(); },
    { exactMatch: false },
  );
  // 复制 Ctrl+C
  useKeyPress(
    "ctrl.c",
    () => { if (!isEditable(document.activeElement)) copySelected(); },
    { exactMatch: false },
  );
  // 粘贴 Ctrl+V
  useKeyPress(
    "ctrl.v",
    () => { if (!isEditable(document.activeElement)) paste(); },
    { exactMatch: false },
  );
  // 复制并偏移 Ctrl+D
  useKeyPress(
    "ctrl.d",
    () => { if (!isEditable(document.activeElement)) duplicateSelected(); },
    { exactMatch: false },
  );
  // 方向键微调 / Shift 快速微调
  useKeyPress(
    ["arrowup", "arrowdown", "arrowleft", "arrowright"],
    (e, key) => {
      if (isEditable(document.activeElement)) return;
      const step = e.shiftKey ? 10 : 1;
      if (!selectedIds.length) return;
      if (key === "arrowup") nudgeSelected({ dx: 0, dy: -step });
      if (key === "arrowdown") nudgeSelected({ dx: 0, dy: step });
      if (key === "arrowleft") nudgeSelected({ dx: -step, dy: 0 });
      if (key === "arrowright") nudgeSelected({ dx: step, dy: 0 });
    },
    { exactMatch: false },
  );

  const [activeType, setActiveType] = useState(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  // 6px 起拖阈值，避免点击误触发
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handlePointerMove = useCallback((e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleDragStart = useCallback((e) => {
    const dragType = e.active.data.current?.type;
    window.__dndActive = true;

    if (dragType) {
      // Palette 拖拽 - 拖入新元素
      setActiveType(dragType);
    } else {
      // 画布上已有元素的拖拽由 moveable 处理，不经 DndContext
      setActiveType(null);
    }

    pointerRef.current = {
      x: e.active.activatorEvent?.clientX ?? 0,
      y: e.active.activatorEvent?.clientY ?? 0,
    };
    document.addEventListener("pointermove", handlePointerMove);
  }, [handlePointerMove]);

  const handleDragEnd = useCallback((e) => {
    document.removeEventListener("pointermove", handlePointerMove);
    window.__dndActive = false;
    const { active, over } = e;

    if (!activeType) {
      setActiveType(null);
      return;
    }

    // Palette 拖拽结束
    const type = active.data.current?.type;
    const px = pointerRef.current.x;
    const py = pointerRef.current.y;

    // 优先使用 dnd-kit 的 over（碰撞检测命中）
    let overId = over ? String(over.id) : null;

    // 如果 dnd-kit 未命中任何 droppable，手动检测：鼠标是否在画布或容器内
    if (!overId) {
      // 检查容器（最内层优先）
      const containerEls = document.querySelectorAll('[data-droppable-id^="container-"]');
      let bestContainer = null;
      let bestArea = Infinity;
      containerEls.forEach(el => {
        const r = el.getBoundingClientRect();
        if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
          const area = r.width * r.height;
          if (area < bestArea) { bestArea = area; bestContainer = el; }
        }
      });
      if (bestContainer) {
        overId = bestContainer.getAttribute("data-droppable-id");
      } else {
        // 检查画布
        const boardEl = document.getElementById("canvas-board-el");
        const r = boardEl?.getBoundingClientRect();
        if (r && px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
          overId = "canvas-board";
        }
      }
    }

    if (overId && overId.startsWith(CONTAINER_PREFIX)) {
      // 拖入容器：作为容器内子元素（流式布局，不需要 x/y）
      addElement({ type, parentId: overId.slice(CONTAINER_PREFIX.length) });
    } else if (overId === "canvas-board") {
      // 拖入画布：以落点为中心放置顶层元素（x/y 均为像素）
      const def = PALETTE_ITEM_MAP[type];
      const boardEl = document.getElementById("canvas-board-el");
      const rect = boardEl?.getBoundingClientRect();
      if (rect) {
        const x = (px - rect.left) / zoom - def.defaults.width / 2;
        const y = (py - rect.top) / zoom - def.defaults.height / 2;
        addElement({ type, x, y });
      }
    }

    setActiveType(null);
  }, [activeType, addElement, handlePointerMove, zoom]);

  const handleDragCancel = useCallback(() => {
    document.removeEventListener("pointermove", handlePointerMove);
    window.__dndActive = false;
    setActiveType(null);
  }, [handlePointerMove]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pickInnermostDroppable}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.editor}>
        {children}
        {previewMode ? (
          <div className={styles.canvasWrap}>
            <Preview />
          </div>
        ) : (
          <>
            <Palette />
            <div className={styles.body}>
              <aside className={styles.treeSide}>
                <div className={styles.sideHeader}>组件树</div>
                <div className={styles.sideBody}>
                  <ComponentTree />
                </div>
              </aside>
              <div className={styles.canvasWrap}>
                <Canvas dndActive={!!activeType} />
              </div>
              <aside className={styles.side}>
                <div className={styles.sideHeader}>属性</div>
                <div className={styles.sideBody}>
                  <PropertiesPanel />
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeType ? (
          <div className={styles.overlay}>{PALETTE_ITEM_MAP[activeType]?.label}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
