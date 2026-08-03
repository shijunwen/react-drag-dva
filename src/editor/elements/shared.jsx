/**
 * 矩形/圆形共用的内容渲染:填充色 shape,仅 borderRadius 不同。
 * styles 由调用方注入(editor 用 Canvas.module.less,preview 用 Preview.module.less)。
 */
export function ShapeContent({ el, styles, radius }) {
  return (
    <div
      className={styles.shape}
      style={{ background: el.props.fill, borderRadius: radius }}
    />
  );
}
