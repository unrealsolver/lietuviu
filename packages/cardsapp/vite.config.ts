/// <reference types="node" />
import { htmlTableToGridPlugin } from "./plugin/htmlTableLoader";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [htmlTableToGridPlugin(), react()],
  base: "/lietuviu/",
});
