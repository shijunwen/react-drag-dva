import { BorderOuterOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";
import { ShapeContent } from "./shared";

function RectContent({ el, styles }) {
  return <ShapeContent el={el} styles={styles} radius={4} />;
}

export default {
  type: ELEMENT_TYPES.RECT,
  label: "矩形",
  icon: BorderOuterOutlined,
  defaults: { width: 120, height: 80, props: { fill: "#58a6ff" } },
  inspector: [{ key: "fill", label: "填充颜色", type: "color" }],
  Content: RectContent,
};
