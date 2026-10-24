/**
 * Audit trail. The `audit_log` table has existed since the first schema but was
 * never written; every destructive action now records one row here.
 *
 * A DELETE row carries the create-input needed to rebuild the record, so the
 * "Deleted records" screen can restore it through the normal service path
 * (which re-posts the journal and stock exactly as the original create did).
 * A RESTORE row names the DELETE it consumed, so nothing is restored twice.
 */
import type { SqlDatabase } from "../db/types.js";

export type AuditAction = "DELETE" | "UPDATE" | "RESTORE" | "DISPOSE" | "CANCEL";

export interface AuditEntry {
  id: number;
  user_id: number | null;
  action: AuditAction;
  entity_table: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export interface RecordAuditInput {
  userId?: number | null;
  action: AuditAction;
  table: string;
  entityId?: number | null;
  details?: unknown;
}

export class AuditService {
  constructor(private readonly db: SqlDatabase) {}

  async record(input: RecordAuditInput): Promise<void> {
    await this.db.run(
      `INSERT INTO audit_log (user_id, action, entity_table, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.userId ?? null,
        input.action,
        input.table,
        input.entityId ?? null,
        input.details == null ? null : JSON.stringify(input.details),
      ],
    );
  }

  /** Restorable deletions: DELETE rows without a RESTORE pointing back at them. */
  async listDeleted(limit = 200): Promise<Array<AuditEntry & { restored: boolean }>> {
    const rows = await this.db.all<AuditEntry>(
      "SELECT * FROM audit_log WHERE action IN ('DELETE', 'RESTORE') ORDER BY id DESC LIMIT ?",
      [limit],
    );
    const restoredIds = new Set<number>();
    for (const row of rows) {
      if (row.action !== "RESTORE" || !row.details) continue;
      try {
        const details = JSON.parse(row.details) as { restoredAuditId?: number };
        if (details.restoredAuditId) restoredIds.add(Number(details.restoredAuditId));
      } catch {
        // A malformed legacy row simply does not mark anything as restored.
      }
    }
    return rows
      .filter((row) => row.action === "DELETE")
      .map((row) => ({ ...row, restored: restoredIds.has(row.id) }));
  }

  async findDeletion(id: number): Promise<AuditEntry | undefined> {
    return this.db.get<AuditEntry>(
      "SELECT * FROM audit_log WHERE id = ? AND action = 'DELETE'",
      [id],
    );
  }

  async wasRestored(id: number): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      `SELECT id FROM audit_log
        WHERE action = 'RESTORE' AND details LIKE ?
        LIMIT 1`,
      [`%"restoredAuditId":${id}%`],
    );
    return row !== undefined;
  }
}
