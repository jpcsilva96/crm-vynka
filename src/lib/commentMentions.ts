import type { UserProfile } from "@/lib/usersStore";

export interface MentionableUser {
  id: string;
  name: string;
  email: string;
  handle: string;
}

export interface CommentMention {
  userId?: string;
  userName: string;
  userEmail?: string;
  handle: string;
}

const normalizeMentionText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._\s-]/g, "")
    .trim()
    .replace(/\s+/g, ".");

const getEmailHandle = (email: string) => normalizeMentionText(email.split("@")[0] || email);

export const buildMentionableUsers = (users: UserProfile[]) => {
  const usedHandles = new Set<string>();

  return users
    .filter((user) => user.email?.trim())
    .map((user) => {
      const baseNameHandle = normalizeMentionText(user.name || "");
      const baseEmailHandle = getEmailHandle(user.email);
      let handle = baseNameHandle || baseEmailHandle || `usuario.${user.id.slice(0, 8)}`;

      if (usedHandles.has(handle)) {
        handle = baseEmailHandle || handle;
      }

      let suffix = 2;
      while (usedHandles.has(handle)) {
        handle = `${baseEmailHandle || baseNameHandle || "usuario"}.${suffix}`;
        suffix += 1;
      }

      usedHandles.add(handle);

      return {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        handle,
      } satisfies MentionableUser;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
};

export const findMentionQuery = (value: string, caretPosition: number) => {
  const boundedCaret = Math.max(0, Math.min(caretPosition, value.length));
  let cursor = boundedCaret - 1;

  while (cursor >= 0) {
    const char = value[cursor];
    if (char === "@") {
      if (cursor === 0 || /\s/.test(value[cursor - 1])) {
        const query = value.slice(cursor + 1, boundedCaret);
        if (/^[A-Za-z0-9._-]*$/.test(query)) {
          return { start: cursor, end: boundedCaret, query: query.toLowerCase() };
        }
      }
      return null;
    }

    if (!/[A-Za-z0-9._-]/.test(char)) {
      return null;
    }

    cursor -= 1;
  }

  return null;
};

export const filterMentionableUsers = (users: MentionableUser[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return users.slice(0, 6);

  return users
    .filter((user) =>
      user.handle.toLowerCase().includes(normalizedQuery)
      || user.name.toLowerCase().includes(normalizedQuery)
      || user.email.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 6);
};

export const extractMentionedUsers = (message: string, mentionableUsers: MentionableUser[]): CommentMention[] => {
  const matches = message.match(/(^|\s)@([A-Za-z0-9._-]+)/g) || [];
  const handleMap = new Map(mentionableUsers.map((user) => [user.handle.toLowerCase(), user]));
  const mentions = new Map<string, CommentMention>();

  matches.forEach((entry) => {
    const handle = entry.trim().slice(1).toLowerCase();
    const mentionedUser = handleMap.get(handle);

    if (mentionedUser) {
      mentions.set(mentionedUser.email.toLowerCase(), {
        userId: mentionedUser.id,
        userName: mentionedUser.name,
        userEmail: mentionedUser.email,
        handle: mentionedUser.handle,
      });
      return;
    }

    mentions.set(handle, {
      userName: handle,
      handle,
    });
  });

  return Array.from(mentions.values());
};

export const mapMentionPayload = (value: unknown): CommentMention[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          userName: entry,
          handle: entry,
        } satisfies CommentMention;
      }

      if (entry && typeof entry === "object") {
        const userId = "userId" in entry && typeof entry.userId === "string" ? entry.userId : undefined;
        const userName = "userName" in entry && typeof entry.userName === "string"
          ? entry.userName
          : "name" in entry && typeof entry.name === "string"
            ? entry.name
            : "handle" in entry && typeof entry.handle === "string"
              ? entry.handle
              : null;
        const userEmail = "userEmail" in entry && typeof entry.userEmail === "string"
          ? entry.userEmail
          : "email" in entry && typeof entry.email === "string"
            ? entry.email
            : undefined;
        const handle = "handle" in entry && typeof entry.handle === "string"
          ? entry.handle
          : userEmail
            ? getEmailHandle(userEmail)
            : userName;

        if (!userName || !handle) return null;

        return {
          userId,
          userName,
          userEmail,
          handle,
        } satisfies CommentMention;
      }

      return null;
    })
    .filter(Boolean) as CommentMention[];
};
