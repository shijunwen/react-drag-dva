import { Input, InputNumber, ColorPicker, Select, Switch } from "antd";
import { getDef } from "./elements";
import styles from "./PropertiesPanel/PropertiesPanel.module.less";

/**
 * schema 驱动的属性面板(检查器):根据元素定义的 inspector 配置自动渲染编辑控件,
 * 让用户只需声明一整块 inspector 配置,无需为每个类型手写 Props 组件。
 *
 * 字段形状:{ key, label, type, default?, layout?, render?, ...类型相关 }
 * 支持类型:
 *   - text     文本输入(Input)
 *   - textarea 多行文本(Input.TextArea)
 *   - number   数字(InputNumber,可配 min/max/step)
 *   - color    颜色(ColorPicker,存 hex 字符串)
 *   - select   下拉(Select,配 options:[{label,value}])
 *   - switch   开关(Switch,存 boolean,默认行内布局)
 *
 * 自定义渲染:某项给出 render 即跳过内置控件,只渲染该字段时走自定义实现,
 * 仍复用统一的 label + 布局(其余字段照常 schema 驱动)。
 *   render 签名:({ value, set, update, el, begin }) => ReactNode
 *     - value 当前 el.props[key]
 *     - set(v) 设置该字段(等价 update({ props:{ [key]: v } }))
 *     - update(patch) 完整 patch(用于字段联动)
 *     - el / begin 元素与历史快照(用于 onFocus 等)
 *
 * layout:"full"(默认,纵向 label 顶置)| "inline"(横向)。switch 默认 inline。
 *
 * 当元素未提供自定义 Props 组件时,PropertiesPanel 回退到此生成器。
 * 高级场景(整个面板自定义)仍可传 Props 组件覆盖。
 */
function FieldControl({ field, el, update, begin }) {
  const { key, label, type = "text" } = field;
  const value = el.props[key];
  const set = (v) => update({ props: { [key]: v } });
  const layout = field.layout ?? (type === "switch" ? "inline" : "full");

  let control;
  if (typeof field.render === "function") {
    control = field.render({ value, set, update, el, begin });
  } else {
    switch (type) {
      case "textarea":
        control = (
          <Input.TextArea
            size="small"
            autoSize={{ minRows: 2 }}
            value={value}
            onFocus={begin}
            onChange={(e) => set(e.target.value)}
          />
        );
        break;
      case "number":
        control = (
          <InputNumber
            size="small"
            value={value}
            min={field.min}
            max={field.max}
            step={field.step}
            onFocus={begin}
            onChange={(v) => set(v ?? 0)}
          />
        );
        break;
      case "color":
        control = (
          <ColorPicker
            size="small"
            value={value}
            onChangeComplete={(c) => set(c.toHexString())}
          />
        );
        break;
      case "select":
        control = (
          <Select
            size="small"
            value={value}
            options={field.options}
            style={{ width: "100%" }}
            onChange={(v) => set(v)}
          />
        );
        break;
      case "switch":
        control = (
          <Switch
            size="small"
            checked={!!value}
            onChange={(c) => {
              begin();
              set(c);
            }}
          />
        );
        break;
      case "text":
      default:
        control = (
          <Input
            size="small"
            value={value}
            onFocus={begin}
            onChange={(e) => set(e.target.value)}
          />
        );
    }
  }

  return (
    <label className={layout === "inline" ? styles.field : styles.fieldFull}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {control}
    </label>
  );
}

export default function SchemaProps({ el, update, begin }) {
  const inspector = getDef(el.type)?.inspector;
  if (!inspector?.length) return null;
  return (
    <>
      {inspector.map((f) => (
        <FieldControl key={f.key} field={f} el={el} update={update} begin={begin} />
      ))}
    </>
  );
}
