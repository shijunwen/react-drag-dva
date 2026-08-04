import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { useAtomValue, Provider } from "jotai";
import Palette from "./Palette/Palette";
import Canvas from "./Canvas/Canvas";
import PropertiesPanel from "./PropertiesPanel/PropertiesPanel";
import ComponentTree from "./ComponentTree";
import { Preview } from "./Preview";
import { useEditor } from "./useEditor";
import { useEditorSync } from "./useEditorSync";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { usePaletteDnd } from "./usePaletteDnd";
import { PALETTE_ITEM_MAP } from "./elements";
import { EditorPresenceContext } from "./editorPresence";
import { zoomAtom, selectedIdsAtom, previewModeAtom } from "@/atoms";
import styles from "./Editor.module.less";

/**
 * 自定义碰撞检测：指针落在哪个 droppable 内，取面积最小（最内层）的那个。
 * 这样画布板与容器(嵌套)共存时，拖到容器上会命中容器而非画布。
 */
const pickInnermostDroppable = ({ pointerCoordinates, droppableContainers, droppableRects }) => {
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

export default function Editor({ value, initialElements, onChange, initialTemplates, onTemplatesChange, children }) {
  // 每个实例独立 Jotai store:避免多个 <Editor/> 共享全局默认 store 而互相串扰。
  // children(如自定义工具栏)在 Provider 内渲染,可用 useEditor()/atoms 与本实例联动。
  // EditorPresenceContext 标记"已在 <Editor> 内",供 <DraggableElement> 等扩展组件自检。
  return (
    <Provider>
      <EditorPresenceContext.Provider value={true}>
        <EditorInner
          value={value}
          initialElements={initialElements}
          onChange={onChange}
          initialTemplates={initialTemplates}
          onTemplatesChange={onTemplatesChange}
        >
          {children}
        </EditorInner>
      </EditorPresenceContext.Provider>
    </Provider>
  );
}

function EditorInner({ value, initialElements, onChange, initialTemplates, onTemplatesChange, children }) {
  const { addElement, deleteSelected, undo, redo, copySelected, paste, duplicateSelected, nudgeSelected } = useEditor();
  // 受控/非受控同步:外部 value <-> 内部 elementsAtom
  useEditorSync({ value, initialElements, onChange, initialTemplates, onTemplatesChange });
  const zoom = useAtomValue(zoomAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const previewMode = useAtomValue(previewModeAtom);

  useEditorShortcuts({ selectedIds, deleteSelected, undo, redo, copySelected, paste, duplicateSelected, nudgeSelected });

  const { activeType, handleDragStart, handleDragEnd, handleDragCancel } = usePaletteDnd({ addElement, zoom });

  // 6px 起拖阈值，避免点击误触发
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
