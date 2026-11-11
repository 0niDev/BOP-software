import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import SearchableSelect from "./SearchableSelect";
import type { Item, ItemTag } from "../types";

interface Props {
  onClose: () => void;
  /** Parent refresh after a save. */
  onSaved: () => void;
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Bulk tag assignment: pick a tag, tick the products it belongs to, apply.
 * Ticked state is seeded from the tag's current members, so unticking an item
 * removes the tag — a wrong assignment can be undone here.
 */
export default function ItemTagsDialog({ onClose, onSaved }: Props) {
  const [tags, setTags] = useState<ItemTag[]>([]);
  const [links, setLinks] = useState<{ item_id: number; tag_id: number }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tagId, setTagId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh(selectTagId?: number | null): Promise<void> {
    const [tagData, itemList] = await Promise.all([
      api.itemTags(),
      api.items({ activeOnly: true }),
    ]);
    setTags(tagData.tags);
    setLinks(tagData.links);
    setItems(itemList);
    setTagId((current) =>
      selectTagId !== undefined ? selectTagId : current ?? tagData.tags[0]?.id ?? null,
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) setError(message(err, "Failed to load tags."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tagName = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  /** Tags already on each item, for the row chips. */
  const itemTags = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const link of links) {
      const name = tagName.get(link.tag_id);
      if (!name) continue;
      map.set(link.item_id, [...(map.get(link.item_id) ?? []), name]);
    }
    return map;
  }, [links, tagName]);

  const current = useMemo(
    () => new Set(links.filter((link) => link.tag_id === tagId).map((link) => link.item_id)),
    [links, tagId],
  );

  // Re-seed the ticks from the saved membership whenever the tag or links change.
  useEffect(() => {
    setTicked(new Set(links.filter((link) => link.tag_id === tagId).map((link) => link.item_id)));
  }, [links, tagId]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.item_name.toLowerCase().includes(query) ||
        item.item_code.toLowerCase().includes(query),
    );
  }, [items, search]);

  const add = [...ticked].filter((id) => !current.has(id));
  const remove = [...current].filter((id) => !ticked.has(id));

  function toggle(id: number): void {
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllShown(): void {
    setTicked((previous) => {
      const next = new Set(previous);
      for (const item of visibleItems) next.add(item.id);
      return next;
    });
  }

  async function createTag(): Promise<void> {
    const name = newTag.trim();
    setError(null);
    setNotice(null);
    if (!name) {
      setError("Type a tag name first.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createItemTag(name);
      setNewTag("");
      await refresh(created.id);
      setNotice(`Tag '${created.name}' created.`);
    } catch (err) {
      setError(message(err, "Failed to create the tag."));
    } finally {
      setBusy(false);
    }
  }

  async function apply(): Promise<void> {
    setError(null);
    setNotice(null);
    if (tagId == null) {
      setError("Choose a tag first.");
      return;
    }
    if (add.length === 0 && remove.length === 0) {
      setError("Nothing to change — tick or untick an item first.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.updateItemTagItems(tagId, { add, remove });
      setNotice(
        `'${tagName.get(tagId) ?? "tag"}': ${result.added} added, ${result.removed} removed.`,
      );
      await refresh(tagId);
      onSaved();
    } catch (err) {
      setError(message(err, "Failed to update the tag."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Item tags">
        <div className="row" style={{ alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>Item tags</h2>
            <p className="sub" style={{ margin: "5px 0 0" }}>
              Pick a tag, then tick every product it belongs to. Items already carrying the tag
              start ticked; untick one to remove it.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>
            {notice}
          </div>
        )}

        {loading ? (
          <p className="sub">Loading tags…</p>
        ) : (
          <>
            <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
              <div>
                <label>Tag</label>
                <SearchableSelect
                  value={tagId === null ? "" : String(tagId)}
                  onChange={(next) => setTagId(next ? Number(next) : null)}
                  placeholder={tags.length ? "Select…" : "No tags yet"}
                  options={[
                    { value: "", label: tags.length ? "Select…" : "No tags yet" },
                    ...tags.map((tag) => ({ value: String(tag.id), label: tag.name })),
                  ]}
                />
              </div>
              <div>
                <label>New tag</label>
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createTag();
                    }
                  }}
                  placeholder="bottle"
                />
              </div>
              <button type="button" onClick={() => void createTag()} disabled={busy}>
                Add tag
              </button>
              <div style={{ flex: 1 }}>
                <label>Search products</label>
                <input
                  className="filter-box"
                  placeholder="Filter by name or code…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
              <span className="sub" style={{ flex: 1 }}>
                {ticked.size} of {visibleItems.length} shown ticked
              </span>
              <button type="button" onClick={selectAllShown} disabled={busy}>
                Select all shown
              </button>
              <button className="primary" type="button" onClick={() => void apply()} disabled={busy}>
                {busy ? "Saving…" : `Apply to ${ticked.size} item(s)`}
              </button>
            </div>

            <div className="modal-scroll">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={ticked.has(item.id)}
                          onChange={() => toggle(item.id)}
                          aria-label={`Tag ${item.item_name}`}
                        />
                      </td>
                      <td>{item.item_code}</td>
                      <td>{item.item_name}</td>
                      <td>{item.item_type}</td>
                      <td>
                        {(itemTags.get(item.id) ?? []).map((name) => (
                          <span className="badge" key={name} style={{ marginRight: 4 }}>
                            {name}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="sub">
                        No products match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
