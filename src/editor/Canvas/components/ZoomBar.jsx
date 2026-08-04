import { memo } from "react";
import { InputNumber, Tooltip } from "antd";
import { DragOutlined } from "@ant-design/icons";
import CursorPos from "./CursorPos";
import { INPUT_NUMBER_STYLE } from "../canvasConstants";
import styles from "../Canvas.module.less";

/**
 * 底部居中控制条:光标坐标 + 缩放 + 网格吸附 + 画布拖拽。
 * 纯展示:各 handler/state 由 Canvas 通过 props 注入。
 */
const ZoomBar = memo(function ZoomBar({
  canvasWrapRef,
  zoom,
  templates,
  zoomOut,
  zoomReset,
  zoomIn,
  gridSnapEnabled,
  setGridSnapEnabled,
  gridSnapSize,
  setGridSnapSize,
  panEnabled,
  togglePan,
}) {
  return (
    <div className={styles.zoomBar} data-zoom-bar onPointerDownCapture={(e) => e.stopPropagation()}>
      <CursorPos canvasWrapRef={canvasWrapRef} zoom={zoom} templates={templates} />
      <span className={styles.divider} />
      <button type="button" className={styles.zoomBtn} onClick={zoomOut} aria-label="缩小">−</button>
      <button type="button" className={styles.zoomLabel} onClick={zoomReset}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={styles.zoomBtn} onClick={zoomIn} aria-label="放大">+</button>
      <span className={styles.divider} />
      <label className={styles.gridSnapToggle}>
        <input
          type="checkbox"
          checked={gridSnapEnabled}
          onChange={(e) => setGridSnapEnabled(e.target.checked)}
        />
        网格吸附
      </label>
      <InputNumber
        size="small"
        min={4}
        max={200}
        step={1}
        value={gridSnapSize}
        onChange={(v) => setGridSnapSize(v ?? 20)}
        disabled={!gridSnapEnabled}
        style={{ ...INPUT_NUMBER_STYLE, width: 72 }}
        addonAfter="px"
      />
      <span className={styles.divider} />
      <Tooltip title={panEnabled ? "关闭画布拖拽" : "开启画布拖拽"} placement="top">
        <button
          type="button"
          className={`${styles.zoomBtn}${panEnabled ? ` ${styles.zoomBtnActive}` : ""}`}
          onClick={togglePan}
          aria-label="画布拖拽"
          aria-pressed={panEnabled}
        >
          <DragOutlined />
        </button>
      </Tooltip>
    </div>
  );
});

export default ZoomBar;
