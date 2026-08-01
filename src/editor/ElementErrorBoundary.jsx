import { Component } from "react";

/**
 * 元素渲染错误边界:自定义元素的 Content/Props 抛错时显示占位,
 * 避免单个坏元素导致整个编辑器白屏(对"支持注册自定义元素类型"的库尤为重要)。
 * resetKey 变化时(如切换为另一个元素)自动恢复,便于重试。
 */
export default class ElementErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prev) {
    // 切换到别的元素时清除错误态,给新元素一次渲染机会
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("[react-drag-dva] 元素渲染出错:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
              fontSize: 12,
              border: "1px dashed #ef4444",
              boxSizing: "border-box",
            }}
          >
            渲染失败
          </div>
        )
      );
    }
    return this.props.children;
  }
}
