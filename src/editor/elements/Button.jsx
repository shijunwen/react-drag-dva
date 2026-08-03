import { AppstoreOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";

function ButtonContent({ el, styles }) {
  return <button className={styles.button}>{el.props.label}</button>;
}

export default {
  type: ELEMENT_TYPES.BUTTON,
  label: "按钮",
  icon: AppstoreOutlined,
  defaults: { width: 120, height: 44, props: { label: "按钮" } },
  inspector: [{ key: "label", label: "按钮文字", type: "text" }],
  Content: ButtonContent,
};
