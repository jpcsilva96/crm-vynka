import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtSign, MessageSquare, MoreVertical, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createDealComment,
  deleteDealComment,
  fetchDealComments,
  updateDealComment,
  type DealComment,
} from "@/lib/dealComments";
import type { Deal } from "@/lib/dealsStore";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";
import {
  filterMentionableUsers,
  findMentionQuery,
  type CommentMention,
  type MentionableUser,
} from "@/lib/commentMentions";
import { deactivateCommentMentionAlerts, syncCommentMentionAlerts } from "@/lib/userAlerts";

interface Props {
  deal: Deal;
  userName: string;
  authorUserId?: string;
  authorEmail?: string;
  workspaceId: string;
  mentionableUsers: MentionableUser[];
  onRegisterHistory?: (dealId: string, action: string, userName?: string) => Promise<void>;
}

type MentionState = {
  mode: "create" | "edit";
  start: number;
  end: number;
  query: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : null;
    const details = "details" in error && typeof error.details === "string" ? error.details : null;
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint : null;
    return [message, details, hint].filter(Boolean).join(" - ") || fallback;
  }
  return fallback;
};

const getDealDisplayName = (deal: Deal) =>
  deal.dealName?.trim() || deal.companyName?.trim() || deal.contactName?.trim() || "Negociação";

const renderCommentMessage = (message: string, mentions: CommentMention[]) => {
  const mentionByHandle = new Map(mentions.map((mention) => [mention.handle.toLowerCase(), mention]));
  const parts: Array<string | JSX.Element> = [];
  const mentionPattern = /(^|\s)@([A-Za-z0-9._-]+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(message)) !== null) {
    const [fullMatch, leadingSpace, handle] = match;
    const mention = mentionByHandle.get(handle.toLowerCase());
    if (!mention) continue;

    const mentionStart = match.index + leadingSpace.length;
    if (mentionStart > cursor) {
      parts.push(message.slice(cursor, mentionStart));
    }

    parts.push(
      <span
        key={`${mention.handle}-${match.index}`}
        className="inline-flex max-w-full align-baseline font-semibold text-[#ff3366] [overflow-wrap:anywhere]"
      >
        @{mention.userName}
      </span>,
    );

    cursor = match.index + fullMatch.length;
  }

  if (cursor < message.length) {
    parts.push(message.slice(cursor));
  }

  return parts.length > 0 ? parts : message;
};

export function DealCommentsTab({
  deal,
  userName,
  authorUserId,
  authorEmail,
  workspaceId,
  mentionableUsers,
  onRegisterHistory,
}: Props) {
  const [comments, setComments] = useState<DealComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchDealComments(deal.id);
        if (!cancelled) {
          setComments(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Erro ao carregar comentários."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const hasComments = comments.length > 0;
  const sortedComments = useMemo(
    () => [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [comments],
  );
  const mentionSuggestions = useMemo(
    () => (mentionState ? filterMentionableUsers(mentionableUsers, mentionState.query) : []),
    [mentionState, mentionableUsers],
  );

  const updateMentionState = (value: string, caretPosition: number, mode: "create" | "edit") => {
    const nextMention = findMentionQuery(value, caretPosition);
    setMentionState(nextMention ? { ...nextMention, mode } : null);
  };

  const applyMention = (user: MentionableUser) => {
    if (!mentionState) return;

    const sourceValue = mentionState.mode === "create" ? draft : editingDraft;
    const nextValue = `${sourceValue.slice(0, mentionState.start)}@${user.handle} ${sourceValue.slice(mentionState.end)}`;
    const nextCaret = mentionState.start + user.handle.length + 2;

    if (mentionState.mode === "create") {
      setDraft(nextValue);
      setMentionState(null);
      requestAnimationFrame(() => {
        composerRef.current?.focus();
        composerRef.current?.setSelectionRange(nextCaret, nextCaret);
      });
      return;
    }

    setEditingDraft(nextValue);
    setMentionState(null);
    requestAnimationFrame(() => {
      editRef.current?.focus();
      editRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  /**
   * O aviso de menção é um efeito do comentário, não parte dele. Se falhar, o comentário GRAVADO
   * continua na tela — antes o erro subia junto e a linha recém-salva sumia até o F5, o que a
   * equipe leu como "deu erro, não salvou". O aviso quebrado vira um recado discreto.
   */
  const registerCommentMentions = async (input: {
    commentId: string;
    currentMentions: CommentMention[];
    previousMentions?: CommentMention[];
  }) => {
    if (!workspaceId) return;

    await syncCommentMentionAlerts({
      workspaceId,
      dealId: deal.id,
      dealName: getDealDisplayName(deal),
      commentId: input.commentId,
      authorName: userName || "Equipe",
      authorEmail,
      currentMentions: input.currentMentions,
      previousMentions: input.previousMentions,
    });
  };

  const avisarMencionados = async (acao: () => Promise<void>) => {
    try {
      await acao();
    } catch (error) {
      console.error("Erro ao atualizar os avisos de menção:", error);
      toast.warning("O comentário foi salvo, mas o aviso para quem foi mencionado não saiu.");
    }
  };

  const handleCreateComment = async () => {
    const message = draft.trim();
    if (!message) {
      toast.error("Escreva um comentário antes de enviar.");
      return;
    }

    setSaving(true);
    try {
      const created = await createDealComment({
        dealId: deal.id,
        authorUserId,
        authorName: userName || "Equipe",
        message,
        mentionableUsers,
      });

      await avisarMencionados(() =>
        registerCommentMentions({
          commentId: created.id,
          currentMentions: created.mentions,
        }),
      );

      setComments((current) => [created, ...current]);
      setDraft("");
      setComposerOpen(false);
      setMentionState(null);
      toast.success("Comentário adicionado.");

      try {
        await onRegisterHistory?.(deal.id, "adicionou um comentário na negociação", userName);
      } catch (historyError) {
        console.error("Erro ao registrar histórico do comentário:", historyError);
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Erro ao adicionar comentário."));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (comment: DealComment) => {
    setEditingCommentId(comment.id);
    setEditingDraft(comment.message);
    setMentionState(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId) return;
    const message = editingDraft.trim();
    if (!message) {
      toast.error("O comentário não pode ficar vazio.");
      return;
    }

    const previousComment = comments.find((comment) => comment.id === editingCommentId);

    setSaving(true);
    try {
      const updated = await updateDealComment({
        commentId: editingCommentId,
        message,
        mentionableUsers,
      });

      await avisarMencionados(() =>
        registerCommentMentions({
          commentId: editingCommentId,
          currentMentions: updated.mentions,
          previousMentions: previousComment?.mentions || [],
        }),
      );

      setComments((current) => current.map((comment) => (comment.id === editingCommentId ? updated : comment)));
      setEditingCommentId(null);
      setEditingDraft("");
      setMentionState(null);
      toast.success("Comentário atualizado.");

      try {
        await onRegisterHistory?.(deal.id, "editou um comentário da negociação", userName);
      } catch (historyError) {
        console.error("Erro ao registrar histórico da edição do comentário:", historyError);
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Erro ao atualizar comentário."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setSaving(true);
    try {
      await deleteDealComment(commentId);
      await avisarMencionados(() => deactivateCommentMentionAlerts(commentId));
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingDraft("");
      }
      setMentionState(null);
      toast.success("Comentário removido.");

      try {
        await onRegisterHistory?.(deal.id, "removeu um comentário da negociação", userName);
      } catch (historyError) {
        console.error("Erro ao registrar histórico da remoção do comentário:", historyError);
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Erro ao remover comentário."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 sm:px-6 xl:px-8">
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Comentários</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Converse com a equipe dentro da negociação. Digite `@` para mencionar usuários do sistema.
          </p>
        </div>

        <div className="border-b border-border px-5 py-4">
          {!composerOpen ? (
            <Button type="button" variant="outline" className="gap-2" onClick={() => setComposerOpen(true)}>
              <MessageSquare className="h-4 w-4" />
              Adicionar comentário
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraft(nextValue);
                    updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length, "create");
                  }}
                  onClick={(event) => updateMentionState(draft, event.currentTarget.selectionStart ?? draft.length, "create")}
                  onKeyUp={(event) => updateMentionState(draft, event.currentTarget.selectionStart ?? draft.length, "create")}
                  placeholder="Escreva um comentário para a equipe..."
                  className="min-h-[120px] resize-none"
                  autoFocus
                />
                {mentionState?.mode === "create" && mentionSuggestions.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {mentionSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted")}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyMention(user);
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <AtSign className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{user.handle} · {user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>Use `@` para mencionar alguém do workspace.</span>
                <span>{mentionableUsers.length} usuários disponíveis</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setComposerOpen(false);
                    setDraft("");
                    setMentionState(null);
                  }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="button" className="gap-2" onClick={handleCreateComment} disabled={saving}>
                  <Send className="h-4 w-4" />
                  {saving ? "Enviando..." : "Comentar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="max-h-[520px] space-y-4 overflow-x-hidden overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">
              Carregando comentários...
            </div>
          ) : !hasComments ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Nenhum comentário ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Os comentários da negociação vão aparecer aqui.</p>
            </div>
          ) : (
            sortedComments.map((comment) => {
              const isEditing = editingCommentId === comment.id;
              return (
                <div key={comment.id} className="flex w-full max-w-full min-w-0 gap-3 overflow-hidden rounded-xl border border-border bg-background px-4 py-4 shadow-sm">
                  <UserAvatar name={comment.authorName} size="sm" className="mt-0.5 h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold text-foreground">{comment.authorName}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {comment.updatedAt !== comment.createdAt ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                              Editado
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(comment)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Editar comentário
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleDelete(comment.id)} className="gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            Excluir comentário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-3">
                        <div className="relative">
                          <Textarea
                            ref={editRef}
                            value={editingDraft}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setEditingDraft(nextValue);
                              updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length, "edit");
                            }}
                            onClick={(event) => updateMentionState(editingDraft, event.currentTarget.selectionStart ?? editingDraft.length, "edit")}
                            onKeyUp={(event) => updateMentionState(editingDraft, event.currentTarget.selectionStart ?? editingDraft.length, "edit")}
                            className="min-h-[110px] resize-none"
                          />
                          {mentionState?.mode === "edit" && mentionSuggestions.length > 0 ? (
                            <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-1 shadow-lg">
                              {mentionSuggestions.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    applyMention(user);
                                  }}
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <AtSign className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">@{user.handle} · {user.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingDraft("");
                              setMentionState(null);
                            }}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                          <Button type="button" onClick={handleSaveEdit} disabled={saving}>
                            Salvar comentário
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="mt-3 block w-full max-w-full min-w-0 whitespace-pre-wrap break-all text-sm leading-6 text-foreground"
                        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                      >
                        {renderCommentMessage(comment.message, comment.mentions)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
