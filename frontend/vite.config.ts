import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { brand } from "./shared/brand";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "platform-brand",
      transformIndexHtml: (html) =>
        html
          .replaceAll("__BRAND_TITLE__", brand.title)
          .replaceAll("__BRAND_DESCRIPTION__", brand.tagline),
    },
  ],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "ui-vendor": ["@mantine/core", "@mantine/hooks"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
});
