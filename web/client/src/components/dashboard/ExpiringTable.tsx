import Card from "../ui/Card";
import DataTable, { type Column } from "../ui/DataTable";
import Avatar from "../ui/Avatar";
import StatusPill from "../ui/StatusPill";
import { dayLabel } from "../../lib/format";
import type { DashboardData } from "../../types";

type ExpiringItem = DashboardData["inventory"]["expiringItems"][number];

/** Batches that expire within 30 days, soonest first. */
export default function ExpiringTable({ rows }: { rows: ExpiringItem[] }) {
  const columns: ReadonlyArray<Column<ExpiringItem>> = [
    {
      key: "item",
      header: "Item",
      width: "38%",
      sortValue: (row) => row.itemName,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.itemName} size={34} rounded={10} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink">{row.itemName}</p>
            <p className="truncate text-[12px] font-medium text-muted">{row.itemCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      sortValue: (row) => row.batchNumber,
      cell: (row) => <span className="text-[13px] font-semibold">{row.batchNumber}</span>,
    },
    {
      key: "expiry",
      header: "Expires",
      sortValue: (row) => row.expiryDate ?? "",
      cell: (row) => <span className="text-[13px] font-semibold">{row.expiryDate ? dayLabel(row.expiryDate) : "—"}</span>,
    },
    {
      key: "quantity",
      header: "Qty",
      numeric: true,
      sortValue: (row) => row.quantityInStock,
      cell: (row) => <span className="font-semibold">{row.quantityInStock.toFixed(2)}</span>,
    },
  ];

  return (
    <Card
      title="Expiring soon"
      subtitle="Batches with an expiry inside 30 days"
      outline="amber"
      compact
      action={
        rows.length > 0 ? (
          <StatusPill tone="danger">{rows.length} batches</StatusPill>
        ) : (
          <StatusPill tone="ok">None</StatusPill>
        )
      }
    >
      <DataTable
        ariaLabel="Batches expiring within 30 days"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.batchNumber}
        initialSortKey="expiry"
        initialSortDir="asc"
        minWidth={480}
        empty="No batches expiring soon."
      />
    </Card>
  );
}
