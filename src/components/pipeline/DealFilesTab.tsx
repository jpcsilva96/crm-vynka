import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, Trash2, Upload } from "lucide-react";
import type { Deal } from "@/lib/dealsStore";
import { fetchDealNote, getAttachmentSignedUrl, type DealNoteAttachment, type DealNoteDocument, upsertDealNote, uploadDealNoteAttachment } from "@/lib/dealNotes";

interface Props {
  deal: Deal;
  userName: string;
  onRegisterHistory?: (dealId: string, action: string, userName?: string) => Promise<void>;
}

const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "-";

export function DealFilesTab({ deal, userName, onRegisterHistory }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [doc, setDoc] = useState<DealNoteDocument | null>(null);
  const [attachments, setAttachments] = useState<DealNoteAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<DealNoteAttachment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  /**
   * O link nasce na hora do clique e vale uma hora. Anexo gravado antes de 10/09/2026 guardou uma
   * URL assinada que já expirou e um caminho inventado — para esses, a assinatura falha e o usuário
   * recebe um recado em vez de uma página de erro do storage.
   */
  const abrirAnexo = async (attachment: DealNoteAttachment) => {
    setAbrindo(attachment.path);
    try {
      const url = await getAttachmentSignedUrl(attachment.path);
      window.open(url, "_blank", "noreferrer");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível abrir o arquivo.",
      );
    } finally {
      setAbrindo(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const note = await fetchDealNote(deal.id);
        if (cancelled) return;
        setDoc(note);
        setAttachments(note?.attachments || []);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar arquivos da negociação.");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const handleAttachFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const attachment = await uploadDealNoteAttachment(file, deal.id);
      const nextAttachments = [...attachments, attachment];
      const saved = await upsertDealNote(deal.id, {
        contentHtml: doc?.contentHtml || "",
        contentText: doc?.contentText || "",
        attachments: nextAttachments,
        lastEditedBy: userName,
      });

      setDoc(saved);
      setAttachments(saved.attachments);

      if (onRegisterHistory) {
        await onRegisterHistory(deal.id, `anexou o arquivo "${attachment.name}" na negociação`, userName);
      }

      toast.success("Arquivo anexado com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao anexar arquivo.");
    } finally {
      setUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleRemoveAttachment = async () => {
    if (!attachmentToDelete) return;

    setRemoving(true);
    try {
      const nextAttachments = attachments.filter((item) => item.path !== attachmentToDelete.path);
      const saved = await upsertDealNote(deal.id, {
        contentHtml: doc?.contentHtml || "",
        contentText: doc?.contentText || "",
        attachments: nextAttachments,
        lastEditedBy: userName,
      });

      setDoc(saved);
      setAttachments(saved.attachments);

      if (onRegisterHistory) {
        await onRegisterHistory(deal.id, `removeu o arquivo "${attachmentToDelete.name}" da negociação`, userName);
      }

      toast.success("Arquivo removido com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao remover arquivo.");
    } finally {
      setRemoving(false);
      setAttachmentToDelete(null);
    }
  };

  return (
    <div className="space-y-6 px-8">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Arquivos da negociação</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Anexe documentos, imagens, propostas e outros arquivos importantes para esta negociação.
            </p>
          </div>

          <Badge variant="secondary">{attachments.length} arquivo(s)</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4" />
          {uploading ? "Enviando..." : "Anexar arquivo"}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground">Arquivos anexados</p>
            {attachments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum arquivo anexado a esta negociação.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.path}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      onClick={() => void abrirAnexo(attachment)}
                      disabled={abrindo === attachment.path}
                      className="inline-flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{attachment.name}</span>
                      {abrindo === attachment.path ? (
                        <span className="shrink-0 text-xs text-muted-foreground">abrindo…</span>
                      ) : null}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setAttachmentToDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Última edição</p>
              <p className="mt-1 text-sm text-muted-foreground">{doc?.lastEditedBy || userName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Atualizado em</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(doc?.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => !open && setAttachmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{attachmentToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveAttachment()} disabled={removing}>
              {removing ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
