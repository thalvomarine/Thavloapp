import { StatusChip } from "@/components/mission/StatusChip";
import { labelKeyForOrder, toneForOrder, type OrderStatus } from "@/lib/orders";
import { useTranslation } from "react-i18next";

export function FulfillmentStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <StatusChip tone={toneForOrder(status)}>{t(labelKeyForOrder(status))}</StatusChip>;
}
