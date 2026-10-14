import { useState, useRef, useEffect } from "react";
import { Edit2, Check, X, Copy } from "lucide-react";
import { maskPhone, maskCNPJ } from "@/lib/utils";
import { labelsWithCurrent } from "@/lib/optionLists";
import { toast } from "sonner";

interface Props {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (newValue: string) => void;
  className?: string;
  emptyLabel?: string;
  maskType?: "phone" | "cnpj";
  showCopy?: boolean;
  /**
   * Quando presente, o campo vira uma lista de escolha em vez de texto livre.
   *
   * O valor atual é sempre incluído, mesmo que a opção tenha sido desativada ou nunca tenha
   * existido na lista: sem isso, abrir e salvar apagaria o dado em silêncio.
   */
  options?: string[];
}

export function InlineEditField({ value, placeholder, multiline, onSave, className, emptyLabel = "—", maskType, showCopy, options }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, value]);

  const handleSave = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 w-full bg-muted/30 rounded px-2 py-1.5">
        {options ? (
          <select
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKey}
            className="w-full rounded border border-border bg-background text-foreground placeholder:text-muted-foreground px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{placeholder || "Selecione"}</option>
            {labelsWithCurrent(options, value).map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border rounded px-2 py-1.5 min-h-[72px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => {
              let val = e.target.value;
              if (maskType === "phone") val = maskPhone(val);
              else if (maskType === "cnpj") val = maskCNPJ(val);
              setDraft(val);
            }}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="text-sm font-semibold text-[#00adc7] hover:text-[#0094aa] transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-muted/40 cursor-pointer transition-colors ${className || ""}`}
      onClick={() => setEditing(true)}
    >
      <span className={`text-sm flex-1 ${value ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
        {value || emptyLabel}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {showCopy && value && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
              toast.success("Copiado!");
            }}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}
