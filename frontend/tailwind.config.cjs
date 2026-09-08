module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'Inter', 'Poppins', 'sans-serif'],
      },
      colors: {
        aether: {
          blue: {
            50: '#f0f6ff',
            100: '#e0edff',
            200: '#c7deff',
            300: '#9ec4ff',
            400: '#6ba1ff',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
            950: '#0f172a',
          },
          dark: '#0F172A',
          card: '#FFFFFF',
          bg: '#F8FAFC',
          bgTint: '#EFF6FF',
        }
      }
    }
  },
  plugins: [],
}
