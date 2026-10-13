import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Loader2, Ship, Upload, UserRound, X } from "lucide-react";
import { CockpitHeader } from "@/components/core/CockpitHeader";
import { EmptyState } from "@/components/core/EmptyState";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { getFix } from "@/lib/geolocation";
import { useProfile, useSessionUser } from "@/lib/session";
import {
  acceptTransferApplication,
  cancelTransferRequest,
  createTransferRequest,
  listApplicationsForRequest,
  listMyApplications,
  listMyTransferRequests,
  listOpenTransferRequests,
  openTransferDoc,
  submitTransferApplication,
  uploadTransferDoc,
  type TransferApplicationStatus,
  type TransferCaptainApplication,
  type TransferCaptainRequest,
  type TransferRequestStatus,
  type TransferUrgency,
} from "@/lib/transfer-captain";

type Tab = "board" | "mine" | "applications";

const URGENCY_TONE: Record<TransferUrgency, "danger" | "warning" | "info"> = {
  urgent: "danger",
  soon: "warning",
  planned: "info",
};

const REQ_STATUS_TONE: Record<TransferRequestStatus, "info" | "success" | "neutral" | "warning"> = {
  open: "info",
  matched: "success",
  cancelled: "neutral",
  completed: "success",
};

const APP_STATUS_TONE: Record<
  TransferApplicationStatus,
  "warning" | "success" | "neutral" | "danger"
> = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

export function TransferCaptainPanel() {
  const { t } = useTranslation();
  const { user } = useSessionUser();
  const { profile } = useProfile(user?.id);
  const [tab, setTab] = useState<Tab>("board");
  const [openReqs, setOpenReqs] = useState<TransferCaptainRequest[]>([]);
  const [myReqs, setMyReqs] = useState<TransferCaptainRequest[]>([]);
  const [myApps, setMyApps] = useState<TransferCaptainApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<TransferCaptainRequest | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const isClient = profile?.role === "Client";

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [open, mine, apps] = await Promise.all([
      listOpenTransferRequests(),
      listMyTransferRequests(user.id),
      listMyApplications(user.id),
    ]);
    setOpenReqs(open);
    setMyReqs(mine);
    setMyApps(apps);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) return null;

  if (profile && !isClient) {
    return (
      <GlassPanel>
        <EmptyState
          icon={<Ship className="size-4" />}
          title={t("transfer.captains_only_title")}
          body={t("transfer.captains_only_body")}
        />
      </GlassPanel>
    );
  }

  const board = openReqs.filter((r) => r.requester_id !== user.id);

  return (
    <div className="space-y-4">
      <CockpitHeader
        eyebrow={t("transfer.eyebrow")}
        title={t("transfer.title")}
        subtitle={t("transfer.subtitle")}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-11 flex-1 min-w-[10rem] rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-100"
        >
          {t("transfer.need_captain")}
        </button>
        <button
          type="button"
          onClick={() => void reload()}
          className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70"
        >
          {t("transfer.refresh")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-1">
        {(
          [
            ["board", t("transfer.tab_board")],
            ["mine", t("transfer.tab_mine")],
            ["applications", t("transfer.tab_apps")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "h-9 rounded-xl text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors " +
              (tab === key ? "bg-cyan-500/20 text-cyan-100" : "text-white/50 hover:text-white/80")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-cyan-200/70">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : tab === "board" ? (
        board.length === 0 ? (
          <GlassPanel>
            <EmptyState
              icon={<UserRound className="size-4" />}
              title={t("transfer.board_empty_title")}
              body={t("transfer.board_empty_body")}
            />
          </GlassPanel>
        ) : (
          <ul className="space-y-2">
            {board.map((req) => (
              <li key={req.id}>
                <RequestCard
                  request={req}
                  actionLabel={t("transfer.apply")}
                  onAction={() => setApplyTarget(req)}
                />
              </li>
            ))}
          </ul>
        )
      ) : tab === "mine" ? (
        myReqs.length === 0 ? (
          <GlassPanel>
            <EmptyState
              icon={<Ship className="size-4" />}
              title={t("transfer.mine_empty_title")}
              body={t("transfer.mine_empty_body")}
            />
          </GlassPanel>
        ) : (
          <ul className="space-y-2">
            {myReqs.map((req) => (
              <li key={req.id}>
                <RequestCard
                  request={req}
                  actionLabel={t("transfer.review_apps")}
                  onAction={() => setReviewId(req.id)}
                  secondary={
                    req.status === "open" ? (
                      <button
                        type="button"
                        className="text-[11px] text-white/45 underline-offset-2 hover:underline"
                        onClick={async () => {
                          const ok = await cancelTransferRequest(req.id);
                          if (!ok) toast.error(t("transfer.cancel_failed"));
                          else {
                            toast.success(t("transfer.cancel_done"));
                            void reload();
                          }
                        }}
                      >
                        {t("transfer.cancel")}
                      </button>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )
      ) : myApps.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<FileText className="size-4" />}
            title={t("transfer.apps_empty_title")}
            body={t("transfer.apps_empty_body")}
          />
        </GlassPanel>
      ) : (
        <ul className="space-y-2">
          {myApps.map((app) => (
            <li key={app.id}>
              <GlassPanel className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-white">{app.full_name}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {t("transfer.license_no")}: {app.license_no || "—"}
                    </p>
                  </div>
                  <StatusChip tone={APP_STATUS_TONE[app.status]}>
                    {t(`transfer.app_status_${app.status}`)}
                  </StatusChip>
                </div>
                {app.cv_text && (
                  <p className="text-[12px] text-white/70 whitespace-pre-wrap">{app.cv_text}</p>
                )}
              </GlassPanel>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <CreateRequestSheet
          userId={user.id}
          defaultVessel={profile?.boat_name ?? ""}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setTab("mine");
            void reload();
          }}
        />
      )}

      {applyTarget && (
        <ApplySheet
          userId={user.id}
          request={applyTarget}
          defaultName={profile?.full_name ?? ""}
          onClose={() => setApplyTarget(null)}
          onSubmitted={() => {
            setApplyTarget(null);
            setTab("applications");
            void reload();
          }}
        />
      )}

      {reviewId && (
        <ReviewSheet
          requestId={reviewId}
          onClose={() => setReviewId(null)}
          onChanged={() => {
            void reload();
          }}
        />
      )}
    </div>
  );
}

function RequestCard({
  request,
  actionLabel,
  onAction,
  secondary,
}: {
  request: TransferCaptainRequest;
  actionLabel: string;
  onAction: () => void;
  secondary?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <article className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0a192f]/90">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            {request.marina || t("transfer.marina_unknown")}
          </p>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-white">
            {request.vessel_name}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip tone={URGENCY_TONE[request.urgency]}>
            {t(`transfer.urgency_${request.urgency}`)}
          </StatusChip>
          <StatusChip tone={REQ_STATUS_TONE[request.status]}>
            {t(`transfer.req_status_${request.status}`)}
          </StatusChip>
        </div>
      </div>
      <p className="px-4 py-3 text-[13px] leading-relaxed text-white/75 whitespace-pre-wrap">
        {request.brief}
      </p>
      {request.location_note && (
        <p className="px-4 pb-2 text-[11px] text-white/45">{request.location_note}</p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-black/20 px-3 py-2">
        <div>{secondary}</div>
        <button
          type="button"
          onClick={onAction}
          className="h-9 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

function CreateRequestSheet({
  userId,
  defaultVessel,
  onClose,
  onCreated,
}: {
  userId: string;
  defaultVessel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [vesselName, setVesselName] = useState(defaultVessel);
  const [marina, setMarina] = useState("");
  const [urgency, setUrgency] = useState<TransferUrgency>("urgent");
  const [brief, setBrief] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;
    const geo = await getFix();
    if (geo.ok) {
      lat = geo.fix.lat;
      lng = geo.fix.lng;
    }
    const result = await createTransferRequest({
      requesterId: userId,
      vesselName,
      marina,
      urgency,
      brief,
      locationNote,
      lat,
      lng,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(
        result.error === "vessel"
          ? t("transfer.err_vessel")
          : result.error === "brief"
            ? t("transfer.err_brief")
            : t("transfer.create_failed"),
      );
      return;
    }
    toast.success(t("transfer.create_done"));
    onCreated();
  };

  return (
    <SheetFrame title={t("transfer.need_captain")} onClose={onClose}>
      <Field label={t("transfer.vessel")}>
        <input
          value={vesselName}
          onChange={(e) => setVesselName(e.target.value)}
          className="field"
          placeholder={t("transfer.vessel_ph")}
        />
      </Field>
      <Field label={t("transfer.marina")}>
        <input
          value={marina}
          onChange={(e) => setMarina(e.target.value)}
          className="field"
          placeholder={t("transfer.marina_ph")}
        />
      </Field>
      <Field label={t("transfer.urgency")}>
        <div className="grid grid-cols-3 gap-1.5">
          {(["urgent", "soon", "planned"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setUrgency(key)}
              className={
                "h-10 rounded-xl border text-[11px] font-semibold uppercase tracking-[0.1em] " +
                (urgency === key
                  ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                  : "border-white/10 text-white/55")
              }
            >
              {t(`transfer.urgency_${key}`)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("transfer.brief")}>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          className="field resize-none"
          placeholder={t("transfer.brief_ph")}
        />
      </Field>
      <Field label={t("transfer.location_note")}>
        <input
          value={locationNote}
          onChange={(e) => setLocationNote(e.target.value)}
          className="field"
          placeholder={t("transfer.location_note_ph")}
        />
      </Field>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/20 text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-50 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t("transfer.publish")}
      </button>
      <style>{`.field{width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);padding:.7rem .9rem;font-size:13px;color:#fff;outline:none}.field:focus{border-color:rgba(0,240,255,.45)}`}</style>
    </SheetFrame>
  );
}

function ApplySheet({
  userId,
  request,
  defaultName,
  onClose,
  onSubmitted,
}: {
  userId: string;
  request: TransferCaptainRequest;
  defaultName: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [years, setYears] = useState("");
  const [cvText, setCvText] = useState("");
  const [note, setNote] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!licenseFile) {
      toast.error(t("transfer.err_license_file"));
      return;
    }
    setBusy(true);
    const licenseUp = await uploadTransferDoc(userId, "license", licenseFile);
    if (!licenseUp.ok) {
      setBusy(false);
      toast.error(t("transfer.upload_failed"));
      return;
    }
    let cvPath: string | null = null;
    if (cvFile) {
      const cvUp = await uploadTransferDoc(userId, "cv", cvFile);
      if (!cvUp.ok) {
        setBusy(false);
        toast.error(t("transfer.upload_failed"));
        return;
      }
      cvPath = cvUp.path;
    }
    let idPath: string | null = null;
    if (idFile) {
      const idUp = await uploadTransferDoc(userId, "id_doc", idFile);
      if (!idUp.ok) {
        setBusy(false);
        toast.error(t("transfer.upload_failed"));
        return;
      }
      idPath = idUp.path;
    }
    const yearsN = years.trim() === "" ? null : Number(years);
    const result = await submitTransferApplication({
      requestId: request.id,
      applicantId: userId,
      fullName,
      phone,
      licenseNo,
      experienceYears: Number.isFinite(yearsN as number) ? (yearsN as number) : null,
      cvText,
      cvPath,
      licensePath: licenseUp.path,
      idDocPath: idPath,
      note,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(t("transfer.apply_failed"));
      return;
    }
    toast.success(t("transfer.apply_done"));
    onSubmitted();
  };

  return (
    <SheetFrame title={t("transfer.apply_title")} onClose={onClose}>
      <p className="mb-2 text-[12px] text-white/55">
        {request.vessel_name}
        {request.marina ? ` · ${request.marina}` : ""}
      </p>
      <Field label={t("transfer.full_name")}>
        <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label={t("transfer.phone")}>
        <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label={t("transfer.license_no")}>
        <input className="field" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
      </Field>
      <Field label={t("transfer.experience_years")}>
        <input
          className="field"
          inputMode="numeric"
          value={years}
          onChange={(e) => setYears(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
        />
      </Field>
      <Field label={t("transfer.cv_text")}>
        <textarea
          className="field resize-none"
          rows={4}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          placeholder={t("transfer.cv_text_ph")}
        />
      </Field>
      <FilePick
        label={t("transfer.license_file")}
        required
        file={licenseFile}
        onPick={setLicenseFile}
      />
      <FilePick label={t("transfer.cv_file")} file={cvFile} onPick={setCvFile} />
      <FilePick label={t("transfer.id_file")} file={idFile} onPick={setIdFile} />
      <Field label={t("transfer.note")}>
        <textarea
          className="field resize-none"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/20 text-[12px] font-semibold uppercase tracking-[0.14em] text-cyan-50 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t("transfer.send_application")}
      </button>
      <style>{`.field{width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);padding:.7rem .9rem;font-size:13px;color:#fff;outline:none}.field:focus{border-color:rgba(0,240,255,.45)}`}</style>
    </SheetFrame>
  );
}

function ReviewSheet({
  requestId,
  onClose,
  onChanged,
}: {
  requestId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [apps, setApps] = useState<TransferCaptainApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void listApplicationsForRequest(requestId).then((rows) => {
      setApps(rows);
      setLoading(false);
    });
  }, [requestId]);

  return (
    <SheetFrame title={t("transfer.review_apps")} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-cyan-200/70" />
        </div>
      ) : apps.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-white/50">{t("transfer.no_apps_yet")}</p>
      ) : (
        <ul className="space-y-3">
          {apps.map((app) => (
            <li
              key={app.id}
              className="rounded-2xl border border-white/10 bg-black/25 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-white">{app.full_name}</p>
                  <p className="text-[11px] text-white/45">
                    {app.license_no || "—"}
                    {app.experience_years != null
                      ? ` · ${app.experience_years} ${t("transfer.years")}`
                      : ""}
                  </p>
                  {app.phone && <p className="text-[11px] text-cyan-200/80">{app.phone}</p>}
                </div>
                <StatusChip tone={APP_STATUS_TONE[app.status]}>
                  {t(`transfer.app_status_${app.status}`)}
                </StatusChip>
              </div>
              {app.cv_text && (
                <p className="text-[12px] text-white/70 whitespace-pre-wrap">{app.cv_text}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <DocLink path={app.license_path} label={t("transfer.license_file")} />
                {app.cv_path && <DocLink path={app.cv_path} label={t("transfer.cv_file")} />}
                {app.id_doc_path && (
                  <DocLink path={app.id_doc_path} label={t("transfer.id_file")} />
                )}
              </div>
              {app.status === "pending" && (
                <button
                  type="button"
                  disabled={busyId === app.id}
                  onClick={async () => {
                    setBusyId(app.id);
                    const ok = await acceptTransferApplication(app.id);
                    setBusyId(null);
                    if (!ok) toast.error(t("transfer.accept_failed"));
                    else {
                      toast.success(t("transfer.accept_done"));
                      onChanged();
                      onClose();
                    }
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-50"
                >
                  {busyId === app.id && <Loader2 className="size-3.5 animate-spin" />}
                  {t("transfer.accept")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SheetFrame>
  );
}

function DocLink({ path, label }: { path: string; label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await openTransferDoc(path);
        if (!ok) toast.error(label);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-cyan-100"
    >
      <FileText className="size-3" />
      {label}
    </button>
  );
}

function FilePick({
  label,
  file,
  onPick,
  required,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
  required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    onPick(e.target.files?.[0] ?? null);
  };
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
        {required ? " *" : ""}
      </p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-500/5 px-3 text-left text-[12px] text-white/80"
      >
        <span className="truncate">{file ? file.name : "PDF / JPG / PNG"}</span>
        <Upload className="size-3.5 shrink-0 text-cyan-300" />
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function SheetFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={() => undefined}
        role="presentation"
      />
      <div className="relative z-[1] max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-500/25 bg-[#0a192f] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-white/10 text-white/70"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
