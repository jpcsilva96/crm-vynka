import { supabase } from "@/integrations/supabase/client";
import { extractMentionedUsers, mapMentionPayload, type CommentMention, type MentionableUser } from "@/lib/commentMentions";

const db = supabase as any;

export interface DealComment {
  id: string;
  dealId: string;
  authorUserId?: string;
  authorName: string;
  message: string;
  mentions: CommentMention[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const mapRow = (row: any): DealComment => ({
  id: row.id,
  dealId: row.deal_id,
  authorUserId: row.author_user_id || undefined,
  authorName: row.author_name,
  message: row.message,
  mentions: mapMentionPayload(row.mentions),
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function fetchDealComments(dealId: string): Promise<DealComment[]> {
  const { data, error } = await supabase
    .from("crm_deal_comments")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function createDealComment(input: {
  dealId: string;
  authorUserId?: string;
  authorName: string;
  message: string;
  mentionableUsers: MentionableUser[];
}): Promise<DealComment> {
  const payload = {
    deal_id: input.dealId,
    author_user_id: input.authorUserId || null,
    author_name: input.authorName.trim(),
    message: input.message.trim(),
    mentions: extractMentionedUsers(input.message, input.mentionableUsers),
  };

  const { data, error } = await db.from("crm_deal_comments").insert(payload).select("*").single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateDealComment(input: {
  commentId: string;
  message: string;
  mentionableUsers: MentionableUser[];
}): Promise<DealComment> {
  const payload = {
    message: input.message.trim(),
    mentions: extractMentionedUsers(input.message, input.mentionableUsers),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("crm_deal_comments")
    .update(payload)
    .eq("id", input.commentId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteDealComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("crm_deal_comments").delete().eq("id", commentId);
  if (error) throw error;
}
