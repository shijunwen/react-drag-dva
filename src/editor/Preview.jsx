import { memo, useMemo } from "react";
import { useAtomValue } from "jotai";
import { elementsAtom } from "../atoms/base";
import { templatesAtom, DEFAULT_TEMPLATE_ID } from "../atoms/templates";
import { renderElementContent } from "./shared/ElementRenderer";
import { getChildren } from "../core/utils/tree";
import { UNIT } from "./constants";
import { toCss, toPercent } from "./utils";
import styles from "./Preview.module.less";

const EMPTY = [];

/** 预览态容器：渲染子元素（流式布局，无排序/拖拽） */
function PreviewContainer({ el, templateWidth }) {
  const allElements = useAtomValue(elementsAtom);
  const children = useMemo(
    () => getChildren(allElements, el.id).filter((c) => !c.hidden),
    [allElements, el.id]
  );
  return (
    <div className={styles.container}>
      <div className={styles.containerContent}>
        {children.map((child) => {
          const unit = child.unit || UNIT.PX;
          const wPercent = toPercent(child.width, unit, templateWidth);
          return (
            <div key={child.id} className={styles.childWrapper} style={{ width: `${wPercent}%`, height: `${child.height}px` }}>
              {renderElementContent(child, styles, (containerEl) => (
                <PreviewContainer el={containerEl} templateWidth={templateWidth} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 单个预览元素：x/width 统一换算为 %（px 值除以画布尺寸），y/height 用 px */
const PreviewElement = memo(function PreviewElement({ el, templateWidth }) {
  const unit = el.unit || UNIT.PX;
  return (
    <div
      className={styles.element}
      style={{
        position: "absolute",
        left: toCss(el.x, unit),
        top: `${el.y}px`,
        width: toCss(el.width, unit),
        height: `${el.height}px`,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      }}
    >
      {renderElementContent(el, styles, (containerEl) => (
        <PreviewContainer el={containerEl} templateWidth={templateWidth} />
      ))}
    </div>
  );
});

/**
 * 预览组件：按配置态真实渲染各模板画布内容,纵向堆叠展示。
 * 每个模板用自身 width/height;x/width 的 % 换算基于该模板 width。
 */
function PreviewInner() {
  const elements = useAtomValue(elementsAtom);
  const templates = useAtomValue(templatesAtom);

  const byTemplate = useMemo(() => {
    const map = new Map();
    for (const el of elements) {
      if (el.parentId || el.hidden) continue;
      const tid = el.templateId ?? DEFAULT_TEMPLATE_ID;
      const arr = map.get(tid);
      if (arr) arr.push(el);
      else map.set(tid, [el]);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.z || 0) - (b.z || 0));
    return map;
  }, [elements]);

  return (
    <div className={styles.previewWrap}>
      {templates.map((tpl) => {
        const els = byTemplate.get(tpl.id) ?? EMPTY;
        return (
          <div
            key={tpl.id}
            className={styles.previewBoard}
            style={{ width: "100%", height: tpl.height }}
          >
            {els.map((el) => (
              <PreviewElement key={el.id} el={el} templateWidth={tpl.width} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const Preview = memo(PreviewInner);
