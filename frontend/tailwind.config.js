/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          1: "#60A5FA",  // blue-400
          2: "#A78BFA",  // violet-400
          3: "#34D399"   // emerald-400
        }
      }
    }
  },
  plugins: []
}
