import { FontSizeOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { ELEMENT_TYPES } from "./types";

function TextContent({ el, styles }) {
  return <span className={styles.text}>{el.props.text}</span>;
}

function TextProps({ el, update, begin, styles }) {
  return (
    <label className={styles.fieldFull}>
      <span className={styles.label}>文本内容</span>
      <Input.TextArea
        size="small"
        autoSize={{ minRows: 2 }}
        value={el.props.text}
        onFocus={begin}
        onChange={(e) => update({ props: { text: e.target.value } })}
      />
    </label>
  );
}

export default {
  type: ELEMENT_TYPES.TEXT,
  label: "文本",
  icon: FontSizeOutlined,
  defaults: { width: 140, height: 40, props: { text: "双击编辑文本" } },
  Content: TextContent,
  Props: TextProps,
};
