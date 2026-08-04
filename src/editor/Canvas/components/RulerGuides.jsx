import { memo } from "react";
import Guides from "@scena/react-guides";
import {
  GUIDES_OFFSET,
  RULER_THEME,
  RULER_STYLE,
  RULER_UNIT,
  RULER_SEGMENT,
} from "../canvasConstants";
import styles from "../Canvas.module.less";

/**
 * 标尺 / 辅助线覆盖层:顶部水平标尺 + 左侧垂直标尺 + 角。
 * 纯展示:状态与同步逻辑见 useGuidesSync。
 */
const RulerGuides = memo(function RulerGuides({
  zoom,
  horizontalGuides,
  verticalGuides,
  onChangeGuidesH,
  onChangeGuidesV,
  guidesHRef,
  guidesVRef,
}) {
  return (
    <div className={styles.guidesOverlay}>
      {/* 顶部标尺 */}
      <div className={styles.rulerTop}>
        <div className={styles.rulerCorner} />
        <div className={styles.rulerContent}>
          <Guides
            ref={guidesHRef}
            type="horizontal"
            zoom={zoom}
            unit={RULER_UNIT}
            segment={RULER_SEGMENT}
            rulerStyle={RULER_STYLE}
            guides={horizontalGuides}
            onChangeGuides={onChangeGuidesH}
            guidesOffset={GUIDES_OFFSET}
            displayDragPos
            {...RULER_THEME}
          />
        </div>
      </div>

      <div className={styles.rulerArea}>
        {/* 左侧标尺 */}
        <div className={styles.rulerLeft}>
          <div className={styles.rulerContent}>
            <Guides
              ref={guidesVRef}
              type="vertical"
              zoom={zoom}
              unit={RULER_UNIT}
              segment={RULER_SEGMENT}
              rulerStyle={RULER_STYLE}
              guides={verticalGuides}
              onChangeGuidesV={onChangeGuidesV}
              guidesOffset={GUIDES_OFFSET}
              displayDragPos
              {...RULER_THEME}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default RulerGuides;
