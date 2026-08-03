import { useMemo, useRef, useContext } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BlockOutlined } from "@ant-design/icons";
import { registerElement, ELEMENT_TYPES } from "./elements";
import { EditorPresenceContext } from "./editorPresence";
import paletteStyles from "./Palette/Palette.module.less";

/**
 * type -> 最新渲染函数(render-prop)。
 * 注册的 Content 组件在实例渲染时从此 Map 读取,保证 children 闭包始终最新,
 * 且无需重新注册(避免产生新 Content 引用导致已落点实例重挂载)。
 *
 * 注意:注册表(RENDER_FNS/CONTENT_CACHE/ELEMENT_DEFS)有意为模块级全局且持久--
 * 画布上的落点实例依赖它存活,即便 <DraggableElement> 卸载后仍需可渲染,
 * 故此处不做 cleanup(清理会导致残留实例白屏)。
 */
const RENDER_FNS = new Map();

/** type -> 稳定的 Content 组件(按 type 缓存,引用恒定) */
const CONTENT_CACHE = new Map();

/** 已注册的自定义 type -> { label, width, height }(用于冲突检测) */
const CUSTOM_TYPES = new Map();

function getContentComponent(type) {
  let Comp = CONTENT_CACHE.get(type);
  if (!Comp) {
    // 闭包捕获 type(非 render 期变量),渲染时从 RENDER_FNS 取最新渲染函数
    Comp = function DraggableElementContent({ el }) {
      const render = RENDER_FNS.get(type);
      if (typeof render === "function") return render({ el });
      return render ?? null;
    };
    CONTENT_CACHE.set(type, Comp);
  }
  return Comp;
}

// 提升到模块作用域:避免每次 render 产生新 style 引用(与 PaletteItem 一致)
const ITEM_STYLE_NORMAL = { opacity: 1 };
const ITEM_STYLE_DRAGGING = { opacity: 0.3 };
const DEFAULT_ICON = BlockOutlined;
const BUILTIN_TYPES = new Set(Object.values(ELEMENT_TYPES));

/**
 * 合并初始 props:inspector 各项的 default 作为基线,显式 props 覆盖之。
 * 让用户只需在 inspector 里写一次 default,不必再在 props 里重复默认值;
 * props 仍可声明 inspector 之外的、不参与面板编辑的初始值。
 */
function mergeInspectorDefaults(inspector, explicitProps) {
  const base = {};
  if (inspector?.length) {
    for (const f of inspector) {
      if (f.default !== undefined) base[f.key] = f.default;
    }
  }
  return { ...base, ...explicitProps };
}

/**
 * 包装器:把任意组件包进来后,作为可拖拽按钮拖入画布生成元素实例。
 *
 * 必须放在 <Editor> 的 children 内(已在 DndContext 中),按钮才能拖拽。
 * 拖入画布的元素与内置元素一样可移动/缩放/旋转/选中,走同一套 type 驱动链路。
 *
 * @param {Object} props
 * @param {string} props.type - 唯一类型字符串(不可与内置 text/rect/circle/image/button/container 冲突)
 * @param {string} props.label - 按钮文字与拖拽 overlay 文字
 * @param {ReactComponent} [props.icon] - 按钮图标,缺省 BlockOutlined
 * @param {number} [props.width=120] - 初始宽
 * @param {number} [props.height=80] - 初始高
 * @param {Object} [props.props] - 初始 props(覆盖 inspector 中同 key 的 default;每个实例深拷贝)
 * @param {Array} [props.inspector] - 属性面板 schema,每项 { key, label, type, default?, layout?, render? };
 *   传此配置即自动生成右侧属性面板(检查器),无需手写 Props。
 *   type:text/textarea/number/color/select/switch;某项给 render 则该项走自定义控件
 *   (签名 ({ value, set, update, el, begin }) => Node),仍复用统一 label/布局。
 * @param {ReactComponent} [props.Props] - 自定义属性面板组件,签名 ({ el, update, begin });
 *   高级覆盖:传入则优先于 inspector schema(用于字段联动/自定义控件)
 * @param {Function} props.children - render-prop `({ el }) => Node`
 * @param {string} [props.className] - 追加到按钮的类名
 * @param {Object} [props.style] - 追加到按钮的内联样式
 */
export default function DraggableElement({
  type,
  label,
  icon,
  width = 120,
  height = 80,
  props: defaultProps = {},
  inspector = null,
  Props = null,
  children,
  className,
  style,
}) {
  // 脱离 <Editor> 时给出明确错误,而非让 dnd-kit 报泛化异常
  if (!useContext(EditorPresenceContext)) {
    throw new Error(
      "[DraggableElement] 必须作为 <Editor> 的子组件渲染(需要在 DndContext 内才能拖拽)。",
    );
  }

  // 首次渲染同步注册(ref 守卫,幂等):
  // 同步而非 effect,保证 initialElements 含该类型时首屏即可渲染 Content
  // (children 在 <Editor> 中先于 <Canvas> 渲染,RENDER_FNS 已就绪)
  const registeredRef = useRef(null);
  if (registeredRef.current === null) {
    if (BUILTIN_TYPES.has(type)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DraggableElement] type "${type}" 与内置类型冲突,会导致拖拽 id "palette-${type}" 重复`,
      );
    } else {
      // 自定义 type 冲突检测:同一 type 共享同一渲染定义,
      // 若两个 <DraggableElement> 用同 type 但 label/尺寸不同,后注册的会覆盖前者,
      // 此处用原始值比较(避免 inline Props/children 新引用误报)。
      const prev = CUSTOM_TYPES.get(type);
      if (
        prev &&
        (prev.label !== label || prev.width !== width || prev.height !== height)
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DraggableElement] type "${type}" 已被另一个 <DraggableElement> 注册(label/尺寸不同)。同 type 共享同一渲染定义,后注册的将覆盖前者;如需不同定义请使用不同的 type。`,
        );
      }
      CUSTOM_TYPES.set(type, { label, width, height });
    }

    registerElement(
      {
        type,
        label,
        icon: icon || DEFAULT_ICON,
        defaults: { width, height, props: mergeInspectorDefaults(inspector, defaultProps) },
        inspector,
        Content: getContentComponent(type),
        Props,
      },
      { palette: false },
    );
    registeredRef.current = true;
  }

  // 每次渲染刷新最新 render 函数(廉价 Map 写):已落点实例下次渲染即用最新 children 闭包
  RENDER_FNS.set(type, children);

  // data 稳定化:type 不变时引用不变,避免 useDraggable 因 data 变化重置
  const data = useMemo(() => ({ type, source: "palette" }), [type]);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data,
  });

  const Icon = icon || DEFAULT_ICON;
  const baseStyle = isDragging ? ITEM_STYLE_DRAGGING : ITEM_STYLE_NORMAL;
  // 无 style 覆盖时复用模块级常量引用,减少不必要的 re-render
  const finalStyle = style ? { ...baseStyle, ...style } : baseStyle;
  const cls = [paletteStyles.item, className].filter(Boolean).join(" ");

  return (
    <button
      ref={setNodeRef}
      className={cls}
      style={finalStyle}
      {...listeners}
      {...attributes}
    >
      <Icon className={paletteStyles.icon} />
      <span>{label}</span>
    </button>
  );
}
