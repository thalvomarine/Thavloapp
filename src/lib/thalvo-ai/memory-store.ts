import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const EMBEDDING_DIM = 1536;
const SECRET_TEXT = /\b(password|passwd|api[ _-]?key|secret|cvv|cvc)\b/i;

export interface BoatFact {
  boatBrand: string | null;
  engineBrand: string | null;
  engineModel: string | null;
  serialNumber: string | null;
}

export async function loadMemoryBlock(supabase: Client, userId: string, queryText: string): Promise<string> {
  const boats = await loadBoats(supabase, userId);
  const recent = await loadRecentMemories(supabase, userId);
  const similar = await loadSimilarMemories(supabase, userId, queryText);
  const memories = uniqueTexts([...similar, ...recent]).slice(0, 12);

  const boatLines =
    boats.length === 0
      ? "No boat is saved yet."
      : boats
          .map((boat) => {
            const bits = [
              boat.boat_brand ? `boat ${boat.boat_brand}` : null,
              boat.engine_brand ? `engine ${boat.engine_brand}` : null,
              boat.engine_model ? `model ${boat.engine_model}` : null,
              boat.serial_number ? `serial ${boat.serial_number}` : null,
            ].filter(Boolean);
            return `- ${bits.join(" · ")}`;
          })
          .join("\n");

  const memoryLines = memories.length === 0 ? "(none)" : memories.map((text) => `- ${text}`).join("\n");
  return ["=== SAVED BOATS ===", boatLines, "=== MEMORIES ===", memoryLines, "=== END MEMORY ==="].join("\n");
}

export async function rememberFact(
  supabase: Client,
  userId: string,
  memoryText: string,
  boat: BoatFact,
): Promise<{ ok: true; stored: "memory" | "memory_and_boat" } | { ok: false; error: string }> {
  const text = clip(memoryText, 500);
  if (!text) return { ok: false, error: "empty_memory" };
  if (SECRET_TEXT.test(text)) return { ok: false, error: "secrets_not_stored" };

  const embedding = await embedText(text);
  const { error } = await supabase.from("ai_memories").insert({
    user_id: userId,
    memory_text: text,
    embedding,
  });
  if (error) {
    console.error("[thalvo-ai] memory insert", error.code ?? "error");
    return { ok: false, error: "memory_unavailable" };
  }

  const savedBoat = await saveBoat(supabase, userId, boat);
  return { ok: true, stored: savedBoat ? "memory_and_boat" : "memory" };
}

export async function saveChatLine(
  supabase: Client,
  userId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const text = clip(content, 4000);
  if (!text) return;
  const { data: last, error: readError } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    console.error("[thalvo-ai] chat read", readError.code ?? "error");
    return;
  }
  if (last?.role === role && last.content === text) return;
  const { error } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role,
    content: text,
  });
  if (error) console.error("[thalvo-ai] chat insert", error.code ?? "error");
}

export interface StoredChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export async function listSessionLines(
  supabase: Client,
  userId: string,
  sessionId: string,
): Promise<StoredChatLine[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(40);
  if (error) {
    console.error("[thalvo-ai] chat list", error.code ?? "error");
    return [];
  }
  return (data ?? []).flatMap((row) => {
    if (row.role !== "user" && row.role !== "assistant") return [];
    return [{ id: row.id, role: row.role, content: row.content }];
  });
}

async function loadBoats(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("user_boats")
    .select("boat_brand, engine_brand, engine_model, serial_number")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[thalvo-ai] boats", error.code ?? "error");
    return [];
  }
  return data ?? [];
}

async function loadRecentMemories(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("ai_memories")
    .select("memory_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) {
    console.error("[thalvo-ai] memories", error.code ?? "error");
    return [];
  }
  return (data ?? []).map((row) => row.memory_text);
}

async function loadSimilarMemories(supabase: Client, userId: string, queryText: string): Promise<string[]> {
  const text = clip(queryText, 1000);
  if (!text) return [];
  const embedding = await embedText(text);
  if (!embedding) return [];
  const { data, error } = await supabase.rpc("match_ai_memories", {
    query_embedding: embedding,
    match_count: 6,
    match_user: userId,
  });
  if (error) {
    console.error("[thalvo-ai] memory match", error.code ?? "error");
    return [];
  }
  return (data ?? []).map((row) => row.memory_text);
}

async function saveBoat(supabase: Client, userId: string, boat: BoatFact): Promise<boolean> {
  const boatBrand = clip(boat.boatBrand ?? "", 80) || null;
  const engineBrand = clip(boat.engineBrand ?? "", 80) || null;
  const engineModel = clip(boat.engineModel ?? "", 80) || null;
  const serialNumber = clip(boat.serialNumber ?? "", 64) || null;
  if (!boatBrand && !engineBrand && !engineModel && !serialNumber) return false;

  let lookup = supabase
    .from("user_boats")
    .select("id")
    .eq("user_id", userId);
  if (serialNumber) lookup = lookup.eq("serial_number", serialNumber);
  else if (engineBrand && engineModel) {
    lookup = lookup.eq("engine_brand", engineBrand).eq("engine_model", engineModel);
  } else if (boatBrand) lookup = lookup.eq("boat_brand", boatBrand);
  else return false;

  const { data: existing, error: readError } = await lookup.limit(1).maybeSingle();
  if (readError) {
    console.error("[thalvo-ai] boat read", readError.code ?? "error");
    return false;
  }

  if (existing?.id) {
    const patch: {
      boat_brand?: string;
      engine_brand?: string;
      engine_model?: string;
      serial_number?: string;
    } = {};
    if (boatBrand) patch.boat_brand = boatBrand;
    if (engineBrand) patch.engine_brand = engineBrand;
    if (engineModel) patch.engine_model = engineModel;
    if (serialNumber) patch.serial_number = serialNumber;
    const { error } = await supabase
      .from("user_boats")
      .update(patch)
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) {
      console.error("[thalvo-ai] boat update", error.code ?? "error");
      return false;
    }
    return true;
  }

  const { error } = await supabase.from("user_boats").insert({
    user_id: userId,
    boat_brand: boatBrand,
    engine_brand: engineBrand,
    engine_model: engineModel,
    serial_number: serialNumber,
  });
  if (error) {
    console.error("[thalvo-ai] boat insert", error.code ?? "error");
    return false;
  }
  return true;
}

async function embedText(text: string): Promise<string | null> {
  const apiKey = (process.env.THALVO_AI_API_KEY ?? process.env.LOVABLE_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const baseURL = (process.env.THALVO_AI_BASE_URL ?? "https://ai.gateway.lovable.dev/v1").replace(/\/$/, "");
  const model = process.env.THALVO_AI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  try {
    const response = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Array<{ embedding?: unknown }> };
    const values = payload.data?.[0]?.embedding;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) return null;
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 2)) {
      return null;
    }
    return `[${values.join(",")}]`;
  } catch {
    return null;
  }
}

function uniqueTexts(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function clip(value: string, max: number): string {
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}
