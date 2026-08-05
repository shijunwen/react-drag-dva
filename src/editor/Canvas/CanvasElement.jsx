import { memo, useCallback } from "react";
import { ELEMENT_TYPES, getDef } from "../elements";
import ContainerBox from "./ContainerBox";
import ElementErrorBoundary from "../ElementErrorBoundary";
import SizeLabel from "./components/SizeLabel";
import styles from "./Canvas.module.less";

/** 渲染元素内部内容:基础类型走注册表 Content,容器特判(ContainerBox) */
function renderContent(el, elementRefs, registerRef) {
  if (el.type === ELEMENT_TYPES.CONTAINER) {
    return (
      <ElementErrorBoundary resetKey={el.id}>
        <ContainerBox
          el={el}
          elementRefs={elementRefs}
          registerRef={registerRef}
        />
      </ElementErrorBoundary>
    );
  }
  const Content = getDef(el.type)?.Content;
  return Content ? (
    <ElementErrorBoundary resetKey={el.id}>
      <Content el={el} styles={styles} />
    </ElementErrorBoundary>
  ) : null;
}

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
    width: unit === "%" ? `${el.width}%` : `${el.width}px`,
    height: `${el.height}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  };

  // 顶层元素使用绝对定位
  const absoluteStyle = !isInContainer
    ? {
        ...baseStyle,
        position: "absolute",
        left: unit === "%" ? `${el.x}%` : `${el.x}px`,
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
      className={[
        styles.element,
        selected ? styles.selected : "",
        grouped ? styles.grouped : "",
        isInContainer ? styles.inContainer : "",
      ].join(" ")}
      style={absoluteStyle}
    >
      {renderContent(el, elementRefs, registerRef)}
      {/* 统一管理的尺寸标签 */}
      {selected && (
        <SizeLabel width={el.width} height={el.height} unit={el.unit} />
      )}
    </div>
  );
});

export default CanvasElement;
