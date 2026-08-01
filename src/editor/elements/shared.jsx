import { ColorPicker } from "antd";

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

/** 矩形/圆形共用的属性编辑器:填充色选择。styles 由 PropertiesPanel 注入。 */
export function FillProps({ el, update, styles }) {
  return (
    <label className={styles.fieldFull}>
      <span className={styles.label}>填充颜色</span>
      <ColorPicker
        size="small"
        value={el.props.fill}
        onChangeComplete={(c) => update({ props: { fill: c.toHexString() } })}
      />
    </label>
  );
}
