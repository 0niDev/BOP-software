import Card from "../ui/Card";
import DataTable, { type Column } from "../ui/DataTable";
import Avatar from "../ui/Avatar";
import ProgressMeter from "../ui/ProgressMeter";
import { money, percent, share } from "../../lib/format";
import type { DashboardData } from "../../types";

type TopItem = DashboardData["topItems"][number];

/** Row 3: what actually sells, with the revenue share drawn as a bar. */
export default function BestSellersTable({ rows }: { rows: TopItem[] }) {
  const best = rows.reduce((max, row) => Math.max(max, row.revenue), 0);

  const columns: ReadonlyArray<Column<TopItem>> = [
    {
      key: "item",
      header: "Item",
      width: "34%",
      sortValue: (row) => row.itemName,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.itemName} size={36} rounded={11} />
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold text-ink">{row.itemName}</p>
            <p className="truncate text-[12px] font-medium text-muted">{row.itemCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: "customers",
      header: "Buyers",
      numeric: true,
      sortValue: (row) => row.customers,
      cell: (row) => <span className="text-[13.5px] font-semibold">{row.customers}</span>,
    },
    {
      key: "quantity",
      header: "Qty sold",
      numeric: true,
      sortValue: (row) => row.quantity,
      cell: (row) => (
        <span className="text-[13.5px] font-semibold">
          {row.quantity.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      numeric: true,
      sortValue: (row) => row.revenue,
      cell: (row) => <span className="font-bold">{money(row.revenue)}</span>,
    },
    {
      key: "share",
      header: "Share",
      width: "20%",
      sortValue: (row) => row.revenue,
      cell: (row) => (
        <div className="flex items-center justify-end gap-3">
          <div className="w-full max-w-[120px]">
            <ProgressMeter value={share(row.revenue, best)} tone="brand" />
          </div>
          <span className="num w-[46px] shrink-0 text-[12px] font-bold text-muted">
            {percent(share(row.revenue, best), 0)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Best sellers"
      subtitle="Ranked by invoiced revenue · click a column to sort"
      outline="cyan"
      bodyClassName="mt-1"
    >
      <DataTable
        ariaLabel="Best selling items"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.itemCode}
        initialSortKey="revenue"
        initialSortDir="desc"
        minWidth={560}
        empty="No confirmed sales yet."
      />
    </Card>
  );
}
