import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
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
    rollupOptions: {
      output: {
        // 拆分第三方依赖，改善缓存与首屏（遵循 bundle 压缩准则）
        manualChunks: {
          react: ["react", "react-dom"],
          antd: ["antd", "@ant-design/icons"],
          moveable: ["react-moveable"],
          dndkit: ["@dnd-kit/core", "@dnd-kit/utilities"],
        },
      },
    },
  },
});

