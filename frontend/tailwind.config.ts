import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F0F0F",
        accent: "#3B82F6",
        text: "#FFFFFF"
      }
    }
  },
  plugins: []
};

export default config;
