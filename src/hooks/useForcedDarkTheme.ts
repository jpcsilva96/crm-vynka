import { useEffect } from "react";
import { useThemeStore } from "@/lib/themeStore";

export function useForcedDarkTheme() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("dark");

    return () => {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    };
  }, [theme]);
}
