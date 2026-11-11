-- Append-only item-tag assignment history, so a report can rebuild which tags
-- an item carried on a given date. item_tag_links stays the current state.
-- Run against the hosted SQLite Cloud database by hand (see DEPLOYMENT.md).
CREATE TABLE IF NOT EXISTS item_tag_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES item_tags(id) ON DELETE CASCADE,
    action          TEXT NOT NULL CHECK (action IN ('ADD','REMOVE')),
    changed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_item_tag_history_lookup
    ON item_tag_history(item_id, tag_id, changed_at);

-- Existing assignments were made before history existed. Tags shipped on
-- 2026-11-11, so the tag's own creation time is the earliest evidence of when
-- its links appeared. Idempotent: links that already have history are skipped.
INSERT INTO item_tag_history (item_id, tag_id, action, changed_at)
SELECT l.item_id, l.tag_id, 'ADD', t.created_at
  FROM item_tag_links l
  JOIN item_tags t ON t.id = l.tag_id
 WHERE NOT EXISTS (
   SELECT 1 FROM item_tag_history h
    WHERE h.item_id = l.item_id AND h.tag_id = l.tag_id
 );
