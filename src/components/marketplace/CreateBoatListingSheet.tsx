import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  CURRENCIES,
  FEATURED_EQUIPMENT,
  FUEL_TYPES,
  HULL_TYPES,
  MARINA_PRESETS,
  marinaCoords,
  nextHue,
  type BoatListing,
  type FuelType,
  type HullType,
  type ListingCurrency,
} from "@/lib/boat-listings";
import { sanitizeMultiline, sanitizePhone, sanitizePlainText } from "@/lib/sanitize";

interface Props {
  open: boolean;
  onClose: () => void;
  sellerName: string;
  listingCount: number;
  onCreated: (listing: BoatListing) => void;
}

interface FormState {
  title: string;
  hull: HullType;
  price: string;
  currency: ListingCurrency;
  marina: string;
  year: string;
  loaM: string;
  beamM: string;
  draftM: string;
  cabins: string;
  berths: string;
  flag: string;
  engineBrand: string;
  engineHp: string;
  engineHours: string;
  fuel: FuelType;
  cruiseKn: string;
  fuelTankL: string;
  waterTankL: string;
  equipment: string[];
  description: string;
  sellerPhone: string;
}

const EMPTY: FormState = {
  title: "",
  hull: "motor",
  price: "",
  currency: "EUR",
  marina: MARINA_PRESETS[0]?.name ?? "Göcek D-Marin",
  year: "2020",
  loaM: "",
  beamM: "",
  draftM: "",
  cabins: "2",
  berths: "4",
  flag: "Türkiye",
  engineBrand: "",
  engineHp: "",
  engineHours: "",
  fuel: "diesel",
  cruiseKn: "",
  fuelTankL: "",
  waterTankL: "",
  equipment: [],
  description: "",
  sellerPhone: "",
};

const fieldClass =
  "w-full min-h-11 rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 px-2.5 text-[13px] text-white outline-none focus:border-cyan-400/70";
const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80";

export function CreateBoatListingSheet({ open, onClose, sellerName, listingCount, onCreated }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(EMPTY);
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const validateStep = (n: number): boolean => {
    if (n === 0) {
      if (form.title.trim().length < 4) {
        setError(t("boats.form_need_title"));
        return false;
      }
      if (!(Number(form.price) > 0)) {
        setError(t("boats.form_need_price"));
        return false;
      }
      return true;
    }
    if (n === 1) {
      const year = Number(form.year);
      if (!Number.isFinite(year) || year < 1950 || year > 2030) {
        setError(t("boats.form_need_year"));
        return false;
      }
      if (!(Number(form.loaM) > 0)) {
        setError(t("boats.form_need_loa"));
        return false;
      }
      return true;
    }
    if (n === 2) {
      if (form.engineBrand.trim().length < 2) {
        setError(t("boats.form_need_engine"));
        return false;
      }
      return true;
    }
    const digits = form.sellerPhone.replace(/[^\d]/g, "");
    if (form.description.trim().length < 10) {
      setError(t("boats.form_need_description"));
      return false;
    }
    if (digits.length < 10) {
      setError(t("boats.form_need_phone"));
      return false;
    }
    return true;
  };

  const goNext = () => {
    setError(null);
    if (!validateStep(step)) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const submit = () => {
    setError(null);
    if (!validateStep(3)) return;
    const marina = marinaCoords(form.marina);
    const cabins = Math.max(0, Math.round(Number(form.cabins) || 0));
    const listing: BoatListing = {
      id: `user-${Date.now()}`,
      title: sanitizePlainText(form.title, 80),
      year: Math.round(Number(form.year)),
      price: Math.round(Number(form.price)),
      currency: form.currency,
      marina: form.marina,
      region: marina.region,
      hull: form.hull,
      loaM: Number(form.loaM),
      beamM: Number(form.beamM) || 0,
      draftM: Number(form.draftM) || 0,
      engineBrand: sanitizePlainText(form.engineBrand, 80),
      engineHp: Math.round(Number(form.engineHp) || 0),
      engineHours: Math.round(Number(form.engineHours) || 0),
      fuel: form.fuel,
      flag: sanitizePlainText(form.flag, 40) || "Türkiye",
      cabins,
      berths: Math.max(cabins, Math.round(Number(form.berths) || cabins)),
      cruiseKn: Number(form.cruiseKn) || 0,
      fuelTankL: form.fuelTankL ? Number(form.fuelTankL) : null,
      waterTankL: form.waterTankL ? Number(form.waterTankL) : null,
      lat: marina.lat,
      lng: marina.lng,
      equipment: form.equipment,
      description: sanitizeMultiline(form.description, 2000),
      seller: sanitizePlainText(sellerName, 80),
      sellerPhone: sanitizePhone(form.sellerPhone, 20),
      hue: nextHue(listingCount),
    };
    onCreated(listing);
    toast.success(t("boats.create_published"));
    onClose();
  };

  const steps = [
    t("boats.step_basics"),
    t("boats.step_tech"),
    t("boats.step_engine"),
    t("boats.step_contact"),
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 z-[99] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thalvo-create-listing-title"
        className="thalvo-dark pointer-events-auto absolute inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-cyan-500/30 bg-[#0a192f]/97 shadow-2xl sm:bottom-auto sm:top-1/2 sm:max-h-[90dvh] sm:-translate-y-1/2 sm:rounded-3xl"
        style={{
          maxHeight: "90dvh",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0a192f]/97 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {t("boats.create_eyebrow")}
            </p>
            <h2 id="thalvo-create-listing-title" className="mt-1 text-base font-semibold text-white">
              {t("boats.create_listing")}
            </h2>
            <p className="mt-1 text-[11px] text-white/50">
              {t("boats.step_of", { current: step + 1, total: 4 })} · {steps[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 px-4 pt-3">
          {steps.map((label, i) => (
            <div key={label} className="min-w-0">
              <div className={`h-1 rounded-full ${i <= step ? "bg-cyan-400" : "bg-white/10"}`} />
              <p className={`mt-1 truncate text-[8px] font-semibold uppercase tracking-[0.1em] ${i === step ? "text-cyan-200" : "text-white/35"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <>
              <Field label={t("boats.form_title")}>
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder={t("boats.form_title_ph")}
                />
              </Field>
              <Field label={t("boats.hull")}>
                <div className="grid grid-cols-2 gap-1.5">
                  {HULL_TYPES.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => patch({ hull: h })}
                      className={
                        "min-h-11 rounded-lg border text-[12px] font-semibold " +
                        (form.hull === h
                          ? "border-cyan-400 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/5 text-white/70")
                      }
                    >
                      {t(`boats.hull_${h}`)}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label={t("boats.form_price")}>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => patch({ price: e.target.value })}
                    placeholder="285000"
                  />
                </Field>
                <Field label={t("boats.form_currency")}>
                  <select
                    className={`${fieldClass} pr-8`}
                    value={form.currency}
                    onChange={(e) => patch({ currency: e.target.value as ListingCurrency })}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={t("boats.form_marina")}>
                <select
                  className={fieldClass}
                  value={form.marina}
                  onChange={(e) => patch({ marina: e.target.value })}
                >
                  {MARINA_PRESETS.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("boats.year")}>
                  <input className={fieldClass} inputMode="numeric" value={form.year} onChange={(e) => patch({ year: e.target.value })} />
                </Field>
                <Field label={t("boats.flag")}>
                  <input className={fieldClass} value={form.flag} onChange={(e) => patch({ flag: e.target.value })} placeholder="TR / Delaware" />
                </Field>
                <Field label={`${t("boats.loa")} (m)`}>
                  <input className={fieldClass} inputMode="decimal" value={form.loaM} onChange={(e) => patch({ loaM: e.target.value })} />
                </Field>
                <Field label={`${t("boats.beam")} (m)`}>
                  <input className={fieldClass} inputMode="decimal" value={form.beamM} onChange={(e) => patch({ beamM: e.target.value })} />
                </Field>
                <Field label={`${t("boats.draft")} (m)`}>
                  <input className={fieldClass} inputMode="decimal" value={form.draftM} onChange={(e) => patch({ draftM: e.target.value })} />
                </Field>
                <Field label={t("boats.cabins")}>
                  <input className={fieldClass} inputMode="numeric" value={form.cabins} onChange={(e) => patch({ cabins: e.target.value })} />
                </Field>
                <Field label={t("boats.berths")}>
                  <input className={fieldClass} inputMode="numeric" value={form.berths} onChange={(e) => patch({ berths: e.target.value })} />
                </Field>
                <Field label={`${t("boats.cruise")} (kn)`}>
                  <input className={fieldClass} inputMode="decimal" value={form.cruiseKn} onChange={(e) => patch({ cruiseKn: e.target.value })} />
                </Field>
                <Field label={`${t("boats.fuel_tank")} (L)`}>
                  <input className={fieldClass} inputMode="numeric" value={form.fuelTankL} onChange={(e) => patch({ fuelTankL: e.target.value })} />
                </Field>
                <Field label={`${t("boats.water_tank")} (L)`}>
                  <input className={fieldClass} inputMode="numeric" value={form.waterTankL} onChange={(e) => patch({ waterTankL: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label={t("boats.engine_brand")}>
                <input
                  className={fieldClass}
                  value={form.engineBrand}
                  onChange={(e) => patch({ engineBrand: e.target.value })}
                  placeholder="Yanmar / Mercury"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("boats.engine_hp")}>
                  <input className={fieldClass} inputMode="numeric" value={form.engineHp} onChange={(e) => patch({ engineHp: e.target.value })} />
                </Field>
                <Field label={t("boats.hours")}>
                  <input className={fieldClass} inputMode="numeric" value={form.engineHours} onChange={(e) => patch({ engineHours: e.target.value })} />
                </Field>
              </div>
              <Field label={t("boats.fuel")}>
                <div className="grid grid-cols-2 gap-1.5">
                  {FUEL_TYPES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => patch({ fuel: f })}
                      className={
                        "min-h-11 rounded-lg border text-[12px] font-semibold " +
                        (form.fuel === f
                          ? "border-cyan-400 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/5 text-white/70")
                      }
                    >
                      {t(`boats.fuel_${f}`)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t("boats.form_equipment")}>
                <div className="grid grid-cols-1 gap-1.5">
                  {FEATURED_EQUIPMENT.map((eq) => {
                    const on = form.equipment.includes(eq);
                    return (
                      <label
                        key={eq}
                        className={
                          "flex min-h-11 items-center gap-3 rounded-lg border px-3 text-[13px] " +
                          (on ? "border-cyan-400/50 bg-cyan-400/10 text-white" : "border-white/10 bg-white/5 text-white/75")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            patch({
                              equipment: on
                                ? form.equipment.filter((x) => x !== eq)
                                : [...form.equipment, eq],
                            })
                          }
                          className="size-4 accent-cyan-400"
                        />
                        {t(`boats.eq.${eq.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`, { defaultValue: eq })}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label={t("boats.form_description")}>
                <textarea
                  className={`${fieldClass} min-h-28 py-2.5`}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder={t("boats.form_description_ph")}
                />
              </Field>
              <Field label={t("boats.form_phone")}>
                <input
                  className={fieldClass}
                  type="tel"
                  inputMode="tel"
                  value={form.sellerPhone}
                  onChange={(e) => patch({ sellerPhone: e.target.value })}
                  placeholder="+90 252 000 00 00"
                />
              </Field>
            </>
          )}

          {error && <p className="text-[12px] text-rose-300">{error}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-4 pt-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (step === 0) onClose();
              else setStep((s) => s - 1);
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/80"
          >
            <ChevronLeft className="size-3.5" />
            {step === 0 ? t("common.close") : t("boats.form_back")}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-cyan-400 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-900"
            >
              {t("boats.form_next")}
              <ChevronRight className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-300 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-900"
            >
              <Plus className="size-3.5" />
              {t("boats.form_publish")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
