import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 8080,
    open: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // main.ts only bootstraps the WebGL Application; logic lives in game.ts.
      exclude: ["src/**/*.test.ts", "src/main.ts", "src/vite-env.d.ts"],
      thresholds: { 100: true },
    },
  },
})
