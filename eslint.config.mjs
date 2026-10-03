import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/**", "src-tauri/target/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
