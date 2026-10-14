import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, Link2, List, ListOrdered, Save, Type, Upload } from "lucide-react";
import type { Deal } from "@/lib/dealsStore";
import { fetchDealNote, type DealNoteAttachment, type DealNoteDocument, upsertDealNote, uploadDealNoteAttachment } from "@/lib/dealNotes";

interface Props {
  deal: Deal;
  userName: string;
  onRegisterHistory?: (dealId: string, action: string, userName?: string) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved";

const ALLOWED_NOTE_TAGS = new Set(["A", "B", "BR", "DIV", "EM", "I", "LI", "OL", "P", "SPAN", "STRONG", "U", "UL"]);
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sanitizeUrl = (value: string) => {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

const sanitizeNoteHtml = (dirtyHtml: string) => {
  const template = document.createElement("template");
  template.innerHTML = dirtyHtml;

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    if (!ALLOWED_NOTE_TAGS.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (element.tagName === "A" && name === "href") {
        const safeUrl = sanitizeUrl(attribute.value);
        if (safeUrl) element.setAttribute("href", safeUrl);
        else element.removeAttribute("href");
        continue;
      }

      if (element.tagName === "A" && (name === "target" || name === "rel")) continue;
      element.removeAttribute(attribute.name);
    }

    if (element.tagName === "A") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noreferrer");
    }

    for (const child of Array.from(element.childNodes)) {
      sanitizeNode(child);
    }
  };

  for (const child of Array.from(template.content.childNodes)) {
    sanitizeNode(child);
  }

  return template.innerHTML;
};

const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";

export function DealNotesTab({ deal, userName, onRegisterHistory }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [doc, setDoc] = useState<DealNoteDocument | null>(null);
  const [html, setHtml] = useState("");
  const [attachments, setAttachments] = useState<DealNoteAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [lastSavedHash, setLastSavedHash] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const note = await fetchDealNote(deal.id);
        if (cancelled) return;
        const safeHtml = sanitizeNoteHtml(note?.contentHtml || "");
        setDoc(note);
        setHtml(safeHtml);
        setAttachments(note?.attachments || []);
        setLastSavedHash(`${safeHtml}|${JSON.stringify(note?.attachments || [])}`);
        setLoaded(true);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar notas internas.");
        setLoaded(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [html]);

  const saveHash = useMemo(() => `${html}|${JSON.stringify(attachments)}`, [attachments, html]);

  useEffect(() => {
    if (!loaded || saveHash === lastSavedHash) return;

    setSaveStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const text = editorRef.current?.innerText || "";
        const safeHtml = sanitizeNoteHtml(html);
        const saved = await upsertDealNote(deal.id, {
          contentHtml: safeHtml,
          contentText: text,
          attachments,
          lastEditedBy: userName,
        });
        setHtml(safeHtml);
        setDoc(saved);
        setLastSavedHash(`${safeHtml}|${JSON.stringify(attachments)}`);
        setSaveStatus("saved");
        if (onRegisterHistory) {
          await onRegisterHistory(deal.id, "atualizou as notas internas da negociação", userName);
        }
      } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar notas internas.");
        setSaveStatus("idle");
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [attachments, deal.id, html, lastSavedHash, loaded, onRegisterHistory, saveHash, userName]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setHtml(sanitizeNoteHtml(editorRef.current?.innerHTML || ""));
  };

  const handleEditorInput = () => setHtml(sanitizeNoteHtml(editorRef.current?.innerHTML || ""));

  const handleInsertLink = () => {
    const safeUrl = sanitizeUrl(linkDraft);
    if (!safeUrl) {
      toast.error("Informe um link válido.");
      return;
    }
    runCommand("createLink", safeUrl);
    setLinkDraft("");
  };

  const handleAttachFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const attachment = await uploadDealNoteAttachment(file, deal.id);
      const nextAttachments = [...attachments, attachment];
      setAttachments(nextAttachments);
      const safeUrl = sanitizeUrl(attachment.url);
      if (!safeUrl) throw new Error("URL do anexo inválida.");
      runCommand("insertHTML", `<p><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(attachment.name)}</a></p>`);
      toast.success("Anexo enviado para as notas.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar anexo.");
    } finally {
      setUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const toolbarButton = "h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/70";

  return (
    <div className="space-y-6 px-8">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Notas internas visíveis apenas para a equipe.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use este espaço para registrar contexto, decisões, alertas e próximos passos da negociação.
            </p>
          </div>

          <Badge variant="secondary">
            {saveStatus === "saving" ? "Salvando..." : saveStatus === "saved" ? "Salvo automaticamente" : "Pronto para editar"}
          </Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4">
          <button type="button" className={toolbarButton} onClick={() => runCommand("bold")}>
            <strong>B</strong>
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("italic")}>
            <em>I</em>
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("underline")}>
            <span className="underline">U</span>
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("insertOrderedList")}>
            <ListOrdered className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("justifyLeft")}>
            <Type className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("justifyCenter")}>
            C
          </button>
          <button type="button" className={toolbarButton} onClick={() => runCommand("justifyRight")}>
            D
          </button>
          <input type="color" className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background p-1" onChange={(event) => runCommand("foreColor", event.target.value)} />
          <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando..." : "Inserir anexo"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <Input placeholder="https://exemplo.com" value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} className="max-w-sm" />
          <Button type="button" variant="outline" onClick={handleInsertLink} className="gap-2">
            <Link2 className="h-4 w-4" />
            Inserir link
          </Button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          className="min-h-[360px] w-full px-5 py-4 text-sm leading-7 text-foreground outline-none"
          data-placeholder="Escreva aqui tudo o que a equipe precisa saber sobre esta negociação..."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground">Anexos da negociação</p>
            {attachments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum anexo relacionado às notas internas.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.path}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{attachment.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : ""}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Ultima edicao</p>
              <p className="mt-1 text-sm text-muted-foreground">{doc?.lastEditedBy || userName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Atualizado em</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(doc?.updatedAt)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Status</p>
              <div className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Save className="h-4 w-4" />
                {saveStatus === "saving" ? "Salvando..." : saveStatus === "saved" ? "Salvo automaticamente" : "Aguardando edição"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
