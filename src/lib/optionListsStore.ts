import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  activeOptions,
  cleanOptionLabel,
  isDuplicateLabel,
  optionsWithCurrentValue,
  reorderedPositions,
  type OptionItem,
  type OptionKind,
} from "@/lib/optionLists";

// Os tipos gerados do Supabase ainda não conhecem crm_option_lists (tabela criada nesta entrega).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface OptionRow {
  id: string;
  kind: OptionKind;
  label: string;
  position: number | null;
  is_active: boolean | null;
}

const mapRow = (row: OptionRow): OptionItem => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  position: row.position ?? 0,
  isActive: row.is_active ?? true,
});

interface OptionListsState {
  options: OptionItem[];
  isLoading: boolean;
  hasFetched: boolean;
  fetchOptions: () => Promise<void>;
  getOptions: (kind: OptionKind) => OptionItem[];
  addOption: (kind: OptionKind, label: string) => Promise<boolean>;
  renameOption: (id: string, label: string) => Promise<boolean>;
  setOptionActive: (id: string, isActive: boolean) => Promise<void>;
  reorderOptions: (kind: OptionKind, orderedIds: string[]) => Promise<void>;
}

export const useOptionListsStore = create<OptionListsState>((set, get) => ({
  options: [],
  isLoading: false,
  hasFetched: false,

  // Lista global (decisão 13): não depende de workspace, então não manda cabeçalho de workspace.
  fetchOptions: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    const { data, error } = await db.from("crm_option_lists").select("*").order("position");
    if (error) {
      console.error("Error fetching option lists:", error);
      set({ isLoading: false });
      return;
    }
    set({ options: (data as OptionRow[] | null || []).map(mapRow), isLoading: false, hasFetched: true });
  },

  getOptions: (kind) => get().options.filter((item) => item.kind === kind),

  addOption: async (kind, label) => {
    const limpo = cleanOptionLabel(label);
    if (!limpo) return false;
    const doMesmoTipo = get().getOptions(kind);
    if (isDuplicateLabel(limpo, doMesmoTipo)) {
      toast.error("Essa opção já existe na lista");
      return false;
    }

    const position = doMesmoTipo.reduce((maior, item) => Math.max(maior, item.position), 0) + 1;
    const { data, error } = await db
      .from("crm_option_lists")
      .insert({ kind, label: limpo, position, is_active: true })
      .select("*")
      .single();

    if (error) {
      console.error("Error adding option:", error);
      toast.error("Erro ao criar a opção");
      return false;
    }
    set((state) => ({ options: [...state.options, mapRow(data)] }));
    return true;
  },

  renameOption: async (id, label) => {
    const limpo = cleanOptionLabel(label);
    if (!limpo) return false;
    const alvo = get().options.find((item) => item.id === id);
    if (!alvo) return false;
    if (isDuplicateLabel(limpo, get().getOptions(alvo.kind), id)) {
      toast.error("Essa opção já existe na lista");
      return false;
    }

    const { error } = await db
      .from("crm_option_lists")
      .update({ label: limpo, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error renaming option:", error);
      toast.error("Erro ao renomear a opção");
      return false;
    }
    set((state) => ({
      options: state.options.map((item) => (item.id === id ? { ...item, label: limpo } : item)),
    }));
    return true;
  },

  // Desativar, nunca apagar: o valor já gravado no registro continua lá (decisão 13).
  setOptionActive: async (id, isActive) => {
    const { error } = await db
      .from("crm_option_lists")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error toggling option:", error);
      toast.error("Erro ao alterar a opção");
      return;
    }
    set((state) => ({
      options: state.options.map((item) => (item.id === id ? { ...item, isActive } : item)),
    }));
  },

  reorderOptions: async (kind, orderedIds) => {
    const novas = reorderedPositions(get().getOptions(kind), orderedIds);
    set((state) => ({
      options: state.options.map((item) => {
        const nova = novas.find((entry) => entry.id === item.id);
        return nova ? { ...item, position: nova.position } : item;
      }),
    }));

    for (const { id, position } of novas) {
      const { error } = await db.from("crm_option_lists").update({ position }).eq("id", id);
      if (error) {
        console.error("Error reordering options:", error);
        toast.error("Erro ao reordenar a lista");
        return;
      }
    }
  },
}));

/**
 * Rótulos oferecidos num campo, já carregando a lista na primeira montagem.
 *
 * `current` é o valor que o registro tem hoje: ele entra na lista mesmo se a opção foi desativada
 * ou nunca existiu, para que abrir e salvar não apague o dado (ver optionsWithCurrentValue).
 */
export const useOptionLabels = (kind: OptionKind, current?: string | null): string[] => {
  const options = useOptionListsStore((state) => state.options);
  const hasFetched = useOptionListsStore((state) => state.hasFetched);
  const fetchOptions = useOptionListsStore((state) => state.fetchOptions);

  useEffect(() => {
    if (!hasFetched) void fetchOptions();
  }, [fetchOptions, hasFetched]);

  return useMemo(
    () => optionsWithCurrentValue(options.filter((item) => item.kind === kind), current),
    [current, kind, options],
  );
};
