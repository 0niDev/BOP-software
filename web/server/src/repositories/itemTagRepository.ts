import type { SqlDatabase } from "../db/types.js";
import { insertRow } from "./base.js";

export interface ItemTagRow {
  id: number;
  company_id: number;
  name: string;
  created_at: string;
}

export interface ItemTagLinkRow {
  item_id: number;
  tag_id: number;
}

/** Item tags and their item assignments (many-to-many). */
export class ItemTagRepository {
  constructor(private readonly db: SqlDatabase) {}

  async list(companyId = 1): Promise<ItemTagRow[]> {
    return this.db.all<ItemTagRow>(
      "SELECT * FROM item_tags WHERE company_id = ? ORDER BY name COLLATE NOCASE",
      [companyId],
    );
  }

  async listLinks(companyId = 1): Promise<ItemTagLinkRow[]> {
    return this.db.all<ItemTagLinkRow>(
      `SELECT l.item_id, l.tag_id
         FROM item_tag_links l
         JOIN item_tags t ON t.id = l.tag_id
        WHERE t.company_id = ?`,
      [companyId],
    );
  }

  async findById(id: number): Promise<ItemTagRow | undefined> {
    return this.db.get<ItemTagRow>("SELECT * FROM item_tags WHERE id = ?", [id]);
  }

  /** Case-insensitive lookup so "Bottle" and "bottle" cannot both exist. */
  async findByName(name: string, companyId = 1): Promise<ItemTagRow | undefined> {
    return this.db.get<ItemTagRow>(
      "SELECT * FROM item_tags WHERE company_id = ? AND LOWER(name) = LOWER(?)",
      [companyId, name],
    );
  }

  async insert(companyId: number, name: string): Promise<number> {
    return insertRow(this.db, "item_tags", { company_id: companyId, name });
  }

  async addLinks(tagId: number, itemIds: readonly number[]): Promise<number> {
    let added = 0;
    for (const itemId of itemIds) {
      const result = await this.db.run(
        "INSERT OR IGNORE INTO item_tag_links (item_id, tag_id) VALUES (?, ?)",
        [itemId, tagId],
      );
      if (result.changes > 0) {
        await this.record(itemId, tagId, "ADD");
        added += 1;
      }
    }
    return added;
  }

  async removeLinks(tagId: number, itemIds: readonly number[]): Promise<number> {
    let removed = 0;
    for (const itemId of itemIds) {
      const result = await this.db.run(
        "DELETE FROM item_tag_links WHERE item_id = ? AND tag_id = ?",
        [itemId, tagId],
      );
      if (result.changes > 0) {
        await this.record(itemId, tagId, "REMOVE");
        removed += 1;
      }
    }
    return removed;
  }

  /** Append one assignment event; reports replay these to get tags as at a date. */
  private async record(
    itemId: number,
    tagId: number,
    action: "ADD" | "REMOVE",
  ): Promise<void> {
    await this.db.run(
      "INSERT INTO item_tag_history (item_id, tag_id, action) VALUES (?, ?, ?)",
      [itemId, tagId, action],
    );
  }
}
