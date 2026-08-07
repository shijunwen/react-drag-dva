/**
 * 纯几何/坐标函数 — 零 DOM 依赖。
 */

/**
 * 计算一组元素的并集包围盒。
 * x/width/y/height 的单位由 el.unit 决定（px 或 %），混合时仅在相同单位间比较。
 */
export function getBounds(elements) {
  if (!elements.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** 两矩形重叠面积（坐标均含 zoom 缩放时可直接比较） */
export const rectOverlapArea = (a, b) => {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ix * iy;
};
