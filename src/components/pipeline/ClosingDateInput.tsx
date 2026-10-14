import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CLOSING_DATE_SETTLE_MS, classifyClosingDateDraft } from "@/lib/closingDateDraft";
import { cn, getTodayLocalDateInput } from "@/lib/utils";

export const CLOSING_DATE_PAST_MESSAGE = "A previsão de fechamento não pode ser uma data passada.";

type ClosingDateInputProps = {
  /** Previsão salva (`YYYY-MM-DD` ou `""`). */
  value: string;
  /** Chamado uma vez por decisão, só com data válida ou `""` (sem previsão). */
  onCommit: (value: string) => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * Campo de previsão de fechamento que deixa digitar. O que está sendo digitado vive num rascunho;
 * a decisão sai depois de `CLOSING_DATE_SETTLE_MS` sem digitar ou ao sair do campo
 * (regra em `src/lib/closingDateDraft.ts`). Data passada fica no campo marcada com erro até a
 * correção; ao sair do campo sem corrigir, volta à previsão salva.
 */
export function ClosingDateInput({ value, onCommit, className, "aria-label": ariaLabel }: ClosingDateInputProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  const draftRef = useRef(value);
  const badInputRef = useRef(false);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef<string | null>(null);

  valueRef.current = value;
  onCommitRef.current = onCommit;

  // Previsão trocada por fora (outra negociação, formulário limpo) só entra se ninguém está digitando.
  useEffect(() => {
    if (focusedRef.current) return;
    draftRef.current = value;
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const settle = () => {
    clearTimer();
    const decision = classifyClosingDateDraft(draftRef.current, badInputRef.current);

    if (decision.kind === "past") {
      setInvalid(true);
      if (warnedRef.current !== decision.value) {
        warnedRef.current = decision.value;
        toast.error(CLOSING_DATE_PAST_MESSAGE);
      }
      return decision;
    }

    setInvalid(false);
    warnedRef.current = null;
    if (decision.kind === "valid" && decision.value !== valueRef.current) onCommitRef.current(decision.value);
    if (decision.kind === "empty" && valueRef.current !== "") onCommitRef.current("");
    return decision;
  };

  // Fechar a tela logo depois de digitar não pode perder a data: o que está pendente é decidido na saída.
  useEffect(() => () => {
    if (!timerRef.current) return;
    clearTimer();
    const decision = classifyClosingDateDraft(draftRef.current, badInputRef.current);
    if (decision.kind === "valid" && decision.value !== valueRef.current) onCommitRef.current(decision.value);
    if (decision.kind === "empty" && valueRef.current !== "") onCommitRef.current("");
  }, []);

  return (
    <Input
      type="date"
      min={getTodayLocalDateInput()}
      value={draft}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) => {
        draftRef.current = event.target.value;
        badInputRef.current = event.target.validity?.badInput ?? false;
        setDraft(event.target.value);
        clearTimer();
        timerRef.current = setTimeout(settle, CLOSING_DATE_SETTLE_MS);
      }}
      onBlur={() => {
        focusedRef.current = false;
        const decision = settle();
        if (decision.kind === "past" || decision.kind === "incomplete") {
          draftRef.current = valueRef.current;
          badInputRef.current = false;
          warnedRef.current = null;
          setDraft(valueRef.current);
          setInvalid(false);
        }
      }}
      className={cn(className, invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive")}
    />
  );
}
