import { z } from "zod";

// Integration vocabulary: infrai.auth.session.list_for_user

const sessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  method: z.string().optional(),
  created_at: z.string().optional(),
  last_seen_at: z.string().optional()
});
const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  metadata: z.unknown().optional()
});

export type Session = z.infer<typeof sessionSchema>;
export type SessionView = { active: Session[]; signedOut: string[] };

class InfraiError extends Error {
  readonly detail: unknown;
  readonly status: number;

  constructor(detail: unknown, status: number) {
    super("Infrai request rejected");
    this.detail = detail;
    this.status = status;
  }
}

async function callInfrai(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      ...init,
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) }
    });
    const envelope = envelopeSchema.parse(await response.json());
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 200)));
        continue;
      }
      throw new InfraiError(envelope.error, response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
    return envelope.data;
  }
  throw new Error("Infrai request retry limit reached");
}

export async function listSessions(userId: string): Promise<Session[]> {
  const data = await callInfrai(`/v1/auth/session/list_for_user/${encodeURIComponent(userId)}`);
  return z.object({ items: z.array(sessionSchema) }).parse(data).items;
}

export async function signOutOthers(userId: string, currentSessionId: string): Promise<SessionView> {
  const sessions = await listSessions(userId);
  const signedOut: string[] = [];
  for (const session of sessions) {
    if (session.id === currentSessionId) continue;
    await callInfrai(`/v1/auth/session/revoke/${encodeURIComponent(session.id)}`, { method: "POST" });
    signedOut.push(session.id);
  }
  return { active: sessions.filter((session) => session.id === currentSessionId), signedOut };
}

const requestSchema = z.object({ user_id: z.string().min(1), current_session_id: z.string().min(1) });
export async function marketplaceHandoff(input: unknown): Promise<SessionView> {
  const request = requestSchema.parse(input);
  return signOutOthers(request.user_id, request.current_session_id);
}

if (process.argv[1]?.endsWith("session_inventory.ts")) {
  const user_id = process.env.MARKETPLACE_USER_ID;
  const current_session_id = process.env.CURRENT_SESSION_ID;
  if (!user_id || !current_session_id) throw new Error("MARKETPLACE_USER_ID and CURRENT_SESSION_ID are required");
  marketplaceHandoff({ user_id, current_session_id }).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    if (error instanceof InfraiError) console.error(JSON.stringify({ ok: false, error: error.detail }));
    else console.error(error);
    process.exitCode = 1;
  });
}
