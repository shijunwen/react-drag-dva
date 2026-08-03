import { FontSizeOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";

function TextContent({ el, styles }) {
  return <span className={styles.text}>{el.props.text}</span>;
}

export default {
  type: ELEMENT_TYPES.TEXT,
  label: "文本",
  icon: FontSizeOutlined,
  defaults: { width: 140, height: 40, props: { text: "双击编辑文本" } },
  inspector: [{ key: "text", label: "文本内容", type: "textarea" }],
  Content: TextContent,
};
