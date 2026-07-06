import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15202b",
        runway: "#f6f8fb",
        signal: "#0f766e",
        fare: "#2563eb"
      }
    }
  },
  plugins: []
};

export default config;
