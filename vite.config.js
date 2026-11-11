import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // FastAPI sends no CORS headers, so proxy through the dev server
  // 대상 주소에는 경로를 붙이지 않는다: /samsung 요청 경로가 그대로 뒤에 붙음
  server: { proxy: { "/samsung": "http://13.239.201.157" } },
});
