import { memo, useRef, useEffect } from "react";
import Moveable from "react-moveable";
import { useAtomValue } from "jotai";
import { viewportAtom } from "../../atoms/viewport";
import { GET_SCROLL_POSITION } from "./moveableHelpers";

// 仅保留右/下/右下角手柄(板锚定左上角,从右下方向缩放)
const RENDER_DIRECTIONS = ["e", "s", "se"];

/**
 * 画板尺寸调整层:复用 react-moveable,对激活模板画板开启 resize。
 * 仅 resizable(不可拖拽/旋转/吸附),手柄为右/下/右下角。
 * 拖拽中直接写 DOM(零 React 重渲染),释放时一次性提交到模板尺寸 atom,
 * 与 MoveableLayer 的元素拖拽策略一致。
 * 仅在无元素选中时挂载,避免与元素 moveable 的控制柄冲突。
 */
const BoardResizer = memo(function BoardResizer({ target, templateId, zoom, onResizeSize }) {
  const moveableRef = useRef(null);
  const pendingRef = useRef(null);
  // 订阅 viewport 滚动变化(非 zoom)来更新控制框位置
  const { scrollLeft, scrollTop } = useAtomValue(viewportAtom);

  // zoom / 激活板 / 滚动位置变化后重算控制框位置
  useEffect(() => {
    if (moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, templateId, scrollLeft, scrollTop]);

  if (!target) return null;

  return (
    <Moveable
      ref={moveableRef}
      target={target}
      resizable
      draggable={false}
      rotatable={false}
      snappable={false}
      zoom={zoom}
      renderDirections={RENDER_DIRECTIONS}
      // 保持原 scrollContainer 以禁用拖拽期间自动滚动
      scrollContainer="[data-boards-grid]"
      getScrollPosition={GET_SCROLL_POSITION}
      // 不显示中心点
      origin={false}
      onResize={(e) => {
        e.target.style.width = `${e.width}px`;
        e.target.style.height = `${e.height}px`;
        pendingRef.current = { width: Math.round(e.width), height: Math.round(e.height) };
      }}
      onResizeEnd={() => {
        const p = pendingRef.current;
        if (p) onResizeSize(templateId, p.width, p.height);
        pendingRef.current = null;
      }}
    />
  );
});

export default BoardResizer;
