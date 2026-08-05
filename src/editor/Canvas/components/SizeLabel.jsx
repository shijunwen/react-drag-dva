import { memo } from "react";
import styles from "../Canvas.module.less";

/**
 * 统一的尺寸显示组件:在选中元素下方显示宽高
 * 统一管理尺寸格式化和样式
 */
const SizeLabel = memo(function SizeLabel({ width, height, unit = "px" }) {
  const widthLabel = unit === "%" ? `${width}%` : `${width}px`;
  const heightLabel = `${height}px`;

  return (
    <div className={styles.elementSizeLabel}>
      {widthLabel} × {heightLabel}
    </div>
  );
});

export default SizeLabel;
