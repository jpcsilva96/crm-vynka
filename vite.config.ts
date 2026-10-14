import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const readProjectEnv = () => {
  const envPath = path.resolve(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {} as Record<string, string>;

  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return env;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return env;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return env;
    }, {});
};

const projectEnv = readProjectEnv();
// O backend vem SÓ do `.env`. Nada de URL/chave fixa aqui: no app-variance de origem um bloco
// fixo tinha precedência sobre o `.env` e fazia `npm run dev` falar com a produção do cliente.
const getProjectEnv = (key: string) => projectEnv[key] ?? process.env[key] ?? "";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 56959,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(getProjectEnv("VITE_SUPABASE_URL")),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(getProjectEnv("VITE_SUPABASE_PUBLISHABLE_KEY")),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(getProjectEnv("VITE_SUPABASE_PROJECT_ID")),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
