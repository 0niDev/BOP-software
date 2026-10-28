/**
 * Display codes: a clean, human-readable renumbering of the chart of accounts
 * derived purely from tree position. The stored `account_code` is the real
 * identifier and is never touched — these codes exist only so the CoA page and
 * trial balance read like a proper 1 / 11 / 111 / 1111 chart.
 *
 * Scheme: top level is 1 digit and each level appends one suffix. Siblings are
 * numbered 1..9 then a1..a9, b1..b9 (a letter per block of nine), so a level's
 * width stays stable as more accounts appear.
 */
import { compareAccountCode } from "./trialBalanceLayout.js";

export interface DisplayCodeNode {
  id: number;
  parentAccountId: number | null;
  accountCode: string;
  isActive: boolean;
}

/** 1..9, then a1..a9, b1..b9 … */
function suffix(sequence: number): string {
  if (sequence <= 9) return String(sequence);
  const block = Math.floor((sequence - 1) / 9); // 1 → 'a'
  const digit = ((sequence - 1) % 9) + 1;
  return String.fromCharCode(96 + block) + digit;
}

/**
 * Map account id → display code. Active siblings come first so the default
 * (inactive-hidden) view always reads 1, 2, 3…; hidden rows take the numbers
 * after them. Orphans whose parent is not in the given rows are numbered as
 * roots, so nothing silently loses its code.
 */
export function assignDisplayCodes(
  nodes: readonly DisplayCodeNode[],
): Map<number, string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<number, DisplayCodeNode[]>();
  const roots: DisplayCodeNode[] = [];
  for (const node of nodes) {
    const parentId = node.parentAccountId;
    if (parentId != null && parentId !== node.id && byId.has(parentId)) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(node);
      childrenByParent.set(parentId, siblings);
    } else {
      roots.push(node);
    }
  }

  const order = (a: DisplayCodeNode, b: DisplayCodeNode): number =>
    a.isActive === b.isActive
      ? compareAccountCode(a.accountCode, b.accountCode)
      : a.isActive
        ? -1
        : 1;
  for (const siblings of childrenByParent.values()) siblings.sort(order);
  roots.sort(order);

  const codes = new Map<number, string>();
  const place = (
    siblings: readonly DisplayCodeNode[],
    parentCode: string,
    start = 0,
  ): void => {
    siblings.forEach((node, index) => {
      const code = parentCode + suffix(start + index + 1);
      codes.set(node.id, code);
      place(
        (childrenByParent.get(node.id) ?? []).filter((child) => !codes.has(child.id)),
        code,
      );
    });
  };
  place(roots, "");

  // Defensive: anything caught in a parent cycle has no root above it.
  const leftovers = nodes.filter((node) => !codes.has(node.id)).sort(order);
  place(leftovers, "", roots.length);

  return codes;
}
