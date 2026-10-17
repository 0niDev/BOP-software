import Card from "../ui/Card";
import DataTable, { type Column } from "../ui/DataTable";
import Avatar from "../ui/Avatar";
import ProgressMeter from "../ui/ProgressMeter";
import StatusPill from "../ui/StatusPill";
import { percent, share } from "../../lib/format";
import type { DashboardData } from "../../types";

type LowStockItem = DashboardData["inventory"]["lowStockItems"][number];

/** Items below their minimum stock, most urgent first. */
export default function LowStockTable({
  rows,
  total,
}: {
  rows: LowStockItem[];
  total: number;
}) {
  const columns: ReadonlyArray<Column<LowStockItem>> = [
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
      key: "current",
      header: "In stock",
      numeric: true,
      sortValue: (row) => row.currentStock,
      cell: (row) => <span className="font-semibold">{row.currentStock.toFixed(2)}</span>,
    },
    {
      key: "minimum",
      header: "Minimum",
      numeric: true,
      sortValue: (row) => row.minimumStock,
      cell: (row) => <span className="font-semibold">{row.minimumStock.toFixed(2)}</span>,
    },
    {
      key: "cover",
      header: "Cover",
      width: "24%",
      sortValue: (row) => share(row.currentStock, row.minimumStock),
      cell: (row) => {
        const cover = share(row.currentStock, row.minimumStock);
        return (
          <div className="flex items-center justify-end gap-3">
            <div className="w-full max-w-[110px]">
              <ProgressMeter value={cover} tone={cover < 50 ? "danger" : "amber"} />
            </div>
            <span className="num w-[46px] shrink-0 text-[12px] font-bold text-muted">
              {percent(cover, 0)}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <Card
      title="Low stock"
      subtitle={`${rows.length} of the ${total} active items below minimum`}
      outline="amber"
      compact
      action={
        rows.length > 0 ? (
          <StatusPill tone="amber">{rows.length} to reorder</StatusPill>
        ) : (
          <StatusPill tone="ok">All covered</StatusPill>
        )
      }
    >
      <DataTable
        ariaLabel="Items below minimum stock"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.itemCode}
        initialSortKey="cover"
        initialSortDir="asc"
        minWidth={480}
        empty="Nothing below its minimum stock level."
      />
    </Card>
  );
}
