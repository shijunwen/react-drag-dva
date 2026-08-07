import { useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { elementsAtom } from "../../../atoms/base";
import { selectedIdsAtom, dragOverContainerIdAtom, marqueeActiveAtom } from "../../../atoms/selection";
import { zoomAtom, viewportAtom } from "../../../atoms/viewport";
import { templatesAtom, DEFAULT_TEMPLATE_ID } from "../../../atoms/templates";
import { dropElementAtom } from "../../../atoms/elements/reorder";
import { pxToUnit } from "../../../core/utils/unit";
import { ELEMENT_TYPES } from "../../../core/ElementTypes";
import {
  round,
  applyToDom,
  lockScrollAncestors,
  unlockScrollAncestors,
  buildRotationTransform,
  formatSizeLabel,
  SNAP_DIST_FORMAT,
  GET_SCROLL_POSITION,
} from "../moveableHelpers";
import { findDropContainer, resolveDrop } from "../dropLogic";
import { useMoveableTargets } from "./useMoveableTargets";
import { useMoveableSnap } from "./useMoveableSnap";
import { useMoveableCommit } from "./useMoveableCommit";
import { useMoveableSizeLabel } from "./useMoveableSizeLabel";

/**
 * react-moveable 手势逻辑层(装配层,从 MoveableLayer 抽出)。
 * 原单文件拆分为 4 个子 hook,职责边界:
 * - useMoveableTargets:选中 -> targets / isGroup / 容器归属
 * - useMoveableSnap:吸附参考线 / 网格 / 吸附阈值 / 模板尺寸换算
 * - useMoveableCommit:手势生命周期(pin 滚动 / begin 记历史 / commit 提交)
 * - useMoveableSizeLabel:尺寸标签的定位与刷新
 * 本文件只负责订阅 atoms、组合子 hook 与手势 handlers,产出 moveableProps。
 *
 * 性能策略不变:手势过程中只写 DOM(零 React 重渲染),手势结束才一次性提交到 atoms;
 * beginChange 延迟到首次位移。
 *
 * 订阅边界不变:直接订阅 elementsAtom/selectedIdsAtom/templatesAtom/zoomAtom,
 * 不走 useEditor(避免订 pastAtom/futureAtom 导致每手势一次的无谓重渲染)。
 *
 * 返回 { targets, isGroup, moveableProps }。targets 为空时 moveableProps 为 null
 * (MoveableLayer 据此不渲染 <Moveable>),与原 if(!targets.length) return null 等价。
 */
export function useMoveableGestures({ elementRefs, moveableRef, viewerRef, canvasWrapRef, sizeLabelRef, gridSnapEnabled, gridSnapSize, horizontalGuides, verticalGuides }) {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const templates = useAtomValue(templatesAtom);
  const zoom = useAtomValue(zoomAtom);
  const marqueeActive = useAtomValue(marqueeActiveAtom);
  const { scrollLeft, scrollTop } = useAtomValue(viewportAtom);
  const dropElement = useSetAtom(dropElementAtom);
  const setDragOverId = useSetAtom(dragOverContainerIdAtom);

  // id -> element 的 O(1) 索引,替换拖拽/缩放热路径中的 elements.find(每帧多次)
  const elementsById = useMemo(() => {
    const m = new Map();
    for (const el of elements) m.set(el.id, el);
    return m;
  }, [elements]);

  // 拖拽专用 refs
  const dragCtxRef = useRef(null); // 拖拽上下文：{ mode: "top"|"container", id, parentId? }
  const scrollLockRef = useRef([]); // 拖拽期间锁定的可滚祖先(用于恢复)
  const dragOverRef = useRef(null); // 当前悬停的容器 id(去重用,避免每帧写 atom 触发重渲染)

  const { targets, isGroup, hasLockedSelected, parentId, firstTemplateId, isInContainer } =
    useMoveableTargets({ selectedIds, elements, elementRefs });

  const {
    elementGuidelines,
    rulerGuideElements,
    snapGridWidth,
    snapGridHeight,
    snappable,
    snapThreshold,
    sizeFor,
  } = useMoveableSnap({
    templates,
    elements,
    selectedIds,
    elementRefs,
    parentId,
    firstTemplateId,
    isInContainer,
    horizontalGuides,
    verticalGuides,
    gridSnapEnabled,
    gridSnapSize,
  });

  const { pinViewerScroll, unpinViewerScroll, begin, commitSingle, commitGroup, pendingRef, dirtyRef } =
    useMoveableCommit({ viewerRef, moveableRef, zoom, elements, scrollLeft, scrollTop });

  const { updateSelectionLabel } = useMoveableSizeLabel({
    sizeLabelRef,
    canvasWrapRef,
    targets,
    selectedIds,
    elementsById,
    zoom,
    marqueeActive,
    elements,
    scrollLeft,
    scrollTop,
  });

  // 容器 id 列表(拖拽命中测试只遍历容器,不扫描全部元素)
  const containerIds = useMemo(
    () => elements.filter((e) => e.type === ELEMENT_TYPES.CONTAINER).map((e) => e.id),
    [elements],
  );

  if (!targets.length) {
    return { targets, isGroup, moveableProps: null };
  }

  // 单选均可拖;多选仅顶层(容器内多选仅 resize)
  const draggable = !hasLockedSelected && !(isGroup && isInContainer);
  const resizable = !hasLockedSelected;
  const rotatable = !hasLockedSelected;

  const updateDragOver = (target, el) => {
    const tRect = target.getBoundingClientRect();
    const best = findDropContainer(tRect, el.id, containerIds, elementRefs);
    const nextId = best ? best.id : null;
    if (dragOverRef.current !== nextId) {
      dragOverRef.current = nextId;
      setDragOverId(nextId);
    }
  };

  // 单选/多选手势互斥:react-moveable 在 group 模式下会同时派发 onDrag* 与 onDragGroup*
  // (onDragEnd 先于 onDragGroupEnd 触发)。若不隔离,onDragEnd 的 commitSingle 会先提交
  // 首个元素并清空 dirty,致 onDragGroupEnd 的 commitGroup 被跳过——多选拖拽后其余元素
  // 位置数据未提交,单独拖拽时读到旧 x/y 瞬移回拖拽前位置。故单选处理器须以 !isGroup 屏蔽。
  // onResizeEnd/onRotateEnd 同理(分组缩放/旋转也会先触发单选 end)。
  const singleDrag = draggable && !isGroup;
  const singleRotate = rotatable && !isGroup;

  const moveableProps = {
    draggable,
    resizable,
    rotatable,
    snappable,
    snapGridWidth,
    snapGridHeight,
    // snapGridAll 仅对分组(moveables)生效:开启时 moveable 按「组包围盒 / 最小子元素或
    // 间隙」算 rectRatio(line 5212)并乘到 snapGrid{Width,Height} 上(line 5258 multiples)。
    // 分组内若有小元素/小间隙,该倍数急剧放大,有效网格达数百 px,缩放时直接跳到极小
    // 余值(如 5px)即高度坍塌。关闭后分组改用基础网格吸附(包围盒按 snapGridSize 对齐),
    // 不再算倍数,坍塌消除;单元素本就不走该分支,不受影响。
    snapGridAll: false,
    snapThreshold,
    elementGuidelines: [...elementGuidelines, ...rulerGuideElements],
    isDisplaySnapDigit: true,
    // 显示拖拽元素与"内部参考线"(如画板边缘,元素被画板包围)之间的距离。
    // 默认 false 仅展示元素间的间距;开启后画板四边 + 标尺辅助线等才能显示距离数字。
    isDisplayInnerSnapDigit: true,
    snapDigit: 0,
    snapDistFormat: SNAP_DIST_FORMAT,
    zoom,
    // 四角圆点 + 四边整边:edge=true 让 n/e/s/w 渲染为整条可拖拽边线(而非中点小圆点),
    // 配合 moveable.less 的 .moveable-edge ::before 扩展命中区,实现整边缩放。
    renderDirections: ['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'],
    edge: true,
    // 显式关闭等比缩放。单选时 moveable 默认 keepRatio 已是 false;但多选/分组时
    // react-moveable 内部改用 MoveableGroup,其 defaultProps.keepRatio = true,
    // 会导致分组缩放(含拖整边 n/e/s/w)被强制等比 nextHeight = nextWidth / ratio,
    // 进而 parentScale 两个维度都非 1,所有子元素宽高一起等比变。
    // 设 false 后:拖整边只变一个维度,拖四角自由双向(不锁比例)。
    keepRatio: false,
    // 最小尺寸约束:在 onResizeStart/onResizeGroupStart 中用 e.setMin([20,20]) 设置
    // (moveable 原生 API,写入 datas.minSize,计算阶段 calculateBoundSize 即纳入,
    //  计算值与 DOM 始终一致,无手动 clamp 产生的漂移)。此前在 onResize 内用
    //  Math.max(20,…) 钳制,会制造「算 5px / 写 20px」误差触发 checkResizableError
    //  自纠反馈->改写 start->重算->再塌缩;改用 setMin 后该反馈无误差来源。
    // 关闭 resize 误差自纠:checkResizableError 默认 true,每帧比对计算宽高与
    //  DOM 实际宽高,差>3px 即改写冻结 startOffsetWidth 重算,分组缩放会级联塌缩;
    //  min 已由 setMin 在计算阶段纳入,关闭自纠避免抖动。
    checkResizableError: false,
    // 不显示中心点
    origin: false,
    // 多板下 scrollContainer 用网格容器(Scrollable 已被 getScrollPosition 禁用滚动)
    scrollContainer: "[data-boards-grid]",
    getScrollPosition: GET_SCROLL_POSITION,
    /* ---------- 单元素 ---------- */
    onDragStart: singleDrag
      ? (e) => {
          pinViewerScroll();
          dragOverRef.current = null;
          setDragOverId(null);
          const id = e.target?.dataset?.id;
          const el = id ? elementsById.get(id) : undefined;
          if (!el) return;
          dragCtxRef.current = el.parentId
            ? { mode: "container", id, parentId: el.parentId }
            : { mode: "top", id };
          if (el.parentId) {
            scrollLockRef.current = lockScrollAncestors(e.target);
          }
        }
      : undefined,
    onDrag: singleDrag
      ? (e) => {
          const id = e.target.dataset.id;
          const el = elementsById.get(id);
          if (!el) return;
          if (el.parentId) {
            // 容器内：transform 悬浮（占位保留，零重渲染），落地由 onDragEnd 碰撞定归属
            const [dx, dy] = e.dist;
            e.target.style.transform = buildRotationTransform(
              `translate(${dx}px, ${dy}px)`,
              el.rotation,
            );
            e.target.style.zIndex = "999";
            pendingRef.current = [];
            updateDragOver(e.target, el);
            updateSelectionLabel();
            return;
          }
          // 顶层：left/top,允许拖出模板(不 clamp 到画布边界)
          begin();
          const sz = sizeFor(el);
          const unit = el.unit || "px";
          const isPercent = unit === "%";
          const gx = pxToUnit(e.dist[0], unit, sz.width);
          const gy = e.dist[1];
          const x = round(el.x + gx, isPercent ? 2 : 0);
          const y = round(el.y + gy);
          applyToDom(e.target, { x, y }, unit);
          pendingRef.current = [{ id, patch: { x, y } }];
          updateDragOver(e.target, el);
          updateSelectionLabel();
        }
      : undefined,
    onDragEnd: singleDrag
      ? (e) => {
          const ctx = dragCtxRef.current;
          const restore = () => {
            unlockScrollAncestors(scrollLockRef.current);
            scrollLockRef.current = [];
          };
          if (ctx?.mode === "container") {
            const el = elementsById.get(ctx.id);
            if (el) {
              const drop = resolveDrop(e.target, el, { containerIds, elementRefs, elements, zoom });
              flushSync(() => dropElement({ id: ctx.id, ...drop }));
            }
            if (e.target) {
              e.target.style.transform = "";
              e.target.style.zIndex = "";
            }
            restore();
            dragCtxRef.current = null;
            dirtyRef.current = false;
            pendingRef.current = [];
          } else if (ctx?.mode === "top") {
            // 顶层落地:命中容器则移入;跨板则迁移模板;否则提交 x/y
            const el = elementsById.get(ctx.id);
            let moved = false;
            if (el) {
              const drop = resolveDrop(e.target, el, { containerIds, elementRefs, elements, zoom });
              if (drop.targetParentId !== null) {
                flushSync(() =>
                  dropElement({
                    id: ctx.id,
                    targetParentId: drop.targetParentId,
                    insertIndex: drop.insertIndex,
                  }),
                );
                moved = true;
              } else if (
                drop.targetTemplateId &&
                drop.targetTemplateId !== (el.templateId ?? DEFAULT_TEMPLATE_ID)
              ) {
                // 跨模板顶层迁移
                flushSync(() =>
                  dropElement({
                    id: ctx.id,
                    targetParentId: null,
                    targetTemplateId: drop.targetTemplateId,
                    x: drop.x,
                    y: drop.y,
                  }),
                );
                moved = true;
              }
            }
            if (!moved) commitSingle();
            restore();
            dragCtxRef.current = null;
          } else {
            commitSingle();
            restore();
            dragCtxRef.current = null;
          }
          dragOverRef.current = null;
          setDragOverId(null);
          unpinViewerScroll();
        }
      : undefined,
    onResizeStart: (e) => {
      // 最小尺寸约束交给 moveable 原生 setMin:写入 datas.minSize,计算阶段
      // calculateBoundSize 即纳入,计算值与 DOM 一致,不触发 checkResizableError
      // 误差自纠(旧方案在 onResize 内 Math.max(20,…) 钳制会制造漂移致抖动/塌缩)。
      e.setMin([20, 20]);
    },
    onResize: (e) => {
      pinViewerScroll();
      begin();
      const id = e.target.dataset.id;
      const el = elementsById.get(id);
      if (!el) return;
      const sz = sizeFor(el);
      const unit = el.unit || "px";
      const isPercent = unit === "%";

      // 单元素缩放:忠实应用 moveable 计算的矩形。最小尺寸由 onResizeStart 的
      // e.setMin([20,20]) 在计算阶段约束,此处不再手动 clamp,避免 DOM 与计算值
      // 不同步触发 checkResizableError 自纠反馈。
      // 不做边界 clamp--允许缩放超出模板范围(与分组缩放 / 拖拽一致)。
      const width = isPercent ? round(pxToUnit(e.width, unit, sz.width), 2) : round(e.width);
      const height = round(e.height);
      const x = isPercent ? round(pxToUnit(e.drag.left, unit, sz.width), isPercent ? 2 : 0) : round(e.drag.left);
      const y = round(e.drag.top);

      const patch = {
        width,
        height,
      };

      if (!isInContainer) {
        patch.x = x;
        patch.y = y;
      }

      applyToDom(e.target, patch, unit);
      if (isInContainer) {
        e.target.style.transform = buildRotationTransform(
          `translate(${x}px, ${y}px)`,
          el.rotation,
        );
      }
      pendingRef.current = [{ id, patch }];
      // 实时宽高写入标签,避免读 stale 的 elementsById
      updateSelectionLabel(formatSizeLabel(width, height, unit));
    },
    onResizeEnd: !isGroup
      ? () => {
          commitSingle();
          unpinViewerScroll();
        }
      : undefined,
    /* ---------- 分组 / 多选 ---------- */
    onDragGroup: draggable
      ? (e) => {
          pinViewerScroll();
          begin();
          const evs = e.events;
          // 收集本组有效元素(过滤已失效引用)
          const infos = [];
          for (const ev of evs) {
            const id = ev.target.dataset.id;
            const el = elementsById.get(id);
            if (el) infos.push({ ev, el, id });
          }
          if (!infos.length) {
            pendingRef.current = [];
            return;
          }
          // 组内同模板同单位:以首个元素定单位 / 画布尺寸
          const first = infos[0].el;
          const sz = sizeFor(first);
          const unit = first.unit || "px";
          const isPercent = unit === "%";
          // 增量统一换算到元素单位;允许拖出模板(不按组包围盒 clamp 到画布边界)。
          // 仍整体施加同一 gx/gy(而非逐元素),保证拖拽中选中框尺寸不变。
          const dist = infos[0].ev.dist;
          const gx = pxToUnit(dist[0], unit, sz.width);
          const gy = dist[1];
          pendingRef.current = infos.map(({ ev, el, id }) => {
            const x = round(el.x + gx, isPercent ? 2 : 0);
            const y = round(el.y + gy);
            applyToDom(ev.target, { x, y }, unit);
            if (isInContainer) {
              ev.target.style.transform = buildRotationTransform(
                `translate(${round(dist[0])}px, ${round(dist[1])}px)`,
                el.rotation,
              );
            }
            return { id, patch: { x, y } };
          });
          updateSelectionLabel();
        }
      : undefined,
    onDragGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
    onResizeGroupStart: (e) => {
      // 分组最小尺寸:setMin([20,20]) 设整组 bounding 最小值,moveable 计算阶段
      // 即纳入(updateGroupMin 会与各子元素 min 取 max),整组不会塌缩到极小尺寸。
      e.setMin([20, 20]);
    },
    onResizeGroup: (e) => {
      pinViewerScroll();
      begin();
      pendingRef.current = e.events.map((ev) => {
        const id = ev.target.dataset.id;
        const el = elementsById.get(id);
        if (!el) return { id, patch: {} };
        const sz = sizeFor(el);
        const unit = el.unit || "px";
        const isPercent = unit === "%";

        // 分组缩放:完全忠实应用 moveable 计算的各元素矩形(逐元素等比缩放),
        // 不做任何逐元素 clamp(边界 clamp 与最小尺寸都不做)。原因:moveable 控制框
        // 按「整组 bounding + 冻结 start」随手势计算,而 updateRect 每帧又从各元素
        // DOM 重建控制框;一旦某元素被 clamp(DOM 与 moveable 算出的值不一致),控制框
        // 便在「clamp 后的 DOM」与「手势算出的值」之间每帧 reconcile -> 缩放时明显抖动。
        // 最小尺寸改由 onResizeGroupStart 的 e.setMin([20,20]) 在计算阶段约束整组
        // bounding(updateGroupMin 与各子元素 min 取 max),既防塌缩又不产生 DOM 漂移。
        // checkResizableError 已关闭(见 moveableProps),靠「不 clamp」让 DOM 与计算值
        // 始终一致,同时消除抖动与塌缩。允许超出模板范围,结束按实际落地。
        const width = isPercent ? round(pxToUnit(ev.width, unit, sz.width), 2) : round(ev.width);
        const height = round(ev.height);
        const x = isPercent ? round(pxToUnit(ev.drag.left, unit, sz.width), isPercent ? 2 : 0) : round(ev.drag.left);
        const y = round(ev.drag.top);

        const patch = { width, height };
        if (!isInContainer) { patch.x = x; patch.y = y; }
        applyToDom(ev.target, patch, unit);
        if (isInContainer) {
          ev.target.style.transform = buildRotationTransform(`translate(${x}px, ${y}px)`, el.rotation);
        }
        return { id, patch };
      });
      updateSelectionLabel();
    },
    onResizeGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
    onRotate: singleRotate
      ? (e) => {
          pinViewerScroll();
          begin();
          const id = e.target.dataset.id;
          const el = elementsById.get(id);
          if (!el) return;
          const rotation = round(e.rotation);
          applyToDom(e.target, { rotation });
          pendingRef.current = [{ id, patch: { rotation } }];
          updateSelectionLabel();
        }
      : undefined,
    onRotateEnd: singleRotate
      ? () => {
          commitSingle();
          unpinViewerScroll();
        }
      : undefined,
    onRotateGroup: rotatable
      ? (e) => {
          pinViewerScroll();
          begin();
          pendingRef.current = e.events.map((ev) => {
            const id = ev.target.dataset.id;
            const el = elementsById.get(id);
            if (!el) return { id, patch: {} };
            const rotation = round(ev.rotation);
            ev.target.style.transform = buildRotationTransform(undefined, rotation);
            return { id, patch: { rotation } };
          });
          updateSelectionLabel();
        }
      : undefined,
    onRotateGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
  };

  return { targets, isGroup, moveableProps };
}
