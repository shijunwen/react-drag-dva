import { PictureOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { ELEMENT_TYPES } from "./types";

function ImageContent({ el, styles }) {
  return (
    <img
      className={styles.image}
      src={el.props.src}
      alt=""
      draggable={false}
    />
  );
}

function ImageProps({ el, update, begin, styles }) {
  return (
    <label className={styles.fieldFull}>
      <span className={styles.label}>图片地址</span>
      <Input
        size="small"
        value={el.props.src}
        onFocus={begin}
        onChange={(e) => update({ props: { src: e.target.value } })}
      />
    </label>
  );
}

export default {
  type: ELEMENT_TYPES.IMAGE,
  label: "图片",
  icon: PictureOutlined,
  defaults: {
    width: 160,
    height: 120,
    props: { src: "https://picsum.photos/160/120" },
  },
  Content: ImageContent,
  Props: ImageProps,
};
