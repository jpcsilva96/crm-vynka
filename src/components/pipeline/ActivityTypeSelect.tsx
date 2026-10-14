import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_META } from "@/lib/activityTypes";

export function ActivityTypeSelect({
  value,
  onChange,
  placeholder = "Selecione o tipo de atividade",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedMeta = ACTIVITY_TYPE_META[value as keyof typeof ACTIVITY_TYPE_META];
  const SelectedIcon = selectedMeta?.icon ?? ClipboardCheck;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-10 w-full justify-between px-3 font-normal", className)}
        >
          <span className="flex items-center gap-2 truncate text-sm text-foreground">
            <SelectedIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedMeta?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tipo..." />
          <CommandList>
            <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
            <CommandGroup>
              {ACTIVITY_TYPES.map((type) => {
                const meta = ACTIVITY_TYPE_META[type as keyof typeof ACTIVITY_TYPE_META];
                const Icon = meta?.icon ?? ClipboardCheck;

                return (
                  <CommandItem
                    key={type}
                    value={type}
                    onSelect={() => {
                      onChange(type);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{meta?.label ?? type}</span>
                    <Check className={cn("h-4 w-4", value === type ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
