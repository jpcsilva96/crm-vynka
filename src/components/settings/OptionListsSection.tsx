import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { activeOptions, type OptionKind } from "@/lib/optionLists";
import { useOptionListsStore } from "@/lib/optionListsStore";

const TITULOS: Record<OptionKind, { titulo: string; descricao: string; campo: string }> = {
  segment: {
    titulo: "Segmentos",
    descricao: "Oferecidos no campo Segmento do cadastro de empresa.",
    campo: "segmento",
  },
  contact_role: {
    titulo: "Cargos",
    descricao: "Oferecidos no campo Cargo do cadastro de contato.",
    campo: "cargo",
  },
};

function ListaDeOpcoes({ kind, podeEditar }: { kind: OptionKind; podeEditar: boolean }) {
  const options = useOptionListsStore((state) => state.options);
  const { addOption, renameOption, setOptionActive, reorderOptions } = useOptionListsStore();
  const [novo, setNovo] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const doTipo = options.filter((item) => item.kind === kind).sort((a, b) => a.position - b.position);
  const ativos = activeOptions(doTipo);
  const { titulo, descricao, campo } = TITULOS[kind];

  const criar = async () => {
    if (!novo.trim()) return;
    if (await addOption(kind, novo)) setNovo("");
  };

  const salvarNome = async (id: string) => {
    if (await renameOption(id, rascunho)) setEditandoId(null);
  };

  const mover = (id: string, direcao: -1 | 1) => {
    const ordem = doTipo.map((item) => item.id);
    const de = ordem.indexOf(id);
    const para = de + direcao;
    if (de < 0 || para < 0 || para >= ordem.length) return;
    [ordem[de], ordem[para]] = [ordem[para], ordem[de]];
    void reorderOptions(kind, ordem);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <p className="text-xs text-muted-foreground">
          {ativos.length} em uso de {doTipo.length} cadastrados
        </p>
      </div>

      {podeEditar && (
        <div className="mb-4 flex gap-2">
          <Input
            value={novo}
            onChange={(event) => setNovo(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && criar()}
            placeholder={`Novo ${campo}`}
            className="h-9"
          />
          <Button onClick={criar} disabled={!novo.trim()} size="sm" className="h-9 gap-1.5">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {doTipo.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2",
              !item.isActive && "bg-muted/40",
            )}
          >
            {editandoId === item.id ? (
              <>
                <Input
                  value={rascunho}
                  onChange={(event) => setRascunho(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && salvarNome(item.id)}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-8" onClick={() => salvarNome(item.id)}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditandoId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className={cn("flex-1 text-sm", !item.isActive && "text-muted-foreground line-through")}>
                  {item.label}
                </span>
                {!item.isActive && <span className="text-xs text-muted-foreground">fora da lista</span>}
                {podeEditar && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={index === 0}
                      onClick={() => mover(item.id, -1)}
                      aria-label={`Subir ${item.label}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={index === doTipo.length - 1}
                      onClick={() => mover(item.id, 1)}
                      aria-label={`Descer ${item.label}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => {
                        setEditandoId(item.id);
                        setRascunho(item.label);
                      }}
                      aria-label={`Renomear ${item.label}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => void setOptionActive(item.id, !item.isActive)}
                      aria-label={item.isActive ? `Tirar ${item.label} da lista` : `Devolver ${item.label} à lista`}
                    >
                      {item.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OptionListsSection({ podeEditar }: { podeEditar: boolean }) {
  const fetchOptions = useOptionListsStore((state) => state.fetchOptions);
  const hasFetched = useOptionListsStore((state) => state.hasFetched);

  useEffect(() => {
    if (!hasFetched) void fetchOptions();
  }, [fetchOptions, hasFetched]);

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        As listas valem para toda a conta, não por workspace. <strong>Tirar uma opção da lista não apaga
        o que já está gravado</strong>: o registro continua mostrando o valor dele, que só deixa de ser
        oferecido em novas escolhas.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <ListaDeOpcoes kind="segment" podeEditar={podeEditar} />
        <ListaDeOpcoes kind="contact_role" podeEditar={podeEditar} />
      </div>
    </div>
  );
}
