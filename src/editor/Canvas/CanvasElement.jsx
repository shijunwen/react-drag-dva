import { memo, useCallback } from "react";
import { renderElementContent } from "../shared/ElementRenderer";
import { toCss } from "../../core/utils/unit";
import ContainerBox from "./ContainerBox";
import styles from "./Canvas.module.less";

/**
 * 单个画布元素。memo 化：仅当元素数据或选中态变化时重渲染。
 * - 顶层元素：绝对定位（left/top 由 x/y 驱动）
 * - 容器内元素：相对定位，由 flex 布局管理位置
 */
const CanvasElement = memo(function CanvasElement({
  el,
  selected,
  grouped,
  registerRef,
  elementRefs,
  isInContainer = false,
}) {
  const unit = el.unit || "px";
  // x/width 统一按 % 渲染（px 时换算），y/height 用 px
  const baseStyle = {
    width: toCss(el.width, unit),
    height: `${el.height}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  };

  // 顶层元素使用绝对定位
  const absoluteStyle = !isInContainer
    ? {
        ...baseStyle,
        position: "absolute",
        left: toCss(el.x, unit),
        top: `${el.y}px`,
      }
    : baseStyle;

  // 稳定 ref 回调:避免每次 render 内联新函数导致 React 先 ref(null) 再 ref(node),
  // 中间 elementRefs 短暂为空,moveable updateRect 会读到 null target(offsetWidth 报错)。
  const setRef = useCallback((node) => registerRef(el.id, node), [el.id, registerRef]);

  return (
    <div
      ref={setRef}
      data-id={el.id}
      data-in-container={isInContainer ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      className={`${styles.element}${selected ? ` ${styles.selected}` : ""}${grouped ? ` ${styles.grouped}` : ""}${isInContainer ? ` ${styles.inContainer}` : ""}`}
      style={absoluteStyle}
    >
      {renderElementContent(el, styles, (containerEl) => (
        <ContainerBox
          el={containerEl}
          elementRefs={elementRefs}
          registerRef={registerRef}
        />
      ))}
    </div>
  );
});

export default CanvasElement;
