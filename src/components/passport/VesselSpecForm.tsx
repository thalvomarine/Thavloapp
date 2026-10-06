import { useTranslation } from "react-i18next";
import {
  ENGINE_BRANDS,
  FUEL_IDS,
  VESSEL_CATEGORIES,
  VESSEL_TYPES,
  type FuelId,
  type VesselCategoryId,
} from "@/lib/marine-catalog";

export interface VesselSpec {
  name: string;
  category: string;
  vesselType: string;
  lengthM: string;
  fuel: string;
  engineBrand: string;
  engineModel: string;
}

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-cyan-400/25 bg-[#071422] px-3 text-sm text-white outline-none focus:border-cyan-300";
const labelClass = "text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70";

export function VesselSpecForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: VesselSpec;
  onChange: (next: VesselSpec) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const { t } = useTranslation();
  const patch = (partial: Partial<VesselSpec>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-400/20 bg-[#071422] p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("vessel.registry")}</p>
        <p className="mt-1 text-[12px] leading-snug text-white/50">{t("vessel.registry_sub")}</p>
      </div>

      <label className="block">
        <span className={labelClass}>{t("vessel.name")}</span>
        <input className={fieldClass} value={value.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <ChipGroup
        label={t("vessel.class")}
        value={value.category}
        options={VESSEL_CATEGORIES.map((id) => ({ id, label: t(`vessel.cat_${id}`) }))}
        onChange={(category) => patch({ category })}
      />

      <label className="block">
        <span className={labelClass}>{t("vessel.type")}</span>
        <select className={fieldClass} value={value.vesselType} onChange={(e) => patch({ vesselType: e.target.value })}>
          {VESSEL_TYPES.map((item) => (
            <option key={item.id} value={item.id} className="bg-slate-900">
              {t(`vessel.type_${item.id}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>{t("vessel.length")}</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={value.lengthM}
            onChange={(e) => patch({ lengthM: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("vessel.fuel")}</span>
          <select className={fieldClass} value={value.fuel} onChange={(e) => patch({ fuel: e.target.value })}>
            {FUEL_IDS.map((id) => (
              <option key={id} value={id} className="bg-slate-900">
                {t(`vessel.fuel_${id}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>{t("vessel.engine_brand")}</span>
          <select className={fieldClass} value={value.engineBrand} onChange={(e) => patch({ engineBrand: e.target.value })}>
            {ENGINE_BRANDS.map((brand) => (
              <option key={brand} value={brand} className="bg-slate-900">
                {brand}
              </option>
            ))}
            <option value="other" className="bg-slate-900">
              {t("vessel.other_brand")}
            </option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t("vessel.engine_model")}</span>
          <input
            className={fieldClass}
            value={value.engineModel}
            placeholder={t("vessel.engine_model_ph")}
            onChange={(e) => patch({ engineModel: e.target.value })}
          />
        </label>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-white/15 text-xs font-semibold text-white/75">
            {t("common.cancel")}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-11 flex-1 rounded-xl bg-cyan-300 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={
                "h-9 rounded-full border px-3 text-[12px] font-semibold " +
                (on ? "border-cyan-200 bg-white text-slate-900" : "border-white/15 bg-white/[0.03] text-white/75")
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function vesselTypeLabel(type: string | null | undefined, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  if (!type) return "—";
  return t(`vessel.type_${type}`, { defaultValue: type });
}

export function vesselCategoryLabel(category: string | null | undefined, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  if (!category) return "—";
  const id = category.toLowerCase() as VesselCategoryId;
  if (VESSEL_CATEGORIES.includes(id)) return t(`vessel.cat_${id}`);
  return category;
}

export function fuelLabel(fuel: string | null | undefined, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  if (!fuel) return "—";
  const id = fuel.toLowerCase().replace(/\s+/g, "_") as FuelId;
  if ((FUEL_IDS as readonly string[]).includes(id)) return t(`vessel.fuel_${id}`);
  return fuel;
}
