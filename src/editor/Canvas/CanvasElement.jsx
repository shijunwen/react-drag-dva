import { memo } from "react";
import { ELEMENT_TYPES, getDef } from "../elements";
import ContainerBox from "./ContainerBox";
import styles from "./Canvas.module.less";

/** 渲染元素内部内容:基础类型走注册表 Content,容器特判(ContainerBox) */
function renderContent(el, elementRefs, registerRef, sortState) {
  if (el.type === ELEMENT_TYPES.CONTAINER) {
    return (
      <ContainerBox
        el={el}
        elementRefs={elementRefs}
        registerRef={registerRef}
        sortState={sortState}
      />
    );
  }
  const Content = getDef(el.type)?.Content;
  return Content ? <Content el={el} styles={styles} /> : null;
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
  sortState,
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

  return (
    <div
      ref={(node) => registerRef(el.id, node)}
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
      {renderContent(el, elementRefs, registerRef, sortState)}
    </div>
  );
});

export default CanvasElement;
