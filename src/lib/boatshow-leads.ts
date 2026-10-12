import { supabase } from "@/integrations/supabase/client";
import { SUPERADMIN_EMAIL } from "@/lib/superadmin";

export type BoatshowLeadKind =
  | "brand"
  | "dealer"
  | "marina"
  | "captain"
  | "technician"
  | "other";

export interface BoatshowLeadInput {
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  kind: BoatshowLeadKind;
  note: string | null;
  source: string;
}

export type BoatshowLeadResult =
  | { stored: "db" }
  | { stored: "mailto"; mailto: string };

/** Persist a show-floor lead. Prefer Supabase; fall back to mailto if the table is not live yet. */
export async function submitBoatshowLead(input: BoatshowLeadInput): Promise<BoatshowLeadResult> {
  const row = {
    full_name: input.name,
    company: input.company,
    phone: input.phone,
    email: input.email,
    kind: input.kind,
    note: input.note,
    source: input.source,
  };

  // Table lands via migration; generated Database types may lag until regen.
  const { error } = await supabase.from("boatshow_leads" as never).insert(row as never);

  if (!error) return { stored: "db" };

  // Table missing / RLS — still give the booth a reliable handoff.
  const subject = encodeURIComponent(`THALVO boat show · ${input.kind} · ${input.name}`);
  const body = encodeURIComponent(
    [
      `Kind: ${input.kind}`,
      `Name: ${input.name}`,
      `Company: ${input.company ?? "—"}`,
      `Phone: ${input.phone}`,
      `Email: ${input.email ?? "—"}`,
      `Note: ${input.note ?? "—"}`,
      `Source: ${input.source}`,
    ].join("\n"),
  );
  return {
    stored: "mailto",
    mailto: `mailto:${SUPERADMIN_EMAIL}?subject=${subject}&body=${body}`,
  };
}
