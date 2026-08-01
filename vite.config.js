import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // demo 入口在 examples/(库源码在 src/,经 @ 别名引用)
  root: path.resolve(__dirname, "examples"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // demo 构建产物独立于库 dist,避免覆盖
    outDir: path.resolve(__dirname, "dist-demo"),
    rollupOptions: {
      output: {
        // 拆分第三方依赖，改善缓存与首屏（遵循 bundle 压缩准则）
        manualChunks: {
          react: ["react", "react-dom"],
          antd: ["antd", "@ant-design/icons"],
          moveable: ["react-moveable"],
          dndkit: ["@dnd-kit/core", "@dnd-kit/utilities"],
          // 画布/标尺库较重，独立成 chunk 提升缓存命中率
          viewer: ["react-infinite-viewer", "@scena/react-guides"],
        },
      },
    },
  },
});

