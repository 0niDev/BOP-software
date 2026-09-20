"""Independent verification of EXPORTS/Formulations.xlsx against PharmaPro_FullExport.

Recomputes every expected value from the raw CSVs using a separate code path
from the generator, then compares against the produced workbook cell by cell:
sheet structure, row counts, component sets, quantities, names, types, UoM,
block layout, number formats, autofilter ranges and the products index.

Also reports coverage gaps (products whose recipe is missing or empty in the
source export) so nothing is silently dropped.

Run: python scripts/verify_formulations.py
Exit code is non-zero if any check fails.
"""
import csv
import os
import sys
from collections import defaultdict

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "PharmaPro_FullExport")
XLSX = os.path.join(ROOT, "EXPORTS", "Formulations.xlsx")

FAILURES = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + ("" if ok else f"   <-- {detail}"))
    if not ok:
        FAILURES.append(label)


def load(name):
    with open(os.path.join(BASE, name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ------------------------------------------------------------------ raw data
products = {r["ProductId"].zfill(5): r for r in load("Products.csv")}


def nm(pid):
    return (products.get(pid, {}).get("ProductName") or "").strip()


def co(pid):
    return (products.get(pid, {}).get("CompanyId") or "??").strip()


def pk(pid):
    return (products.get(pid, {}).get("Packing") or "").strip()


TYPE_OF = {
    "00": "Finished Good",
    "01": "Raw Material",
    "02": "Packing Material",
    "03": "Semi-Finished (Bulk)",
}


def exp_ptype(pid):
    if pid not in products:
        return "Not in Master"
    return TYPE_OF.get(co(pid), "Other")


# ---- independent expansion of formula / filling -----------------------------
f_head = load("FormulaHeader.csv")
f_body = load("FormulaBody.csv")
g_head = load("FillingHeader.csv")
g_body = load("FillingBody.csv")

# formula header id -> product, and the header quantity
fh_prod, fh_qty = {}, {}
for r in f_head:
    fid = r["FormulaID"].strip()
    fh_prod[fid] = r["ProductID"].zfill(5)
    fh_qty[fid] = float(r["Qty"] or 1) or 1.0
gh_prod, gh_qty = {}, {}
for r in g_head:
    fid = r["FormulaID"].strip()
    gh_prod[fid] = r["ProductID"].zfill(5)
    gh_qty[fid] = float(r["Qty"] or 1) or 1.0

# product -> {component: qty per 1 unit}
FORM = defaultdict(dict)
for r in f_body:
    fid = r["FormulaID"].strip()
    cid = r["ProductID"].zfill(5)
    qty = float(r["Qty"] or 0) / fh_qty[fid]
    FORM[fh_prod[fid]][cid] = FORM[fh_prod[fid]].get(cid, 0.0) + qty

FILL = defaultdict(dict)
for r in g_body:
    fid = r["FormulaID"].strip()
    cid = r["ProductID"].zfill(5)
    qty = float(r["Qty"] or 0) / gh_qty[fid]
    FILL[gh_prod[fid]][cid] = FILL[gh_prod[fid]].get(cid, 0.0) + qty

print(f"source: {len(f_head)} formula headers / {len(f_body)} lines; "
      f"{len(g_head)} filling headers / {len(g_body)} lines")
print(f"source: distinct products with a master formula: {len(FORM)}, "
      f"with a filling: {len(FILL)}")


# ---- expected recipes -------------------------------------------------------
def expect(pid):
    """Return (raw_lines, packing_lines) using an independent code path."""
    raw, pack = [], []
    if FILL.get(pid):
        for cid, q in FILL[pid].items():
            t = co(cid)
            if t == "03":
                if FORM.get(cid):
                    for rc, rq in FORM[cid].items():
                        raw.append((rc, round(q * rq, 12), cid))
                else:
                    # bulk with no usable formula: shown with its own quantity
                    raw.append((cid, round(q, 12), ""))
            else:
                pack.append((cid, round(q, 12)))
    elif FORM.get(pid):
        for cid, q in FORM[pid].items():
            if co(cid) == "02":
                pack.append((cid, round(q, 12)))
            else:
                raw.append((cid, round(q, 12), ""))
    return raw, pack


EXPECT = {}
for pid in set(FORM) | set(FILL):
    raw, pack = expect(pid)
    if raw or pack:
        EXPECT[pid] = (raw, pack)

exp_raw = sum(len(v[0]) for v in EXPECT.values())
exp_pack = sum(len(v[1]) for v in EXPECT.values())
print(f"expected: {len(EXPECT)} products, {exp_raw} raw lines, {exp_pack} packing lines")

# ---- load the produced workbook ---------------------------------------------
wb = load_workbook(XLSX)
check("workbook has the 3 expected sheets",
      wb.sheetnames == ["Formulations", "All Components", "Products Index"],
      str(wb.sheetnames))

# ================= All Components (flat full sheet) ==========================
ws = wb["All Components"]
flat = list(ws.iter_rows(min_row=2, values_only=True))
flat = [r for r in flat if r[0] is not None]

check("All Components row count == expected",
      len(flat) == exp_raw + exp_pack,
      f"got {len(flat)} want {exp_raw + exp_pack}")
check("All Components raw-section line count == expected",
      sum(1 for r in flat if r[9] in ("Raw Material", "Semi-Finished (Bulk)")) == exp_raw,
      f"got {sum(1 for r in flat if r[9] in ('Raw Material', 'Semi-Finished (Bulk)'))} want {exp_raw}")
check("All Components packing-section line count == expected",
      sum(1 for r in flat if r[9] == "Packing Material") == exp_pack,
      f"got {sum(1 for r in flat if r[9] == 'Packing Material')} want {exp_pack}")
check("All Components autofilter covers every row",
      ws.auto_filter.ref == f"A1:K{len(flat) + 1}", str(ws.auto_filter.ref))

# ---- build the EXPECTED flat table completely, then compare as a set --------
# key = (product, component, via, group, pname, ptype, packsize, cname, ctype, uom)
exp_table = {}
for pid, (raw, pack) in EXPECT.items():
    for cid, qty, via in raw:
        exp_table[(pid, cid, via, exp_ptype(cid), nm(pid), exp_ptype(pid),
                   pk(pid), nm(cid), exp_ptype(cid), pk(cid))] = qty
    for cid, qty in pack:
        exp_table[(pid, cid, "", exp_ptype(cid), nm(pid), exp_ptype(pid),
                   pk(pid), nm(cid), exp_ptype(cid), pk(cid))] = qty

got_table = {}
for r in flat:
    pid, pname, ptype, pack, cid, cname, ctype, qty, uom, group, via = r
    via_code = via.split(" ")[0] if via else ""
    key = (pid, cid, via_code, group, pname, ptype, pack or "", cname, ctype, uom or "")
    got_table[key] = qty

missing = sorted(set(exp_table) - set(got_table))
extra = sorted(set(got_table) - set(exp_table))
check("All Components rows == expected rows (every cell except Qty)",
      not missing and not extra,
      f"missing={missing[:2]} extra={extra[:2]}")
qty_bad = [k for k in exp_table if k in got_table
           and abs(got_table[k] - exp_table[k]) > 1e-12]
check(f"all {len(exp_table)} quantities match", not qty_bad, str(qty_bad[:3]))

# keep per-product buckets for the cross-sheet checks below
flat_raw, flat_pack = defaultdict(dict), defaultdict(dict)
for (pid, cid, via, group, *_rest), qty in got_table.items():
    if group == "Packing Material":
        flat_pack[pid][cid] = qty
    else:
        flat_raw[pid][(cid, via)] = qty

# ================= Formulations (grouped blocks) =============================
fs = wb["Formulations"]
merged = {str(m) for m in fs.merged_cells.ranges}
check("Formulations sheet is 6 columns wide", fs.max_column == 6, str(fs.max_column))
check("Formulations sheet freezes the header row", fs.freeze_panes == "A2", str(fs.freeze_panes))

title_re = None
import re
title_re = re.compile(r"^(\d{5})\s{3}\S")

order, title_rows = [], []
cur_prod, cur_section = None, None
block_raw, block_pack = defaultdict(list), defaultdict(list)
blocks = defaultdict(dict)
structure_errors = []

for idx, row in enumerate(fs.iter_rows(values_only=True), start=1):
    a, b, c, d, e, f = (list(row) + [None] * 6)[:6]
    if a is None:
        continue
    text = str(a)
    m = title_re.match(text)
    if m and f"A{idx}:F{idx}" in merged:
        cur_prod = m.group(1)
        order.append(cur_prod)
        title_rows.append((idx, cur_prod))
        cur_section = None
        continue
    if text in ("RAW MATERIALS", "PACKING MATERIALS"):
        if cur_prod is None:
            structure_errors.append(f"r{idx}: section before any product")
        cur_section = text
        continue
    if text == "Component ID":
        continue
    if re.fullmatch(r"\d{5}", text):
        if cur_prod is None or cur_section is None:
            structure_errors.append(f"r{idx}: component line outside a section")
            continue
        target = block_raw if cur_section == "RAW MATERIALS" else block_pack
        target[cur_prod].append((text, d, e, f))

check("Formulations sheet has no structural errors", not structure_errors,
      str(structure_errors[:4]))
# products with usable components must each have exactly one block
check("every product with a formulation has exactly one block",
      len(order) == len(set(order)) and set(EXPECT) <= set(order),
      f"blocks={len(order)} unique={len(set(order))} expected>={len(EXPECT)}")
check("no duplicated product block",
      len(order) == len(set(order)), "duplicate headings found")

# every product block must contain both section headings
heading_bad = []
for i, (ridx, pid) in enumerate(title_rows):
    end = title_rows[i + 1][0] if i + 1 < len(title_rows) else fs.max_row + 1
    sections = [fs.cell(row=k, column=1).value for k in range(ridx, end)]
    if "RAW MATERIALS" not in sections or "PACKING MATERIALS" not in sections:
        heading_bad.append(pid)
check("every block contains both RAW and PACKING sections",
      not heading_bad, str(heading_bad[:3]))

fs_bad = []
for pid, (raw, pack) in EXPECT.items():
    e_raw = {(c, v): q for c, q, v in raw}
    e_pack = {c: q for c, q in pack}
    g_raw = {(r[0], r[3].split(" ")[1] if r[3] and r[3].startswith("bulk ") else ""): r[1]
             for r in block_raw.get(pid, [])}
    g_pack = {r[0]: r[1] for r in block_pack.get(pid, [])}
    if g_raw != e_raw:
        fs_bad.append((pid, "raw", sorted(set(e_raw) ^ set(g_raw))[:3]))
    if g_pack != e_pack:
        fs_bad.append((pid, "pack", sorted(set(e_pack) ^ set(g_pack))[:3]))
check(f"Formulations blocks match the flat sheet for all {len(EXPECT)} products",
      not fs_bad, str(fs_bad[:4]))

# every finished good in the master must now appear as a block
fg_master = {p for p in products if co(p) == "00"}
check("every finished good appears in the Formulations sheet",
      fg_master <= set(order),
      f"missing {sorted(fg_master - set(order))[:5]}")

# products with no components must be flagged with the '(none defined)' marker
unresolved = [p for p in set(order) if not block_raw.get(p) and not block_pack.get(p)]
# one marker for each empty RAW section plus one for each empty PACKING section
expected_markers = (sum(1 for p in set(order) if not block_raw.get(p))
                    + sum(1 for p in set(order) if not block_pack.get(p)))
none_markers = sum(1 for prow in range(1, fs.max_row + 1)
                   if fs.cell(row=prow, column=1).value == "(none defined)")
check(f"{len(unresolved)} fully unresolved blocks + empty sections are all marked",
      none_markers == expected_markers,
      f"markers={none_markers} expected={expected_markers}")

# Qty cell number format applied on every component line
bad_fmt = []
for row in fs.iter_rows(min_row=1, max_col=4):
    a, d = row[0].value, row[3]
    if isinstance(a, str) and re.fullmatch(r"\d{5}", a) and a != "00000":
        if d.value is not None and d.number_format != "0.##########":
            bad_fmt.append((a, d.number_format))
check("Qty cells carry the decimal number format", not bad_fmt, str(bad_fmt[:3]))

# every product block shows a heading + info line + both sections
info_ok = True
for prow in range(1, fs.max_row + 1):
    v = fs.cell(row=prow, column=1).value
    if isinstance(v, str) and title_re.match(v):
        nxt = fs.cell(row=prow + 1, column=1).value or ""
        if not str(nxt).startswith("Type: "):
            info_ok = False
            break
check("every product block is followed by its info line", info_ok)

# ================= Products Index ===========================================
idx = wb["Products Index"]
irows = [r for r in idx.iter_rows(min_row=2, values_only=True) if r[0] is not None]
idx_ids = {r[0] for r in irows}
# products referenced by a formula header but absent from Products.csv
orphans = {fh_prod[f] for f in fh_prod} | {gh_prod[f] for f in gh_prod}
orphans -= set(products)
check("Products Index covers the master plus every formula-only product",
      idx_ids == set(products) | orphans,
      f"rows={len(irows)} master={len(products)} orphans={len(orphans)}")
check("Products Index autofilter covers every row",
      idx.auto_filter.ref == f"A1:J{len(irows) + 1}", str(idx.auto_filter.ref))
check("every product block in the Formulations sheet also has an Index row",
      set(order) <= idx_ids,
      f"missing {sorted(set(order) - idx_ids)[:5]}")

idx_map = {r[0]: r for r in irows}
idx_bad = []
for pid in products:
    want_r = len(flat_raw.get(pid, {}))
    want_p = len(flat_pack.get(pid, {}))
    got = idx_map[pid]
    if got[4] != want_r or got[5] != want_p or got[6] != want_r + want_p:
        idx_bad.append((pid, got[4], got[5], want_r, want_p))
    expect_yes = pid in EXPECT
    if (got[7] == "Yes") != expect_yes:
        idx_bad.append((pid, "flag", got[7], expect_yes))
    if got[8] != co(pid):
        idx_bad.append((pid, "company", got[8], co(pid)))
check("Products Index counts/flags/company all agree with the flat sheet",
      not idx_bad, str(idx_bad[:4]))
check("orphan products are labelled in the Index",
      all(idx_map[p][8] == "-" and "Products.csv" in (idx_map[p][9] or "")
          for p in orphans),
      str([(p, idx_map[p][8], idx_map[p][9]) for p in list(orphans)[:3]]))

# ================= gap analysis =============================================
empty_fill_heads = {gh_prod[r["FormulaID"].strip()] for r in g_head}
have_body = {gh_prod[r["FormulaID"].strip()] for r in g_body}
empty_only = sorted(empty_fill_heads - have_body)
fgs = sorted(p for p in products if co(p) == "00")
print()
print(f"GAP  finished goods in master ................ {len(fgs)}")
print(f"GAP  ... represented in the workbook ........ {len([p for p in fgs if p in EXPECT])}")
print(f"GAP  ... with a filling header but EMPTY body {len([p for p in empty_only if co(p) == '00'])}")
print(f"GAP  ... with no filling header at all ...... "
      f"{len([p for p in fgs if p not in empty_fill_heads])}")

still_missing = sorted(p for p in fgs if p not in EXPECT)
print(f"\nGAP  finished goods with NO resolvable components: {len(still_missing)}")
print(f"     (all {len(fgs) - len(still_missing)} of the others have a full formulation;")
print(f"      the {len(still_missing)} below still get a labelled block in the sheet)")
for p in still_missing[:12]:
    inidx = idx_map[p]
    print(f"       {p} {nm(p)[:38]:<38} notes={inidx[9]!r}")

# duplicate non-empty formula headers (would collide)
fh_body_count = defaultdict(int)
for r in f_body:
    fh_body_count[r["FormulaID"].strip()] += 1
per_prod_headers = defaultdict(list)
for fid, pid in fh_prod.items():
    per_prod_headers[pid].append((fid, fh_body_count[fid]))
collide = {p: v for p, v in per_prod_headers.items() if sum(1 for _, n in v if n) > 1}
check("no product has two competing non-empty master formulas", not collide, str(collide))
gh_body_count = defaultdict(int)
for r in g_body:
    gh_body_count[r["FormulaID"].strip()] += 1
per_prod_g = defaultdict(list)
for fid, pid in gh_prod.items():
    per_prod_g[pid].append((fid, gh_body_count[fid]))
collide_g = {p: v for p, v in per_prod_g.items() if sum(1 for _, n in v if n) > 1}
check("no product has two competing non-empty filling formulas", not collide_g, str(collide_g))

# every component referenced by the workbook exists in the master
unknown = {c for v in flat_raw.values() for c, _ in v} | {c for v in flat_pack.values() for c in v}
unknown -= set(products)
print(f"\nINFO unresolved component ids (shown as '(unknown ...)'): {len(unknown)}")
print(f"INFO products excluded because their formula body is empty: {len(empty_only)}")

print()
print("=" * 60)
if FAILURES:
    print(f"RESULT: {len(FAILURES)} failure(s)")
    for f in FAILURES:
        print("  -", f)
    sys.exit(1)
print("RESULT: ALL CHECKS PASSED")