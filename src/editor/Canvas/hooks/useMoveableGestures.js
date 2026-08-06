import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  selectAtom,
  updateElementAtom,
  updateElementsAtom,
  beginChangeAtom,
  zoomAtom,
  viewportAtom,
  templatesAtom,
  dropElementAtom,
  dragOverContainerIdAtom,
  marqueeActiveAtom,
  DEFAULT_TEMPLATE_ID,
} from "@/atoms";
import { SNAP_THRESHOLD } from "../../constants";
import { pxToUnit } from "../../utils";
import { ELEMENT_TYPES } from "../../elements";
import {
  round,
  applyToDom,
  lockScrollAncestors,
  unlockScrollAncestors,
  buildRotationTransform,
  SNAP_DIST_FORMAT,
  GET_SCROLL_POSITION,
  FALLBACK_SIZE,
  getViewerWrapper,
  applySizeLabel,
  formatSizeLabel,
} from "../moveableHelpers";
import { findDropContainer, resolveDrop } from "../dropLogic";

/**
 * react-moveable 手势逻辑层(从 MoveableLayer 抽出)。
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
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const beginChange = useSetAtom(beginChangeAtom);
  const dropElement = useSetAtom(dropElementAtom);
  const setDragOverId = useSetAtom(dragOverContainerIdAtom);
  const marqueeActive = useAtomValue(marqueeActiveAtom);
  const zoom = useAtomValue(zoomAtom);

  // id -> element 的 O(1) 索引，替换拖拽/缩放热路径中的 elements.find（每帧多次）
  const elementsById = useMemo(() => {
    const m = new Map();
    for (const el of elements) m.set(el.id, el);
    return m;
  }, [elements]);

  // templateId -> {width,height} 的 O(1) 索引,供拖拽/缩放按元素所属模板尺寸 clamp/换算
  const templateSizeMap = useMemo(() => {
    const m = new Map();
    for (const t of templates) m.set(t.id, { width: t.width, height: t.height });
    return m;
  }, [templates]);

  const sizeFor = useCallback(
    (el) => templateSizeMap.get(el?.templateId ?? DEFAULT_TEMPLATE_ID) ?? FALLBACK_SIZE,
    [templateSizeMap],
  );

  // 所有 ref 声明放在前面
  const dirtyRef = useRef(false); // 本次手势是否产生过位移（用于延迟记历史）
  const pendingRef = useRef([]); // 待提交的 patches
  const dragCtxRef = useRef(null); // 拖拽上下文：{ mode: "top"|"container", id, parentId? }
  const scrollLockRef = useRef([]); // 拖拽期间锁定的可滚祖先(用于恢复)
  const dragOverRef = useRef(null); // 当前悬停的容器 id(去重用，避免每帧写 atom 触发重渲染)
  const scrollListenerRef = useRef(null);
  const scrollPinnedRef = useRef(false);
  const pinnedScrollRef = useRef({ left: 0, top: 0 });

  // 固定 InfiniteViewer 包装器的滚动位置（支持多手势并发）
  const pinViewerScroll = useCallback(() => {
    if (scrollPinnedRef.current) return;
    const wrapper = getViewerWrapper(viewerRef?.current);
    if (!wrapper) return;
    pinnedScrollRef.current = { left: wrapper.scrollLeft, top: wrapper.scrollTop };
    const resetScroll = () => {
      wrapper.scrollLeft = pinnedScrollRef.current.left;
      wrapper.scrollTop = pinnedScrollRef.current.top;
    };
    wrapper.addEventListener("scroll", resetScroll, { passive: false });
    scrollListenerRef.current = resetScroll;
    scrollPinnedRef.current = true;
  }, [viewerRef]);

  const unpinViewerScroll = useCallback(() => {
    if (!scrollPinnedRef.current) return;
    const wrapper = getViewerWrapper(viewerRef?.current);
    if (!wrapper || !scrollListenerRef.current) return;
    wrapper.removeEventListener("scroll", scrollListenerRef.current);
    scrollListenerRef.current = null;
    scrollPinnedRef.current = false;
  }, [viewerRef]);

  // 订阅 viewport 滚动变化(非 zoom)来更新控制框位置
  const { scrollLeft, scrollTop } = useAtomValue(viewportAtom);

  // 缩放 / 元素变化 / 滚动位置变化后重算控制框位置
  useEffect(() => {
    // 仅在非手势期间更新(手势期间 scroll 被锁定,不需要更新)
    if (!scrollPinnedRef.current && moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, elements, moveableRef, scrollLeft, scrollTop]);

  // 选中元素引用
  const targets = useMemo(
    () => selectedIds.map((id) => elementRefs.current.get(id)).filter(Boolean),
    [selectedIds, elementRefs],
  );
  const isGroup = targets.length > 1;
  const hasLockedSelected = selectedIds.some((id) => elementsById.get(id)?.locked);
  const snapGridWidth = gridSnapEnabled ? gridSnapSize : 0;
  const snapGridHeight = gridSnapEnabled ? gridSnapSize : 0;

  // undo/redo 后选中元素可能已不存在，过滤无效选中
  const select = useSetAtom(selectAtom);
  const hasInvalidSelection = useMemo(
    () => selectedIds.length > 0 && selectedIds.some((id) => !elementsById.has(id)),
    [selectedIds, elementsById],
  );
  useEffect(() => {
    if (hasInvalidSelection) {
      select(selectedIds.filter((id) => elementsById.has(id)));
    }
  }, [hasInvalidSelection, selectedIds, elementsById, select]);

  // 判断是否是容器内元素 + 吸附参考线（共用一次 idSet / firstSelected 计算）
  const idSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const firstSelected = useMemo(() => {
    for (const el of elements) {
      if (idSet.has(el.id)) return el;
    }
    return null;
  }, [elements, idSet]);
  const parentId = firstSelected?.parentId ?? null;
  const firstTemplateId = firstSelected?.templateId ?? DEFAULT_TEMPLATE_ID;
  const isInContainer = targets.length > 0 && parentId !== null;

  // 吸附参考线:用 elementGuidelines 传入其他元素的 DOM 节点,
  // moveable 自动读 getBoundingClientRect 算 snap。限定同模板同父级,避免跨板吸附。
  // 顶层元素额外加入「当前画板」元素:moveable 据其 rect 显示画板边缘+中心吸附线
  // (checkBetweenRects 只判范围重叠,目标在画板内 -> 不过滤)。画板恒在 DOM,render 期可取。
  const elementGuidelines = useMemo(
    () => {
      const siblings = elements
        .filter(
          (el) =>
            (el.parentId ?? null) === parentId &&
            (el.templateId ?? DEFAULT_TEMPLATE_ID) === firstTemplateId &&
            !idSet.has(el.id),
        )
        .map((el) => elementRefs.current.get(el.id))
        .filter(Boolean);
      if (isInContainer) return siblings;
      const board = document.querySelector(`[data-template-id="${firstTemplateId}"]`);
      // 画板开启 center(垂直中线) 和 middle(水平中线),拖拽时可吸附到画板中心并显示距离。
      return board ? [...siblings, { element: board, center: true, middle: true }] : siblings;
    },
    [elements, parentId, firstTemplateId, idSet, elementRefs, isInContainer],
  );

  // 标尺辅助线吸附标记(Board 在激活画板内按 guides 渲染的 0 尺寸不可见 div)。
  // 用 useLayoutEffect(提交后查 DOM):guide 变化当帧 render 期标记尚未提交,需 commit 后重查。
  // 浅比较避免无变化重渲染。{horizontal:true,vertical:false} 限定只产水平线(标记 0 高 -> Y=g);
  // center:false 免冗余。垂直同理。
  const [rulerGuideElements, setRulerGuideElements] = useState([]);
  useLayoutEffect(() => {
    let next = [];
    if (!isInContainer) {
      const board = document.querySelector(`[data-template-id="${firstTemplateId}"]`);
      if (board) {
        next = [
          ...Array.from(
            board.querySelectorAll('[data-snap-guide="h"]'),
            (el) => ({ element: el, top: true, bottom: true, left: false, right: false, center: false, middle: false }),
          ),
          ...Array.from(
            board.querySelectorAll('[data-snap-guide="v"]'),
            (el) => ({ element: el, left: true, right: true, top: false, bottom: false, center: false, middle: false }),
          ),
        ];
      }
    }
    // commit 后测 DOM 标记再同步 state:必要的 post-commit ref 测量(CLAUDE.md set-state-in-effect 例外)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRulerGuideElements((prev) =>
      prev.length === next.length && prev.every((p, i) => p.element === next[i].element)
        ? prev
        : next,
    );
  }, [isInContainer, firstTemplateId, horizontalGuides, verticalGuides]);

  // 单选均可拖；多选仅顶层（容器内多选仅 resize）
  const draggable = !hasLockedSelected && !(isGroup && isInContainer);
  const resizable = !hasLockedSelected;
  const rotatable = !hasLockedSelected;
  const snappable = !isInContainer;

  // 容器 id 列表（拖拽命中测试只遍历容器，不扫描全部元素）
  const containerIds = useMemo(
    () => elements.filter((e) => e.type === ELEMENT_TYPES.CONTAINER).map((e) => e.id),
    [elements],
  );

  // 尺寸标签:隐藏 / 定位到选中框(各选中元素外包矩形并集)上方。
  // 文本:单选取元素逻辑宽高(保留 unit),多选取屏幕并集 / zoom(贴合可见框)。
  // textOverride 用于缩放手势中传入实时宽高,避免读 stale 的 elementsById。
  // 直接写 DOM 的部分收口在 applySizeLabel 内,避免触发 react-hooks/immutability。
  const hideLabel = useCallback(() => {
    applySizeLabel(sizeLabelRef.current, null, null, "", false);
  }, [sizeLabelRef]);

  const updateSelectionLabel = useCallback(
    (textOverride) => {
      const label = sizeLabelRef?.current;
      const wrap = canvasWrapRef?.current;
      if (!label || !wrap) return;
      let rect = null;
      for (const t of targets) {
        const r = t.getBoundingClientRect();
        if (!rect) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        else {
          rect.left = Math.min(rect.left, r.left);
          rect.top = Math.min(rect.top, r.top);
          rect.right = Math.max(rect.right, r.right);
          rect.bottom = Math.max(rect.bottom, r.bottom);
        }
      }
      let screenRect = null;
      let text = "";
      if (rect) {
        screenRect = {
          left: rect.left,
          top: rect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
        };
        if (textOverride) {
          text = textOverride;
        } else if (targets.length === 1) {
          const el = elementsById.get(selectedIds[0]);
          text = el ? formatSizeLabel(el.width, el.height, el.unit || "px") : "";
        } else {
          text = `${Math.round(screenRect.width / zoom)}px × ${Math.round(screenRect.height / zoom)}px`;
        }
      }
      applySizeLabel(label, wrap, screenRect, text, !!screenRect);
    },
    [targets, selectedIds, elementsById, zoom, sizeLabelRef, canvasWrapRef],
  );

  // 选中 / 缩放 / 滚动 / 框选态变化时刷新尺寸标签(手势进行中由各 handler 实时刷新)
  useEffect(() => {
    if (marqueeActive || !targets.length) {
      hideLabel();
      return;
    }
    updateSelectionLabel();
  }, [targets, marqueeActive, zoom, elements, scrollLeft, scrollTop, hideLabel, updateSelectionLabel]);

  if (!targets.length) {
    return { targets, isGroup, moveableProps: null };
  }

  // 首次位移时才记录历史，避免空操作产生撤销项
  const begin = () => {
    if (!dirtyRef.current) {
      beginChange();
      dirtyRef.current = true;
    }
  };
  const commitSingle = () => {
    if (dirtyRef.current && pendingRef.current.length) {
      flushSync(() => updateElement(pendingRef.current[0]));
    }
    dirtyRef.current = false;
    pendingRef.current = [];
  };
  const commitGroup = () => {
    if (dirtyRef.current && pendingRef.current.length) {
      flushSync(() => updateElements(pendingRef.current));
    }
    dirtyRef.current = false;
    pendingRef.current = [];
  };

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
    snapThreshold: SNAP_THRESHOLD,
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
