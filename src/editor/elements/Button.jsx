import { AppstoreOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { ELEMENT_TYPES } from "./types";

function ButtonContent({ el, styles }) {
  return <button className={styles.button}>{el.props.label}</button>;
}

function ButtonProps({ el, update, begin, styles }) {
  return (
    <label className={styles.fieldFull}>
      <span className={styles.label}>按钮文字</span>
      <Input
        size="small"
        value={el.props.label}
        onFocus={begin}
        onChange={(e) => update({ props: { label: e.target.value } })}
      />
    </label>
  );
}

export default {
  type: ELEMENT_TYPES.BUTTON,
  label: "按钮",
  icon: AppstoreOutlined,
  defaults: { width: 120, height: 44, props: { label: "按钮" } },
  Content: ButtonContent,
  Props: ButtonProps,
};
