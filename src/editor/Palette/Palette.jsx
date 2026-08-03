import { memo, useMemo, useSyncExternalStore } from "react";
import { useDraggable } from "@dnd-kit/core";
import { PALETTE_ITEMS, ELEMENT_ICONS, subscribeRegistry, getRegistryVersion } from "../elements";
import styles from "./Palette.module.less";

// 提升到模块作用域：避免每次 render 产生新 style 引用
const ITEM_STYLE_NORMAL = { opacity: 1 };
const ITEM_STYLE_DRAGGING = { opacity: 0.3 };

const PaletteItem = memo(function PaletteItem({ item }) {
  // data 稳定化：item.type 不变时引用不变，避免 useDraggable 因 data 变化重置
  const data = useMemo(() => ({ type: item.type, source: "palette" }), [item.type]);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data,
  });

  const Icon = ELEMENT_ICONS[item.type];

  return (
    <button
      ref={setNodeRef}
      className={styles.item}
      style={isDragging ? ITEM_STYLE_DRAGGING : ITEM_STYLE_NORMAL}
      {...listeners}
      {...attributes}
    >
      {Icon ? <Icon className={styles.icon} /> : null}
      <span>{item.label}</span>
    </button>
  );
});

export default function Palette() {
  // 订阅注册表版本:registerElement 注册新类型时,<Palette> 重渲染以展示它们
  useSyncExternalStore(subscribeRegistry, getRegistryVersion);
  return (
    <div className={styles.palette}>
      <span className={styles.title}>组件</span>
      <div className={styles.list}>
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} item={item} />
        ))}
      </div>
    </div>
  );
}
