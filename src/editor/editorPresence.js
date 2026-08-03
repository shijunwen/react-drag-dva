import { createContext } from "react";

/**
 * Editor 存在性上下文:由 <Editor> 在其子树提供(true)。
 * 供需要 DndContext 的扩展组件(如 <DraggableElement>)在渲染前自检:
 * 若脱离 <Editor> 使用,可抛出明确错误,而非让 dnd-kit 报一个泛化异常。
 */
export const EditorPresenceContext = createContext(false);
