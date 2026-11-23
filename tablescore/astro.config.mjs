import { defineConfig } from "astro/config";

// Loopback only. Do not bind 0.0.0.0.
export default defineConfig({
  trailingSlash: "always",
  server: {
    host: "127.0.0.1",
    port: 4321,
  },
});
