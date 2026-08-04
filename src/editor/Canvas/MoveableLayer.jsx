import { memo } from "react";
import Moveable from "react-moveable";
import { useMoveableGestures } from "./hooks/useMoveableGestures";

/**
 * react-moveable 控制层(展示型)。手势逻辑见 useMoveableGestures。
 * 性能策略:手势过程中只写 DOM(零 React 重渲染),手势结束才提交到 atoms;
 * 仅订阅 elementsAtom/selectedIdsAtom/templatesAtom/zoomAtom(不订 past/future)。
 */
function MoveableLayer({ elementRefs, moveableRef, viewerRef, gridSnapEnabled, gridSnapSize }) {
  const { targets, isGroup, moveableProps } = useMoveableGestures({
    elementRefs,
    moveableRef,
    viewerRef,
    gridSnapEnabled,
    gridSnapSize,
  });

  if (!targets.length) return null;

  return (
    <Moveable
      ref={moveableRef}
      target={isGroup ? targets : targets[0]}
      {...moveableProps}
    />
  );
}

// props 均为稳定 ref(elementRefs/moveableRef/viewerRef)，memo 阻断父级 Canvas
// 重渲染(如鼠标移动)波及至此；自身仍随 elementsAtom/selectedIdsAtom 更新。
export default memo(MoveableLayer);
