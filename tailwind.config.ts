import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        page: "#0d0d0d",
        surface: "#1a1a19",
        border: "#383835",
        grid: "#2c2c2a",
        ink: "#ffffff",
        "ink-2": "#c3c2b7",
        muted: "#898781",
        up: "#0ca30c",
        down: "#d03b3b",
        "lv-high": "#9085e9",
        "lv-tp": "#0ca30c",
        "lv-mid": "#d55181",
        "lv-entry": "#3987e5",
        "lv-sl": "#d03b3b",
      },
    },
  },
  plugins: [],
};
export default config;
