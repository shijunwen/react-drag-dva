import { useDraggable } from "@dnd-kit/core";
import { PALETTE_ITEMS, ELEMENT_ICONS } from "../elements";
import styles from "./Palette.module.less";

function PaletteItem({ item }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { type: item.type, source: "palette" },
  });

  // 使用 DragOverlay 时不对源节点施加 transform，避免拖拽时重影 & 松手回弹
  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const Icon = ELEMENT_ICONS[item.type];

  return (
    <button
      ref={setNodeRef}
      className={styles.item}
      style={style}
      {...listeners}
      {...attributes}
    >
      <Icon className={styles.icon} />
      <span>{item.label}</span>
    </button>
  );
}

export default function Palette() {
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
