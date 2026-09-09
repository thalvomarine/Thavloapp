/**
 * THALVO Core Primitives — M6 Architecture Freeze.
 *
 * Single import barrel for the shared MarineOS primitives. Feature panels
 * (mission/, marketplace/, orders/, passport/, trust/, security/, admin/)
 * should consume from here going forward:
 *
 *   import { CockpitPage, MetricCard, StatusBadge } from "@/components/core";
 */
export { CockpitPage } from "./CockpitPage";
export { CockpitHeader } from "./CockpitHeader";
export { SectionHeader } from "./SectionHeader";
export { MetricCard } from "./MetricCard";
export { StatusBadge } from "./StatusBadge";
export { Timeline, TimelineStep } from "./Timeline";
export { EmptyState } from "./EmptyState";
export { RiskBanner } from "./RiskBanner";
export { DataPill } from "./DataPill";
export { MoneyAmount } from "./MoneyAmount";
export { EtaBadge } from "./EtaBadge";
export { TrustBadge } from "./TrustBadge";
