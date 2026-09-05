"""
Import historical manufacturing / formula / BOM data from PharmaPro_Export
into the current system as logs only (no inventory/stock/batch effect).

Data sources (all IsPosted=False in old books -> no financial impact):
  FormulaHeader/FormulaBody  -> bill_of_materials + bom_components (250 BOMs)
  FillingHeader/FillingBody  -> bill_of_materials + bom_components (314 BOMs)
  Productions/ProductionBody -> production_orders + production_consumption (571)
  PackingHeader/PackingBody  -> production_orders + production_consumption (617)

Rules (mirror the sales/purchase imports):
  * Products are matched by name; old products that don't exist yet are created
    as "ghost" items (is_active=0) so records can be logged against them.
  * All IDs/codes are software-generated via numbering_sequences.
  * NO stock batches, NO stock movements, NO inventory value changes.
  * production_consumption.batch_id is NOT NULL with FK to stock_batches, so a
    ghost stock_batch (is_active=0, quantity_in_stock=0) is created per
    consumption line to satisfy the FK. These are invisible to every stock
    lookup (all filter on is_active=1) and carry zero quantity.

Resumable via notes markers ("Imported from PharmaPro ...").
"""
from __future__ import annotations

import csv
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

EXPORT = r"F:\software\final\BOP-software\PharmaPro_Export"

COMPANY_TO_TYPE = {
    "00": "FINISHED_GOOD",
    "01": "RAW_MATERIAL",
    "02": "PACKING_MATERIAL",
    "03": "FINISHED_GOOD",  # UnPacked-Materials (semi-finished)
}


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def load_csv(name: str) -> list[dict]:
    with open(f"{EXPORT}\\{name}", newline="", encoding="utf-8-sig") as fh:
        return [{k.strip("\ufeff"): v for k, v in r.items()} for r in csv.DictReader(fh)]


def to_iso_date(d: str) -> str:
    if not d:
        return None
    parts = d.split(" ")[0].split("/")
    if len(parts) != 3:
        return None
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def main() -> None:
    t0 = time.time()

    # ---- parse source files ------------------------------------------------
    products = {r["ProductId"].strip(): r for r in load_csv("Products.csv")}
    formula_h = load_csv("FormulaHeader.csv")
    formula_b = load_csv("FormulaBody.csv")
    filling_h = load_csv("FillingHeader.csv")
    filling_b = load_csv("FillingBody.csv")
    productions = load_csv("Productions.csv")
    production_body = load_csv("ProductionBody.csv")
    packing_h = load_csv("PackingHeader.csv")
    packing_body = load_csv("PackingBody.csv")
    log(
        f"Parsed: {len(formula_h)} formulas, {len(filling_h)} fillings, "
        f"{len(productions)} productions, {len(packing_h)} packings"
    )

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- item lookups ------------------------------------------------------
    all_items = db.fetch_all("SELECT id, item_name, item_type FROM items WHERE company_id = 1")
    item_id_by_name = {r["item_name"]: r["id"] for r in all_items}
    log(f"Loaded {len(all_items)} existing items")

    def item_id_for(pid: str) -> int | None:
        info = products.get(pid)
        if not info or not info.get("ProductName", "").strip():
            return None
        return item_id_by_name.get(info["ProductName"].strip())

    # ---- determine ghost items needed --------------------------------------
    needed: set[str] = set()
    for rows, col in [
        (formula_h, "ProductID"), (formula_b, "ProductID"),
        (filling_h, "ProductID"), (filling_b, "ProductID"),
        (productions, "ProductID"), (production_body, "ProductID"),
        (packing_h, "ProductID"), (packing_body, "ProductID"),
    ]:
        for r in rows:
            v = (r.get(col) or "").strip()
            if v:
                needed.add(v)

    new_ghosts: list[tuple[str, str, str]] = []
    for pid in sorted(needed):
        if item_id_for(pid) is not None:
            continue
        info = products.get(pid)
        if not info or not info.get("ProductName", "").strip():
            log(f"  WARN  product {pid} has no name in Products.csv")
            continue
        new_ghosts.append(
            (
                info["ProductName"].strip(),
                COMPANY_TO_TYPE.get(info.get("CompanyId", "").strip(), "FINISHED_GOOD"),
                f"Ghost item from PharmaPro mfg import (old ProductId={pid})",
            )
        )
    log(f"New ghost items to create: {len(new_ghosts)}")

    if new_ghosts:
        try:
            with db.transaction():
                codes = journal_repo.next_voucher_numbers(1, "ITEM", len(new_ghosts))
                ghost_rows = []
                for (name, itype, note), code in zip(new_ghosts, codes):
                    ghost_rows.append(
                        (1, code, name, note, "UNIT",
                         0.0, 0.0, 0.0, 0.0, None, itype, None, 0)
                    )
                db.executemany(
                    """
                    INSERT INTO items (
                        company_id, item_code, item_name, notes, unit,
                        purchase_price, selling_price, minimum_stock, maximum_stock,
                        tax_rate_id, item_type, category_id, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    ghost_rows,
                )
                last_id = db.last_insert_id()
                first_id = last_id - len(ghost_rows) + 1
                for i, ((name, itype, note), code) in enumerate(zip(new_ghosts, codes)):
                    item_id_by_name[name] = first_id + i
            log(f"Created {len(new_ghosts)} ghost items")
        except Exception as exc:
            log(f"FATAL: ghost item creation failed: {exc}")
            close_db()
            return

    # ---- prepare BOM payloads ----------------------------------------------
    formula_by_id: dict[str, list[dict]] = defaultdict(list)
    for r in formula_b:
        if (r.get("IsDeleted") or "").strip().lower() == "true":
            continue
        formula_by_id[r["FormulaID"].strip()].append(r)

    filling_by_id: dict[str, list[dict]] = defaultdict(list)
    for r in filling_b:
        if (r.get("IsDeleted") or "").strip().lower() == "true":
            continue
        filling_by_id[r["FormulaID"].strip()].append(r)

    def build_bom(hdr_rows, body_by_id, label) -> list[dict]:
        out = []
        for h in hdr_rows:
            fid = h["FormulaID"].strip()
            out_id = item_id_for(h["ProductID"].strip())
            qty = float(h.get("Qty") or 1)
            if out_id is None:
                log(f"  SKIP {label} {fid}: no output item")
                continue
            comps = []
            ok = True
            for c in body_by_id.get(fid, []):
                cid = item_id_for(c["ProductID"].strip())
                if cid is None:
                    log(f"  SKIP {label} {fid}: component {c['ProductID']} has no item")
                    ok = False
                    break
                comps.append({"component_item_id": cid,
                              "quantity_required": float(c.get("Qty") or 0)})
            if not ok or not comps:
                if ok:
                    log(f"  SKIP {label} {fid}: no valid components")
                continue
            out.append({"key": fid, "kind": label, "finished_item_id": out_id,
                        "output_quantity": qty, "components": comps})
        return out

    new_formula_boms = build_bom(formula_h, formula_by_id, "Formula")
    new_filling_boms = build_bom(filling_h, filling_by_id, "Filling")
    log(f"Formula BOMs to import: {len(new_formula_boms)}")
    log(f"Filling BOMs to import: {len(new_filling_boms)}")

    # ---- filter out already-imported BOMs ----------------------------------
    already_boms = set()
    for r in db.fetch_all("SELECT notes FROM bill_of_materials WHERE notes IS NOT NULL"):
        n = r["notes"] or ""
        if "FormulaId=" in n:
            already_boms.add("F:" + n.split("FormulaId=")[1].split(" ")[0])
        if "FillingId=" in n:
            already_boms.add("G:" + n.split("FillingId=")[1].split(" ")[0])

    to_create_boms = [
        b for b in (new_formula_boms + new_filling_boms)
        if (("F:" if b["kind"] == "Formula" else "G:") + b["key"]) not in already_boms
    ]
    log(f"BOMs to create (final): {len(to_create_boms)}")

    # ---- create BOMs --------------------------------------------------------
    bom_id_by_key: dict[str, int] = {}
    # load already-imported bom ids for linking
    for r in db.fetch_all("SELECT id, notes FROM bill_of_materials WHERE notes IS NOT NULL"):
        n = r["notes"] or ""
        if "FormulaId=" in n:
            bom_id_by_key["F:" + n.split("FormulaId=")[1].split(" ")[0]] = r["id"]
        if "FillingId=" in n:
            bom_id_by_key["G:" + n.split("FillingId=")[1].split(" ")[0]] = r["id"]

    if to_create_boms:
        try:
            with db.transaction():
                codes = journal_repo.next_voucher_numbers(1, "BOM", len(to_create_boms))
                now = datetime.now().isoformat()
                bom_rows = []
                for i, b in enumerate(to_create_boms):
                    src_kind = b["kind"].lower()
                    bom_rows.append(
                        (1, b["finished_item_id"], codes[i], b["output_quantity"],
                         f"Imported from PharmaPro {src_kind}Id={b['key']}", now)
                    )
                db.executemany(
                    """INSERT INTO bill_of_materials (
                        company_id, finished_item_id, bom_name, output_quantity,
                        notes, is_active, created_at, is_temp, is_ghost
                    ) VALUES (?, ?, ?, ?, ?, 1, ?, 0, 1)""",
                    bom_rows,
                )
                last_bom_id = db.last_insert_id()
                first_bom_id = last_bom_id - len(bom_rows) + 1
                comp_rows = []
                for i, b in enumerate(to_create_boms):
                    bom_id = first_bom_id + i
                    bom_id_by_key[("F:" if b["kind"] == "Formula" else "G:") + b["key"]] = bom_id
                    for c in b["components"]:
                        comp_rows.append(
                            (bom_id, c["component_item_id"], c["quantity_required"])
                        )
                db.executemany(
                    """INSERT INTO bom_components (
                        bom_id, component_item_id, quantity_required, wastage_percent
                    ) VALUES (?, ?, ?, 0.0)""",
                    comp_rows,
                )
            log(f"Created {len(to_create_boms)} BOMs ({len(comp_rows)} components)")
        except Exception as exc:
            log(f"FATAL: BOM creation failed: {exc}")
            close_db()
            return

    # ---- build production order payloads -----------------------------------
    prod_body_by_id: dict[str, list[dict]] = defaultdict(list)
    for r in production_body:
        if (r.get("IsDeleted") or "").strip().lower() == "true":
            continue
        prod_body_by_id[r["ProductionID"].strip()].append(r)

    pack_body_by_id: dict[str, list[dict]] = defaultdict(list)
    for r in packing_body:
        if (r.get("IsDeleted") or "").strip().lower() == "true":
            continue
        pack_body_by_id[r["PackingID"].strip()].append(r)

    # output product -> formula/filling formula id
    formula_fid_by_prod = {h["ProductID"].strip(): h["FormulaID"].strip() for h in formula_h}
    filling_fid_by_prod = {h["ProductID"].strip(): h["FormulaID"].strip() for h in filling_h}

    def build_orders(hdr_rows, body_by_id, id_col, date_col, fid_by_prod, bom_prefix,
                     existing_notes_pattern) -> list[dict]:
        existing = set(
            r["order_number"] for r in db.fetch_all(
                f"SELECT order_number FROM production_orders WHERE notes LIKE '%{existing_notes_pattern}%'"
            )
        )
        out = []
        for p in hdr_rows:
            pid_ = p[id_col].strip()
            if pid_ in existing:
                continue
            out_item = item_id_for(p["ProductID"].strip())
            if out_item is None:
                log(f"  SKIP {id_col} {pid_}: no output item")
                continue
            fid = fid_by_prod.get(p["ProductID"].strip())
            bom_id = bom_id_by_key.get(bom_prefix + fid) if fid else None
            out.append({
                "src": f"{id_col}={pid_}",
                "bom_id": bom_id,
                "planned": float(p.get("Quantity") or 0),
                "actual": float(p.get("Quantity") or 0),
                "batch": (p.get("BatchNo") or "").strip(),
                "mfg_date": to_iso_date(p.get(date_col)),
                "expiry": to_iso_date(p.get("ExpiryDate")),
                "cost": float(p.get("TTLValue") or 0),
                "remarks": (p.get("Remarks") or "").strip(),
                "consumption": body_by_id.get(pid_, []),
            })
        return out

    new_orders = build_orders(productions, prod_body_by_id, "ProductionID", "ProductionDate",
                              formula_fid_by_prod, "F:", "ProductionId=")
    new_pack_orders = build_orders(packing_h, pack_body_by_id, "PackingID", "PackingDate",
                                   filling_fid_by_prod, "G:", "PackingId=")
    log(f"Production orders to import: {len(new_orders)}")
    log(f"Packing orders to import: {len(new_pack_orders)}")

    all_orders = new_orders + new_pack_orders
    if not all_orders:
        log("Nothing to do.")
        close_db()
        return

    # ---- insert production orders + consumption + ghost batches ------------
    created_orders = 0
    ghost_batches = 0
    try:
        with db.transaction():
            codes = journal_repo.next_voucher_numbers(1, "PRODUCTION_ORDER", len(all_orders))
            now = datetime.now().isoformat()
            # 1) bulk-insert order headers
            order_rows = []
            for i, o in enumerate(all_orders):
                order_number = codes[i]
                mfg_date = o["mfg_date"] or now[:10]
                notes = f"Imported from PharmaPro {o['src']}"
                if o["remarks"]:
                    notes += f" | {o['remarks']}"
                order_rows.append(
                    (
                        1, order_number, o["bom_id"],
                        o["planned"], o["actual"],
                        o["batch"] or None, mfg_date, o["expiry"] or None,
                        o["cost"], notes, now, now, now,
                    )
                )
            db.executemany(
                """INSERT INTO production_orders (
                    company_id, order_number, bom_id,
                    planned_quantity, actual_quantity,
                    output_batch_number, manufacturing_date, expiry_date,
                    production_cost, notes,
                    warehouse_id, wastage_quantity, status, created_by,
                    created_at, updated_at, completed_at,
                    raw_material_cost, packing_material_cost, is_ghost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'COMPLETED', NULL, ?, ?, ?, 0, 0, 1)""",
                order_rows,
            )
            last_order_id = db.last_insert_id()
            first_order_id = last_order_id - len(order_rows) + 1

            # 2) bulk-insert ghost stock batches (FK for consumption.batch_id)
            batch_rows = []
            batch_map = []  # (order_index, consumption_index) -> batch id
            for i, o in enumerate(all_orders):
                order_id = first_order_id + i
                mfg_date = o["mfg_date"] or now[:10]
                for c in o["consumption"]:
                    cid = item_id_for(c["ProductID"].strip())
                    if cid is None:
                        continue
                    batch_rows.append(
                        (cid, f"GHOST-{order_id}-{o['src']}", mfg_date,
                         o["expiry"] or None, now[:10], now)
                    )
                    batch_map.append((i, cid, float(c.get("Quantity") or 0),
                                      float(c.get("Cost") or 0)))
            if batch_rows:
                db.executemany(
                    """INSERT INTO stock_batches (
                        item_id, warehouse_id, batch_number, manufacturing_date,
                        expiry_date, purchase_price, quantity_in_stock, received_date,
                        is_active, created_at, raw_unit_cost, packing_unit_cost
                    ) VALUES (?, 1, ?, ?, ?, 0, 0, ?, 0, ?, 0, 0)""",
                    batch_rows,
                )
                last_batch_id = db.last_insert_id()
                first_batch_id = last_batch_id - len(batch_rows) + 1
                ghost_batches = len(batch_rows)

                # 3) bulk-insert consumption rows
                cons_rows = []
                for idx, (i, cid, qty, cost) in enumerate(batch_map):
                    cons_rows.append(
                        (first_order_id + i, cid, first_batch_id + idx, qty, cost)
                    )
                db.executemany(
                    """INSERT INTO production_consumption (
                        production_order_id, component_item_id, batch_id,
                        quantity_consumed, unit_cost
                    ) VALUES (?, ?, ?, ?, ?)""",
                    cons_rows,
                )
            created_orders = len(order_rows)
        log(f"Created {created_orders} production orders ({ghost_batches} ghost batches)")
    except Exception as exc:
        log(f"FATAL: production order creation failed: {exc}")
        close_db()
        return

    print("\n===== SUMMARY =====", flush=True)
    print(f"Ghost items created:   {len(new_ghosts)}", flush=True)
    print(f"BOMs created:          {len(to_create_boms)} (formula + filling)", flush=True)
    print(f"Production orders:     {created_orders}", flush=True)
    print(f"Ghost batches:         {ghost_batches}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()