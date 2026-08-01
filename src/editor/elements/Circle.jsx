import { AimOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";
import { ShapeContent, FillProps } from "./shared";

function CircleContent({ el, styles }) {
  return <ShapeContent el={el} styles={styles} radius="50%" />;
}

export default {
  type: ELEMENT_TYPES.CIRCLE,
  label: "圆形",
  icon: AimOutlined,
  defaults: { width: 100, height: 100, props: { fill: "#10b981" } },
  Content: CircleContent,
  Props: FillProps,
};
