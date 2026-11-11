-- Free-form item tags (e.g. "bottle"), many-to-many with items.
-- Run against the hosted SQLite Cloud database by hand (see DEPLOYMENT.md).
CREATE TABLE IF NOT EXISTS item_tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    name            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS item_tag_links (
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES item_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_item_tag_links_tag ON item_tag_links(tag_id);
