import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    include: [
      "shared/**/*.test.ts",
      "backend/**/*.test.ts",
      "infra/**/*.test.ts",
      "src/**/*.test.ts",
    ],
  },
});
