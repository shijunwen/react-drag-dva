import { memo, useCallback, useState, useEffect } from "react";
import Selecto from "react-selecto";
import { useStore, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  activeTemplateIdAtom,
  selectAtom,
  marqueeActiveAtom,
  DEFAULT_TEMPLATE_ID,
} from "@/atoms";
import { applySizeLabel } from "../moveableHelpers";
import { excludeDescendantsOfSelected } from "../../utils";
import styles from "../Canvas.module.less";

// 所有可选元素根节点都带 data-id(CanvasElement),作为 Selecto 的命中目标
const SELECTABLE_TARGETS = ["[data-id]"];

/**
 * 左键空白拖拽框选(react-selecto)。react-moveable 作者配套的 marquee 方案。
 *
 * 指针仲裁(dragCondition):仅空白画布左键拖拽起手框选;其余情况让路——
 *  - canDrag(空格平移 / 平移开关)/ dndActive(palette 拖拽):交给对应交互;
 *  - 点中 moveable 控制柄 / 元素 / 画板 chrome / 标尺 / 控制条:交给各自处理。
 *
 * 选中写入:onSelectEnd 把命中 DOM 映射为 id,过滤到当前激活模板(避免跨板误选),
 * 经 selectAtom(自动展开同组)-> selectedIdsAtom -> MoveableLayer 自动跟进,moveable 侧零改动。
 * Shift 拖拽 = 与当前选中求并集;普通拖拽 = 替换;空白单击 = 命中为空 -> select([]) 清空。
 *
 * 容器结构:
 *  - rootContainer = canvasWrapRef (整个画布区域,未变换,用于事件捕获与坐标基准)
 *  - container = 自动取 portalContainer.parentElement = gridRef (被变换的画布容器)
 * 这样 react-selecto 可以在两个坐标系间正确计算变换,选择框随画布缩放/滚动完美对齐。
 */
function MarqueeSelect({ canvasWrapRef, moveableRef, sizeLabelRef, zoom, dndActive, canDrag }) {
  const store = useStore();
  const select = useSetAtom(selectAtom);
  const setMarqueeActive = useSetAtom(marqueeActiveAtom);

  const [rootContainer, setRootContainer] = useState(null);

  // 跟踪 rootContainer，避免在渲染过程中直接访问 ref.current
  useEffect(() => {
    setRootContainer(canvasWrapRef.current);
  }, [canvasWrapRef]);

  // 框选尺寸标签:e.rect 为屏幕坐标(含 zoom),/ zoom 还原为逻辑尺寸。
  // 标签 DOM 收口在 applySizeLabel(非 hook),避免触发 react-hooks/immutability。
  const updateMarqueeLabel = useCallback(
    (rect) => {
      const show = !!rect && rect.width > 2 && rect.height > 2;
      const text = show ? `${Math.round(rect.width / zoom)}px × ${Math.round(rect.height / zoom)}px` : "";
      applySizeLabel(sizeLabelRef.current, canvasWrapRef.current, show ? rect : null, text, show);
    },
    [zoom, sizeLabelRef, canvasWrapRef],
  );

  // 真实拖拽才触发 dragStart(isClick 被过滤),故在此置位框选态;
  // selectEnd 时复位,确保 select() 已落地后再让 MoveableLayer 接管标签,避免闪烁旧选区。
  const onMarqueeDragStart = useCallback(() => {
    setMarqueeActive(true);
  }, [setMarqueeActive]);

  const onMarqueeDrag = useCallback(
    (e) => {
      updateMarqueeLabel(e.rect);
    },
    [updateMarqueeLabel],
  );

  const dragCondition = useCallback(
    (e) => {
      if (canDrag || dndActive) return false;
      const t = e.inputEvent?.target;
      if (!t?.closest) return false;
      if (moveableRef.current?.isMoveableElement(t)) return false;
      // 点中元素 / 画板 chrome / 标尺 / 控制条 -> 不框选
      if (t.closest("[data-id]")) return false;
      if (t.closest("[data-no-drag]")) return false;
      if (t.closest("[data-zoom-bar]")) return false;
      if (t.closest(".ruler-area")) return false;
      return true;
    },
    [canDrag, dndActive, moveableRef],
  );

  const onSelectEnd = useCallback(
    (e) => {
      const elements = store.get(elementsAtom);
      const activeTemplateId = store.get(activeTemplateIdAtom) ?? DEFAULT_TEMPLATE_ID;
      const byId = new Map(elements.map((el) => [el.id, el]));
      // 仅选当前激活模板的元素,避免跨板误选(多板横向排列时大框选可能扫到邻板)
      const hitIds = [];
      for (const node of e.selected) {
        const id = node.getAttribute("data-id");
        if (id && byId.get(id)?.templateId === activeTemplateId) hitIds.push(id);
      }
      // selectAtom 已内置 expandGroupSelection:命中分组成员会自动扩到整组
      if (e.inputEvent?.shiftKey) {
        const cur = store.get(selectedIdsAtom);
        const merged = [...new Set([...cur, ...hitIds])];
        // 容器与子孙不可并存于选中集:命中容器时其内部子组件不单独选中
        select(excludeDescendantsOfSelected(elements, merged));
      } else {
        select(excludeDescendantsOfSelected(elements, hitIds));
      }
      // 复位框选态:此时 select() 已落地,MoveableLayer 的 useEffect 会按新选区接管标签
      setMarqueeActive(false);
      applySizeLabel(sizeLabelRef.current, null, null, "", false);
    },
    [store, select, setMarqueeActive, sizeLabelRef],
  );

  // 等 rootContainer 准备好再渲染 Selecto
  if (!rootContainer) return null;

  return (
    <Selecto
      className={styles.marqueeSelect}
      // rootContainer = 未变换的画布基准容器
      rootContainer={rootContainer}
      // container = 自动取 portalContainer.parentElement = gridRef (被变换的画布容器)
      selectableTargets={SELECTABLE_TARGETS}
      hitRate={0}
      checkOverflow
      dragCondition={dragCondition}
      onDragStart={onMarqueeDragStart}
      onDrag={onMarqueeDrag}
      onSelectEnd={onSelectEnd}
    />
  );
}

// props 均为稳定 ref 或低频变更标志(canDrag/dndActive)，memo 阻断 Canvas 因
// elementsAtom/selectedIdsAtom 变更引起的重渲染波及至此
export default memo(MarqueeSelect);
