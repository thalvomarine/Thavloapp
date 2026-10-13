import { supabase } from "@/integrations/supabase/client";
import { noteSchemaMiss, skipMissing } from "@/lib/schema-gap";
import { sanitizeMultiline, sanitizePhone, sanitizePlainText } from "@/lib/sanitize";

export const TRANSFER_CAPTAIN_BUCKET = "transfer-captain-docs";
export const TRANSFER_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const TRANSFER_DOC_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TransferUrgency = "urgent" | "soon" | "planned";
export type TransferRequestStatus = "open" | "matched" | "cancelled" | "completed";
export type TransferApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface TransferCaptainRequest {
  id: string;
  requester_id: string;
  vessel_name: string;
  marina: string | null;
  urgency: TransferUrgency;
  needed_from: string | null;
  needed_until: string | null;
  location_note: string | null;
  brief: string;
  lat: number | null;
  lng: number | null;
  status: TransferRequestStatus;
  accepted_application_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferCaptainApplication {
  id: string;
  request_id: string;
  applicant_id: string;
  full_name: string;
  phone: string | null;
  license_no: string | null;
  experience_years: number | null;
  cv_text: string | null;
  cv_path: string | null;
  license_path: string;
  id_doc_path: string | null;
  note: string | null;
  status: TransferApplicationStatus;
  created_at: string;
}

const TABLE_REQ = "transfer_captain_requests";
const TABLE_APP = "transfer_captain_applications";

// Tables land via migration; until then PostgREST may 404 — soft-fail.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function listOpenTransferRequests(): Promise<TransferCaptainRequest[]> {
  if (skipMissing(TABLE_REQ)) return [];
  const { data, error } = await db
    .from(TABLE_REQ)
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    noteSchemaMiss(TABLE_REQ, error);
    console.warn("[transfer-captain] list open", error.message);
    return [];
  }
  return (data as TransferCaptainRequest[] | null) ?? [];
}

export async function listMyTransferRequests(userId: string): Promise<TransferCaptainRequest[]> {
  if (skipMissing(TABLE_REQ)) return [];
  const { data, error } = await db
    .from(TABLE_REQ)
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    noteSchemaMiss(TABLE_REQ, error);
    console.warn("[transfer-captain] list mine", error.message);
    return [];
  }
  return (data as TransferCaptainRequest[] | null) ?? [];
}

export async function listApplicationsForRequest(
  requestId: string,
): Promise<TransferCaptainApplication[]> {
  if (skipMissing(TABLE_APP)) return [];
  const { data, error } = await db
    .from(TABLE_APP)
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) {
    noteSchemaMiss(TABLE_APP, error);
    console.warn("[transfer-captain] list apps", error.message);
    return [];
  }
  return (data as TransferCaptainApplication[] | null) ?? [];
}

export async function listMyApplications(userId: string): Promise<TransferCaptainApplication[]> {
  if (skipMissing(TABLE_APP)) return [];
  const { data, error } = await db
    .from(TABLE_APP)
    .select("*")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    noteSchemaMiss(TABLE_APP, error);
    console.warn("[transfer-captain] list my apps", error.message);
    return [];
  }
  return (data as TransferCaptainApplication[] | null) ?? [];
}

export async function createTransferRequest(input: {
  requesterId: string;
  vesselName: string;
  marina?: string;
  urgency: TransferUrgency;
  neededFrom?: string;
  neededUntil?: string;
  locationNote?: string;
  brief: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const vessel_name = sanitizePlainText(input.vesselName, 120);
  const brief = sanitizeMultiline(input.brief, 2000);
  if (vessel_name.length < 2) return { ok: false, error: "vessel" };
  if (brief.length < 8) return { ok: false, error: "brief" };

  const { data, error } = await db
    .from(TABLE_REQ)
    .insert({
      requester_id: input.requesterId,
      vessel_name,
      marina: sanitizePlainText(input.marina ?? "", 120) || null,
      urgency: input.urgency,
      needed_from: input.neededFrom || null,
      needed_until: input.neededUntil || null,
      location_note: sanitizeMultiline(input.locationNote ?? "", 400) || null,
      brief,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    noteSchemaMiss(TABLE_REQ, error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function cancelTransferRequest(requestId: string): Promise<boolean> {
  const { error } = await db
    .from(TABLE_REQ)
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "open");
  if (error) {
    noteSchemaMiss(TABLE_REQ, error);
    return false;
  }
  return true;
}

export async function uploadTransferDoc(
  userId: string,
  slot: "license" | "cv" | "id_doc",
  file: File,
): Promise<{ ok: true; path: string; mime: string } | { ok: false; error: string }> {
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!(TRANSFER_DOC_ACCEPT as readonly string[]).includes(mime)) {
    return { ok: false, error: "type" };
  }
  if (file.size <= 0 || file.size > TRANSFER_DOC_MAX_BYTES) {
    return { ok: false, error: "size" };
  }
  const path = `${userId}/${slot}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
  const { error } = await supabase.storage.from(TRANSFER_CAPTAIN_BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    noteSchemaMiss(TRANSFER_CAPTAIN_BUCKET, error);
    return { ok: false, error: error.message };
  }
  return { ok: true, path, mime };
}

export async function submitTransferApplication(input: {
  requestId: string;
  applicantId: string;
  fullName: string;
  phone?: string;
  licenseNo?: string;
  experienceYears?: number | null;
  cvText?: string;
  cvPath?: string | null;
  licensePath: string;
  idDocPath?: string | null;
  note?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const full_name = sanitizePlainText(input.fullName, 120);
  if (full_name.length < 2) return { ok: false, error: "name" };
  if (!input.licensePath) return { ok: false, error: "license" };

  const { data, error } = await db
    .from(TABLE_APP)
    .insert({
      request_id: input.requestId,
      applicant_id: input.applicantId,
      full_name,
      phone: sanitizePhone(input.phone ?? "") || null,
      license_no: sanitizePlainText(input.licenseNo ?? "", 80) || null,
      experience_years: input.experienceYears ?? null,
      cv_text: sanitizeMultiline(input.cvText ?? "", 4000) || null,
      cv_path: input.cvPath || null,
      license_path: input.licensePath,
      id_doc_path: input.idDocPath || null,
      note: sanitizeMultiline(input.note ?? "", 1000) || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    noteSchemaMiss(TABLE_APP, error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function acceptTransferApplication(applicationId: string): Promise<boolean> {
  const { error } = await db.rpc("accept_transfer_captain_application", {
    p_application_id: applicationId,
  });
  if (error) {
    noteSchemaMiss("accept_transfer_captain_application", error);
    console.warn("[transfer-captain] accept", error.message);
    return false;
  }
  return true;
}

export async function withdrawTransferApplication(applicationId: string): Promise<boolean> {
  const { error } = await db
    .from(TABLE_APP)
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("status", "pending");
  if (error) {
    noteSchemaMiss(TABLE_APP, error);
    return false;
  }
  return true;
}

export async function openTransferDoc(path: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(TRANSFER_CAPTAIN_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return true;
}
