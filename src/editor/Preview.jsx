import { memo, useMemo } from "react";
import { useAtomValue } from "jotai";
import { elementsAtom, canvasWidthAtom, canvasHeightAtom } from "@/atoms";
import { ELEMENT_TYPES, getDef } from "./elements";
import { UNIT } from "./constants";
import { toPercent } from "./utils";
import styles from "./Preview.module.less";

/** 渲染元素内容(不带 dnd / moveable / 选中态):基础类型走注册表 Content,容器特判(PreviewContainer) */
function renderContent(el) {
  if (el.type === ELEMENT_TYPES.CONTAINER) {
    return <PreviewContainer el={el} />;
  }
  const Content = getDef(el.type)?.Content;
  return Content ? <Content el={el} styles={styles} /> : null;
}

/** 预览态容器：渲染子元素（流式布局，无排序/拖拽） */
function PreviewContainer({ el }) {
  const allElements = useAtomValue(elementsAtom);
  const canvasWidth = useAtomValue(canvasWidthAtom);
  const children = useMemo(
    () =>
      allElements
        .filter((c) => (c.parentId ?? null) === el.id && !c.hidden)
        .toSorted((a, b) => (a.z || 0) - (b.z || 0)),
    [allElements, el.id]
  );
  return (
    <div className={styles.container}>
      <div className={styles.containerContent}>
        {children.map((child) => {
          const unit = child.unit || UNIT.PX;
          const wPercent = toPercent(child.width, unit, canvasWidth);
          return (
            <div key={child.id} className={styles.childWrapper} style={{ width: `${wPercent}%`, height: `${child.height}px` }}>
              {renderContent(child)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 单个预览元素：x/width 统一换算为 %（px 值除以画布尺寸），y/height 用 px */
const PreviewElement = memo(function PreviewElement({ el, canvasWidth }) {
  const unit = el.unit || UNIT.PX;
  // 运行态：x/width 一律按 % 渲染（px 时换算），实现宽度自适应
  const xPercent = toPercent(el.x, unit, canvasWidth);
  const wPercent = toPercent(el.width, unit, canvasWidth);
  return (
    <div
      className={styles.element}
      style={{
        position: "absolute",
        left: `${xPercent}%`,
        top: `${el.y}px`,
        width: `${wPercent}%`,
        height: `${el.height}px`,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        display: el.hidden ? "none" : undefined,
      }}
    >
      {renderContent(el)}
    </div>
  );
});

/**
 * 预览组件：按配置态真实渲染画布内容。
 * x/width 统一按 % 渲染（px 自动换算），天然自适应容器宽度。
 * 高度固定为 canvasHeight。
 */
function PreviewInner() {
  const elements = useAtomValue(elementsAtom);
  const canvasWidth = useAtomValue(canvasWidthAtom);
  const canvasHeight = useAtomValue(canvasHeightAtom);

  const topLevel = useMemo(
    () =>
      elements
        .filter((el) => !el.parentId && !el.hidden)
        .toSorted((a, b) => (a.z || 0) - (b.z || 0)),
    [elements]
  );

  return (
    <div className={styles.previewWrap}>
      <div
        className={styles.previewBoard}
        style={{ width: "100%", height: canvasHeight }}
      >
        {topLevel.map((el) => (
          <PreviewElement key={el.id} el={el} canvasWidth={canvasWidth} />
        ))}
      </div>
    </div>
  );
}

export const Preview = memo(PreviewInner);
