/**
 * Checkbox tree of the chart of accounts for the custom-report heading editor.
 *
 * Only explicitly ticked nodes are stored: a ticked parent stands for its whole
 * subtree, so its descendants are shown ticked-and-disabled ("included") and
 * cannot be added twice. The balance sheet also offers the virtual
 * "Net profit (P&L)" line, which is how that statement stays balanced.
 */
import { useMemo, useState, type ReactNode } from "react";
import { matchesQuery } from "./FilterBox";
import type { Account, AccountType } from "../types";

export const NET_PROFIT_ACCOUNT_ID = 0;
const NET_PROFIT_LABEL = "Net profit (P&L)";
const OPENING_PROFIT_ACCOUNT_ID = -1;
const OPENING_PROFIT_LABEL = "Opening profit/(loss) before period";

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

interface Props {
  accounts: Account[];
  /** Account types the statement may use, in display order. */
  types: AccountType[];
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Sub-accounts left out of a selected parent. */
  excluded?: number[];
  onExcludedChange?: (ids: number[]) => void;
  /** Offer the balance sheet's unposted-profit pseudo account. */
  netProfit?: boolean;
  /** Offer profit earned before the selected P&L period. */
  openingProfit?: boolean;
}

function byCode(a: Account, b: Account): number {
  return a.account_code.localeCompare(b.account_code, undefined, { numeric: true });
}

/** Whether a selected/excluded ancestor already covers this account. */
function hasAncestor(
  account: Account,
  ids: Set<number>,
  byId: Map<number, Account>,
): boolean {
  const seen = new Set<number>([account.id]);
  let parent = account.parent_account_id;
  while (parent != null && !seen.has(parent)) {
    if (ids.has(parent)) return true;
    seen.add(parent);
    parent = byId.get(parent)?.parent_account_id ?? null;
  }
  return false;
}

export default function AccountTreePicker({
  accounts,
  types,
  selected,
  onChange,
  excluded = [],
  onExcludedChange,
  netProfit = false,
  openingProfit = false,
}: Props) {
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number, Account[]>();
    for (const account of accounts) {
      const parent = account.parent_account_id;
      if (parent == null || parent === account.id || !byId.has(parent)) continue;
      const list = map.get(parent) ?? [];
      list.push(account);
      map.set(parent, list);
    }
    for (const list of map.values()) list.sort(byCode);
    return map;
  }, [accounts, byId]);

  /** Accounts printed under a heading: selected roots minus excluded subtrees. */
  const covered = useMemo(() => {
    const ids = new Set<number>();
    const add = (id: number): void => {
      if (excludedSet.has(id) || ids.has(id)) return;
      ids.add(id);
      for (const child of childrenByParent.get(id) ?? []) add(child.id);
    };
    for (const account of accounts) {
      if (!selectedSet.has(account.id)) continue;
      if (hasAncestor(account, selectedSet, byId) || hasAncestor(account, excludedSet, byId)) {
        continue;
      }
      add(account.id);
    }
    return ids;
  }, [accounts, childrenByParent, byId, selectedSet, excludedSet]);

  /** Keep a match's ancestors visible so the tree still reads top-down. */
  const visible = useMemo(() => {
    if (!query.trim()) return null;
    const keep = new Set<number>();
    for (const account of accounts) {
      if (!matchesQuery(query, [account.account_code, account.account_name])) continue;
      let cursor: Account | undefined = account;
      while (cursor && !keep.has(cursor.id)) {
        keep.add(cursor.id);
        cursor = cursor.parent_account_id == null ? undefined : byId.get(cursor.parent_account_id);
      }
    }
    return keep;
  }, [accounts, byId, query]);

  function toggleSelected(id: number): void {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  function toggle(account: Account): void {
    const isExclusionRoot = excludedSet.has(account.id);
    if (isExclusionRoot) {
      onExcludedChange?.(excluded.filter((value) => value !== account.id));
      return;
    }
    const selectedRoot = selectedSet.has(account.id) && !hasAncestor(account, selectedSet, byId);
    if (selectedRoot) {
      onChange(selected.filter((value) => value !== account.id));
      return;
    }
    if (covered.has(account.id) && onExcludedChange) {
      onChange(selected.filter((value) => value !== account.id));
      onExcludedChange([...excluded, account.id]);
      return;
    }
    if (hasAncestor(account, excludedSet, byId)) return;
    onChange([...selected, account.id]);
  }

  function row(account: Account, depth: number): ReactNode[] {
    if (visible && !visible.has(account.id)) return [];
    const checked = covered.has(account.id);
    const isExclusionRoot = excludedSet.has(account.id);
    const excludedByParent = hasAncestor(account, excludedSet, byId);
    const hasChildren = (childrenByParent.get(account.id) ?? []).length > 0;
    const title = excludedByParent
      ? "Excluded by a parent account"
      : isExclusionRoot
        ? "Include this account again"
        : checked
          ? "Exclude this account from the heading"
          : "Include this account";
    const rows: ReactNode[] = [
      <label
        key={account.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: `2px 0 2px ${depth * 16}px`,
          opacity: isExclusionRoot ? 0.55 : 1,
          whiteSpace: "nowrap",
        }}
        title={title}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={excludedByParent}
          onChange={() => toggle(account)}
        />
        <span className="coa-code">{account.account_code}</span>
        <span style={{ fontWeight: hasChildren ? 600 : 400 }}>{account.account_name}</span>
        {hasChildren && (
          <span className="badge" style={{ opacity: 0.7 }}>
            includes sub-accounts
          </span>
        )}
        {isExclusionRoot && (
          <span className="badge" style={{ opacity: 0.7 }}>
            excluded
          </span>
        )}
        {account.is_active === 0 && (
          <span className="badge" style={{ opacity: 0.7 }}>
            inactive
          </span>
        )}
      </label>,
    ];
    for (const child of childrenByParent.get(account.id) ?? []) {
      if (visible && !visible.has(child.id)) continue;
      rows.push(...row(child, depth + 1));
    }
    return rows;
  }

  function roots(type: AccountType): Account[] {
    return accounts
      .filter((account) => {
        if (account.account_type !== type) return false;
        const parent = account.parent_account_id;
        return (
          parent == null ||
          !byId.has(parent) ||
          parent === account.id ||
          (visible !== null && !visible.has(parent))
        );
      })
      .sort(byCode);
  }

  const showNetProfit = netProfit && (!visible || matchesQuery(query, [NET_PROFIT_LABEL]));
  const showOpeningProfit =
    openingProfit && (!visible || matchesQuery(query, [OPENING_PROFIT_LABEL]));

  return (
    <div>
      <input
        className="filter-box"
        style={{ width: "100%", marginBottom: 6 }}
        value={query}
        placeholder="Search the chart of accounts…"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("");
        }}
      />
      <div
        style={{
          maxHeight: 280,
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 8px",
        }}
      >
        {types.map((type) => {
          const typeRows = roots(type);
          if (typeRows.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: 0.7,
                  margin: "6px 0 2px",
                }}
              >
                {TYPE_LABELS[type]}
              </div>
              {typeRows.flatMap((account) => row(account, 0))}
            </div>
          );
        })}
        {(showNetProfit || showOpeningProfit) && (
          <div style={{ marginBottom: 6 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                opacity: 0.7,
                margin: "6px 0 2px",
              }}
            >
              Computed
            </div>
            {showNetProfit && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(NET_PROFIT_ACCOUNT_ID)}
                  onChange={() => toggleSelected(NET_PROFIT_ACCOUNT_ID)}
                />
                <span>{NET_PROFIT_LABEL}</span>
                <span className="badge" style={{ opacity: 0.7 }}>
                  keeps the sheet balanced
                </span>
              </label>
            )}
            {showOpeningProfit && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(OPENING_PROFIT_ACCOUNT_ID)}
                  onChange={() => toggleSelected(OPENING_PROFIT_ACCOUNT_ID)}
                />
                <span>{OPENING_PROFIT_LABEL}</span>
                <span className="badge" style={{ opacity: 0.7 }}>
                  carried into the period
                </span>
              </label>
            )}
          </div>
        )}
        {types.every((type) => roots(type).length === 0) &&
          !showNetProfit &&
          !showOpeningProfit && (
          <p style={{ opacity: 0.7, margin: 0 }}>No matching accounts.</p>
        )}
      </div>
    </div>
  );
}
