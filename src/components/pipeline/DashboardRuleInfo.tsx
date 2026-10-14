import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DASHBOARD_RULES, type DashboardRuleId } from "@/lib/dashboardRules";
import { cn } from "@/lib/utils";

/**
 * O "i" que explica como um número do Dashboard é calculado.
 *
 * É Popover (abre no clique), não Tooltip (abre no hover), por dois motivos medidos no desenho:
 * hover não existe em toque, e estes textos têm até três parágrafos — o leitor precisa poder
 * mantê-los abertos enquanto lê.
 */
export function DashboardRuleInfo({ ruleId, className }: { ruleId: DashboardRuleId; className?: string }) {
  const rule = DASHBOARD_RULES[ruleId];
  if (!rule) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Como “${rule.title}” é calculado`}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <p className="text-sm font-semibold leading-none">{rule.title}</p>
        {rule.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-xs leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
