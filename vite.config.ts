import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  // Relative URLs so the build works from any subpath, e.g. GitHub Pages'
  // /<repo>/. Code must build public asset URLs from import.meta.env.BASE_URL.
  base: "./",
  server: {
    port: 8080,
    open: true,
  },
  build: {
    rollupOptions: {
      // The game, plus the scene sandbox for viewing features in isolation.
      input: ["index.html", "sandbox.html"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Entry points only bootstrap the WebGL Application and DOM; logic
      // lives in modules that are tested.
      exclude: [
        "src/**/*.test.ts",
        "src/main.ts",
        "src/sandbox/main.ts",
        "src/vite-env.d.ts",
      ],
      thresholds: { 100: true },
    },
  },
})
