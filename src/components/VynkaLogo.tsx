import { cn } from "@/lib/utils";

interface VynkaLogoProps {
  className?: string;
  /** "light": sobre fundo do tema (segue a cor do texto). "dark": sobre a barra escura, sempre branco. */
  variant?: "light" | "dark";
}

/**
 * Logotipo VYNKA, copiado do vynka-main: Inter fina com tracking largo (classe `vynka-wordmark`
 * no index.css), com o K e o A espelhados para ecoar o símbolo da marca (as setas do favicon).
 */
export function VynkaLogo({ className, variant = "light" }: VynkaLogoProps) {
  return (
    <span
      aria-label="VYNKA"
      role="img"
      className={cn(
        "vynka-wordmark inline-flex select-none items-center text-[15px] leading-none",
        variant === "light" ? "text-foreground" : "text-white",
        className,
      )}
    >
      <span aria-hidden="true">VYN</span>
      <span aria-hidden="true" className="inline-block" style={{ transform: "scaleX(-1)" }}>
        K
      </span>
      <span aria-hidden="true" className="ml-[0.35em] inline-block" style={{ transform: "scaleX(-1)" }}>
        A
      </span>
    </span>
  );
}
