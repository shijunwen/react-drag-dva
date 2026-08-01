import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * 库构建配置(独立于 demo 的 vite.config.js)。
 * 用法:pnpm build:lib -> 产出 dist/index.js(ESM)、dist/index.cjs(CJS)、dist/style.css。
 *
 * - React / antd / jotai / dnd-kit / moveable 等全部 external,由消费方提供(peerDependencies)。
 * - CSS 合并为单一 style.css(含设计 token + 各 .module.less),消费方 import "react-drag-dva/style.css"。
 * - 不压缩、出 sourcemap,便于消费方 tree-shaking 与调试;最终压缩交由消费方构建。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.js"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      // 精确匹配,避免 /^react/ 误伤 react-moveable / react-infinite-viewer
      external: [
        /^react$/,
        /^react-dom$/,
        /^react\//,
        /^antd$/,
        /^antd\//,
        /@ant-design/,
        /^jotai$/,
        /^jotai\//,
        /@dnd-kit/,
        /^react-moveable$/,
        /^react-infinite-viewer$/,
        /^ahooks$/,
        /^ahooks\//,
      ],
      output: {
        assetFileNames: "style.[ext]",
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
});
