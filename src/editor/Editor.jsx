import { forwardRef, useImperativeHandle } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { useAtomValue, useStore, Provider } from "jotai";
import Palette from "./Palette/Palette";
import Canvas from "./Canvas/Canvas";
import PropertiesPanel from "./PropertiesPanel/PropertiesPanel";
import ComponentTree from "./ComponentTree";
import { Preview } from "./Preview";
import { useEditorSync } from "./useEditorSync";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useElementActions } from "./useElementActions";
import { useHistoryActions } from "./useHistoryActions";
import { usePaletteDnd } from "./usePaletteDnd";
import { PALETTE_ITEM_MAP } from "./elements";
import { EditorPresenceContext } from "./editorPresence";
import { elementsAtom } from "../atoms/base";
import { previewModeAtom } from "../atoms/preview";
import { selectedIdsAtom } from "../atoms/selection";
import { templatesAtom } from "../atoms/templates";
import { zoomAtom } from "../atoms/viewport";
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

/**
 * 编辑器命令式句柄(类型仅用于 TS,运行时无此导出)。
 * 通过 <Editor ref={ref} /> 取得 ref.current.getData() -> { templates, elements }。
 */
const Editor = forwardRef(function Editor(
  {
    value,
    initialElements,
    onChange,
    initialTemplates,
    onTemplatesChange,
    leftPanel,
    leftPanelTitle,
    rightPanel,
    rightPanelTitle,
    children,
  },
  ref,
) {
  // 每个实例独立 Jotai store:避免多个 <Editor/> 共享全局默认 store 而互相串扰。
  // children(如自定义工具栏)在 Provider 内渲染,可用 useEditor()/atoms 与本实例联动。
  // EditorPresenceContext 标记"已在 <Editor> 内",供 <DraggableElement> 等扩展组件自检。
  return (
    <Provider>
      <EditorPresenceContext.Provider value={true}>
        <EditorInner
          ref={ref}
          value={value}
          initialElements={initialElements}
          onChange={onChange}
          initialTemplates={initialTemplates}
          onTemplatesChange={onTemplatesChange}
          leftPanel={leftPanel}
          leftPanelTitle={leftPanelTitle}
          rightPanel={rightPanel}
          rightPanelTitle={rightPanelTitle}
        >
          {children}
        </EditorInner>
      </EditorPresenceContext.Provider>
    </Provider>
  );
});

export default Editor;

const EditorInner = forwardRef(function EditorInner(
  {
    value,
    initialElements,
    onChange,
    initialTemplates,
    onTemplatesChange,
    leftPanel,
    leftPanelTitle,
    rightPanel,
    rightPanelTitle,
    children,
  },
  ref,
) {
  const { addElement, deleteSelected, copySelected, paste, duplicateSelected, nudgeSelected } = useElementActions();
  const { undo, redo } = useHistoryActions();
  // 受控/非受控同步:外部 value <-> 内部 elementsAtom
  useEditorSync({ value, initialElements, onChange, initialTemplates, onTemplatesChange });
  const store = useStore();
  // 暴露 getData():读取本实例 store 的最新 templates/elements(不订阅,无重渲染开销)
  useImperativeHandle(
    ref,
    () => ({
      getData: () => ({
        templates: store.get(templatesAtom),
        elements: store.get(elementsAtom),
      }),
    }),
    [store],
  );
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
                {leftPanelTitle !== null && (
                  <div className={styles.sideHeader}>{leftPanelTitle ?? "组件树"}</div>
                )}
                {leftPanel !== undefined ? (
                  leftPanel
                ) : (
                  <div className={styles.sideBody}>
                    <ComponentTree />
                  </div>
                )}
              </aside>
              <div className={styles.canvasWrap}>
                <Canvas dndActive={!!activeType} />
              </div>
              <aside className={styles.side}>
                {rightPanelTitle !== null && (
                  <div className={styles.sideHeader}>{rightPanelTitle ?? "属性"}</div>
                )}
                {rightPanel !== undefined ? (
                  rightPanel
                ) : (
                  <div className={styles.sideBody}>
                    <PropertiesPanel />
                  </div>
                )}
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
});
