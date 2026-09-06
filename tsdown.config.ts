import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "esnext",
  dts: true,
  clean: true,
  unbundle: true,
  publint: true,
}) as ReturnType<typeof defineConfig>;
