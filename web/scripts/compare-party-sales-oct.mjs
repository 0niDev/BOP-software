#!/usr/bin/env node
/**
 * October comparative party-product sales report.
 *
 * Compares the OCT column of the old software's "Monthly Sale Chart
 * (Customer Wise)" PDF against our "Party Product Sales" xlsx export and
 * writes a highlighted workbook: wrong values, extra products (ours only)
 * and missing products (other software only).
 *
 * Usage: node scripts/compare-party-sales-oct.mjs [pdf] [ourXlsx] [outXlsx]
 *
 * Requires `pdftotext` (poppler-utils) for the PDF.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import writeXlsxFile from 'write-excel-file/node'

const PDF_PATH = process.argv[2] || 'comparative monthly sale chart from 01-may-2026 to 31-oct-2026.pdf'
const OUR_XLSX = process.argv[3] || 'party-product-sales our software.xlsx'
const OUT_XLSX = process.argv[4] || 'comparative-oct-2026.xlsx'
const MONTHS = ['JAN', 'FEB', 'MAR', 'Apr', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const OCT = 9

// ---------------------------------------------------------------------------
// PDF -> { party: { 'pid|name': octValue } }
// ---------------------------------------------------------------------------

function pdfPageText() {
  const out = join(mkdtempSync(join(tmpdir(), 'cmpsales-')), 'chart.txt')
  const r = spawnSync('pdftotext', ['-layout', PDF_PATH, out], { encoding: 'utf8' })
  if (r.error) throw new Error(`pdftotext not found (install poppler-utils): ${r.error.message}`)
  if (r.status !== 0) throw new Error(`pdftotext failed: ${r.stderr}`)
  return readFileSync(out, 'utf8')
}

const NUM_RE = /(?<![\d.,])-?\d[\d,]*(?:\.\d+)?/g
const nums = (s) => [...s.matchAll(NUM_RE)].map((m) => Number(m[0].replace(/,/g, '')))

export function readPdf(text) {
  const parties = {} // name -> { products: Map, sum: number, printed: number|null }
  const pages = text.split('\f')
  let cur = null
  let qtyKey = null

  for (const page of pages) {
    if (!page.trim()) continue
    const hdr = page.split('\n').find((l) => /JAN\s+FEB\s+MAR/.test(l))
    if (!hdr) throw new Error('page without month header; PDF layout changed')
    // month column centres and the boundaries between them
    const centres = MONTHS.map((m, i, a) => {
      const at = hdr.indexOf(m, i ? hdr.indexOf(a[i - 1]) + 3 : 0)
      if (at < 0) throw new Error(`month ${m} missing from header`)
      return at + m.length / 2
    })
    const totalCentre = hdr.indexOf('Total Sale') + 5
    const bounds = centres.slice(1).concat(totalCentre).map((c, i) => (c + centres[i]) / 2)
    const monthOf = (centre) => {
      for (let i = 0; i < bounds.length; i++) if (centre < bounds[i]) return i
      return 11
    }

    for (const line of page.split('\n')) {
      const who = line.match(/Customer Name : \((\d+)\) (.*)/)
      if (who) {
        cur = `${who[1]}|${who[2].trim()}`
        parties[cur] ||= { products: new Map(), sum: 0, printed: null }
        continue
      }
      if (!cur) continue

      if (line.includes('Total Sale Value Of')) {
        const off = line.indexOf(':') + 1
        const tally = [...line.slice(off).matchAll(NUM_RE)]
        for (const m of tally) {
          if (monthOf(off + m.index + m[0].length / 2) === OCT) {
            parties[cur].printed = (parties[cur].printed || 0) + Number(m[0].replace(/,/g, ''))
          }
        }
        continue
      }

      const qty = line.match(/^\s*(\d{5})\s+(.*?\S)\s+Qty\b/)
      const isValue = /^\s*Value\b/.test(line)
      if (!qty && !isValue) continue
      if (isValue && !qtyKey) continue

      const off = qty ? qty.index + qty[0].length : line.indexOf('Value') + 5
      const key = qty ? `${qty[1]}|${qty[2].trim()}` : qtyKey
      if (qty) qtyKey = key
      if (qty) continue // quantities are not in our export; only the value line is used

      for (const m of line.slice(off).matchAll(NUM_RE)) {
        if (monthOf(off + m.index + m[0].length / 2) !== OCT) continue
        const v = Number(m[0].replace(/,/g, ''))
        parties[cur].products.set(key, (parties[cur].products.get(key) || 0) + v)
        parties[cur].sum += v
      }
    }
  }

  for (const p of Object.values(parties)) {
    if (p.printed !== null && Math.abs(p.printed - p.sum) > 0.5) {
      throw new Error(`PDF parse drift: printed OCT total ${p.printed} != product sum ${p.sum}`)
    }
  }
  return parties
}

// ---------------------------------------------------------------------------
// Our xlsx -> { party: { product: value } } + declared party totals
// ---------------------------------------------------------------------------

const xmlUnescape = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function readOurXlsx(file) {
  const zip = unzipSync(new Uint8Array(readFileSync(file)), {
    filter: (f) => f.name === 'xl/sharedStrings.xml' || f.name === 'xl/worksheets/sheet1.xml',
  })
  const strings = [...strFromU8(zip['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlUnescape(t[1])).join(''))
  const sheet = strFromU8(zip['xl/worksheets/sheet1.xml'])

  const parties = {}
  const totals = {}
  let cur = null
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cell = {}
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const v = c[3].match(/<v>([\s\S]*?)<\/v>/)
      if (!v) continue
      cell[c[1]] = /t="s"/.test(c[2]) ? strings[Number(v[1])] : Number(v[1])
    }
    if (cell.C === 'Party total') {
      cur = cell.A
      parties[cur] = {}
      totals[cur] = Number(cell.D)
    } else if (cur && cell.C && cell.D !== undefined) {
      parties[cur][cell.C] = Number(cell.D)
    }
  }
  return { parties, totals }
}

// ---------------------------------------------------------------------------
// Product name matching
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation/units noise so the two systems' names meet. */
export function canon(name) {
  return name
    .toLowerCase()
    .replace(/1000\s*ml/g, '1lit')
    .replace(/\b(\d+)\s*(?:litres?|liters?|litters?|ltrs?|lit|l)\b/g, '$1lit')
    .replace(/\b(\d+)\s*(?:kgs?)\b/g, '$1kg')
    .replace(/\b(\d+)\s*(?:gms?|grams?)\b/g, '$1g')
    .replace(/\b(oral|liquid|liqde|liqude|liqud|liquied|liquide|powder|solution|spray|bop|label|plus)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
}

// Names our software uses for the same product sold under another title.
const PRODUCT_ALIASES = {
  timpoex120ml: 'timpex120ml',
  phytofat25kg: 'phytofatgold25kg',
  heaaticoptfort25kg: 'hepaticoptimizerfort25kg',
  bopmicrogold25kg: 'microgoldbop25kg',
  minmax25kg: 'minmaxpremix25kg',
  redgold1kg: 'redgoldminreal1kg',
  nutraminfort25kg: 'nutraminforte25kg',
  bioesel2005lit: 'bioesel205lit',
  renoguardflush1kg: 'renogurdflush1kg',
  copper5lit: 'coppergold5lit',
  ph525lit: 'phcure25lit',
  vetorespi5lit: 'vetorespioilbase5lit',
  biomin25kg: 'biomin',
  broncokill5lit: 'bronokill5lit',
  eucament5lit: 'eucamenth1lit', // PDF packs this as 1 Lit
  immuneforte5lit: 'immuneforte1lit', // PDF packs this as 1 Lit
  promingold25kg: 'promingoldminerals20kg', // PDF packs this as 20 kg
}

const pdfName = (key) => key.split('|')[1]
const target = (name) => PRODUCT_ALIASES[canon(name)] || canon(name)

function levenshtein(a, b) {
  let prev = [...Array(b.length + 1).keys()]
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}
const similar = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length)

// Party codes differ between the two systems, so parties are matched by name.
const PARTY_ALIASES = {
  drkaleem: 'drkaleemullah',
  drwadood: 'drwadoodcohafizpoultry',
}
const partyKey = (name) => PARTY_ALIASES[canon(name)] || canon(name)

function matchParties(ours, pdf) {
  const byCanon = new Map(Object.keys(pdf).map((k) => [partyKey(k.split('|')[1]), k]))
  const map = new Map()
  for (const name of Object.keys(ours)) {
    const canonName = partyKey(name)
    if (byCanon.has(canonName)) { map.set(name, byCanon.get(canonName)); continue }    const best = [...byCanon].map(([c, k]) => [similar(c, canonName), k]).sort((a, b) => b[0] - a[0])[0]
    if (best && best[0] >= 0.85) map.set(name, best[1])
    else console.warn(`WARN party not in other software: ${name}`)
  }
  return map
}

/** Pack size token in the name, e.g. "5lit", "25kg", "100ml" (last one wins). */
function sizeOf(name) {
  const s = name.toLowerCase()
    .replace(/\b1000\s*ml\b/g, '1lit')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:litres?|liters?|litters?|ltrs?|lit|l)\b/g, '$1lit')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:kgs?)\b/g, '$1kg')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:gms?|grams?|g)\b/g, '$1g')
  const sizes = s.match(/\d+(?:\.\d+)?(?:lit|ml|kg|g)\b/g)
  return sizes ? sizes[sizes.length - 1] : null
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compare(ours, pdfParty, googleName) {
  const oursCanon = Object.entries(ours)
  const pdfCanon = [...pdfParty.products].map(([key, value]) => ({ key, name: pdfName(key), value }))

  const groups = new Map() // pdf key -> { oursValue, oursNames[], pdf }
  const used = new Set()

  for (const [name, value] of oursCanon) {
    const t = target(name)
    // exact / alias hit may share one PDF row with another of our rows (split entries)
    let hit = pdfCanon.find((p) => target(p.name) === t)
    if (!hit) {
      const pool = pdfCanon.filter((p) => !used.has(p.key))
      const best = pool.map((p) => [similar(target(p.name), t), p]).sort((a, b) => b[0] - a[0])[0]
      if (best && best[0] >= 0.8) hit = best[1]
    }
    if (hit) {
      used.add(hit.key)
      const g = groups.get(hit.key) || { pdf: hit, oursValue: 0, oursNames: [] }
      g.oursValue += value
      g.oursNames.push(name)
      groups.set(hit.key, g)
    } else {
      groups.set(`ours:${name}`, { pdf: null, oursValue: value, oursNames: [name] })
    }
  }
  // PDF rows left unmatched are products our software does not have
  for (const p of pdfCanon) {
    if (!used.has(p.key)) groups.set(`pdf:${p.key}`, { pdf: p, oursValue: null, oursNames: [] })
  }

  const rows = [...groups.values()]
    // ignore rows that are zero on both sides (product not sold in October at all)
    .filter((g) => Math.abs(g.oursValue || 0) > 0.5 || Math.abs(g.pdf?.value || 0) > 0.5)
    .map((g) => {
      const other = g.pdf?.value ?? null
      const mine = g.oursValue ?? null
      const diff = (mine || 0) - (other || 0)
      let status = 'Match'
      if (g.pdf && !g.oursNames.length) status = 'Missing'
      else if (!g.pdf) status = 'Extra'
      else if (Math.abs(diff) > 0.5) status = 'Wrong value'

      const notes = []
      const sameName = g.pdf && g.oursNames.length === 1 && canon(g.oursNames[0]) === canon(g.pdf.name)
      if (g.oursNames.length > 1) notes.push(`ours combines ${g.oursNames.length} entries`)
      if (g.pdf && g.oursNames.length === 1 && !sameName && sizeOf(g.oursNames[0]) && sizeOf(g.pdf.name) &&
        sizeOf(g.oursNames[0]) !== sizeOf(g.pdf.name)) {
        notes.push(`size: ours ${sizeOf(g.oursNames[0])} vs ${sizeOf(g.pdf.name)}`)
      }
      if (g.pdf && g.oursNames.length && !sameName) notes.push(`named "${g.pdf.name}"`)
      return {
        party: googleName,
        product: g.oursNames.join(' + ') || g.pdf.name,
        other,
        mine,
        diff,
        status,
        note: notes.filter(Boolean).join('; '),
      }
    })

  // A row whose difference exactly cancels another row's difference means the
  // other software merged or split the same sale under a different name.
  for (const r of rows) {
    if (!r.diff || r.note.includes('offsets')) continue
    const twin = rows.find((o) => o !== r && !o.note.includes('offsets') && Math.abs(o.diff + r.diff) < 0.5)
    if (!twin) continue
    r.note = [r.note, `offsets "${twin.product}"`].filter(Boolean).join('; ')
    twin.note = [twin.note, `offsets "${r.product}"`].filter(Boolean).join('; ')
  }
  return rows.sort((a, b) => a.product.localeCompare(b.product))
}

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

const STATUS_STYLE = {
  'Wrong value': { backgroundColor: '#FFC7CE', textColor: '#9C0006', fontWeight: 'bold' },
  Extra: { backgroundColor: '#FFD8A8', textColor: '#7A3E00' },
  Missing: { backgroundColor: '#FFF2CC', textColor: '#7F6000' },
  Match: {},
}
const STATUS_LABEL = {
  'Wrong value': 'Wrong value',
  Extra: 'Extra product (ours only)',
  Missing: 'Missing product (other only)',
  Match: 'Match',
}
const MONEY = '#,##0'

function buildSheet(blocks, summary) {
  const rows = [
    [{ value: 'BOP Nutraceuticals — Comparative Sales (October 2026)', fontWeight: 'bold', fontSize: 14 }],
    [{ value: 'Other software: monthly sale chart OCT column   |   Our software: party-product-sales export', fontSize: 10, textColor: '#555555' }],
    [{ value: `Generated ${new Date().toISOString().slice(0, 10)} — only products with October sales are compared`, fontSize: 10, textColor: '#555555' }],
    [],
    [{ value: 'Other software total', fontWeight: 'bold' }, { value: summary.other, type: Number, format: MONEY, indent: 1 }],
    [{ value: 'Our software total', fontWeight: 'bold' }, { value: summary.mine, type: Number, format: MONEY, indent: 1 }],
    [{ value: 'Difference (ours - other)', fontWeight: 'bold' }, { value: summary.diff || null, type: Number, format: MONEY, indent: 1, textColor: summary.diff ? '#9C0006' : '#006100' }],
    [{ value: 'Wrong values', fontWeight: 'bold' }, { value: summary.wrong }],
    [{ value: 'Extra products (ours only)', fontWeight: 'bold' }, { value: summary.extra }],
    [{ value: 'Missing products (other only)', fontWeight: 'bold' }, { value: summary.missing }],
    [{ value: 'Matching rows', fontWeight: 'bold' }, { value: summary.match }],
    [],
    [
      { value: 'Party', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF' },
      { value: 'Product', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF' },
      { value: 'Other software (OCT)', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF', align: 'right', wrap: true },
      { value: 'Our software (OCT)', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF', align: 'right', wrap: true },
      { value: 'Difference', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF', align: 'right' },
      { value: 'Status', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF' },
      { value: 'Note', fontWeight: 'bold', backgroundColor: '#404040', textColor: '#FFFFFF' },
    ],
  ]
  for (const block of blocks) {
    rows.push([
      { value: block.party, fontWeight: 'bold', backgroundColor: '#EDEDED' },
      { value: block.code ? `code in other software: ${block.code}` : '', backgroundColor: '#EDEDED', textColor: '#666666', fontSize: 9 },
      { backgroundColor: '#EDEDED' }, { backgroundColor: '#EDEDED' }, { backgroundColor: '#EDEDED' },
      { backgroundColor: '#EDEDED' }, { backgroundColor: '#EDEDED' },
    ])
    for (const r of block.rows) {
      const style = STATUS_STYLE[r.status]
      rows.push([
        { value: '' },
        { value: r.product, ...style, wrap: true },
        { value: r.other, type: Number, format: MONEY, align: 'right', indent: 1, ...style },
        { value: r.mine, type: Number, format: MONEY, align: 'right', indent: 1, ...style },
        { value: r.diff || null, type: Number, format: MONEY, align: 'right', indent: 1, ...style },
        { value: STATUS_LABEL[r.status], ...style },
        { value: r.note, ...style, fontSize: 9, wrap: true },
      ])
    }
    const diff = block.oursTotal - block.otherTotal
    rows.push([
      { value: block.party, fontWeight: 'bold', backgroundColor: '#DDEBF7' },
      { value: 'Party total', fontWeight: 'bold', backgroundColor: '#DDEBF7' },
      { value: block.otherTotal, type: Number, format: MONEY, align: 'right', indent: 1, fontWeight: 'bold', backgroundColor: '#DDEBF7' },
      { value: block.oursTotal, type: Number, format: MONEY, align: 'right', indent: 1, fontWeight: 'bold', backgroundColor: '#DDEBF7' },
      { value: diff || null, type: Number, format: MONEY, align: 'right', indent: 1, fontWeight: 'bold', backgroundColor: '#DDEBF7', textColor: diff ? '#9C0006' : '#006100' },
      { value: diff ? 'Party differs' : 'Party matches', fontWeight: 'bold', backgroundColor: '#DDEBF7', textColor: diff ? '#9C0006' : '#006100' },
      { value: '', backgroundColor: '#DDEBF7' },
    ])
    rows.push([])
  }
  return rows
}

// ---------------------------------------------------------------------------

function main() {
  const pdf = readPdf(pdfPageText())
  const { parties: ours, totals } = readOurXlsx(OUR_XLSX)
  const partyMap = matchParties(ours, pdf)

  const blocks = []
  let otherTotal = 0
  let oursTotal = 0
  const counts = { wrong: 0, extra: 0, missing: 0, match: 0 }

  for (const [party, pdfKey] of [...partyMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    const oursLines = Object.fromEntries(Object.entries(ours[party]).filter(([, v]) => v > 0.5))
    const sumOurs = Object.values(ours[party]).reduce((s, v) => s + v, 0)
    if (Math.abs(sumOurs - totals[party]) > 0.5) {
      throw new Error(`${party}: product rows ${sumOurs} != declared party total ${totals[party]}`)
    }
    const rows = compare(oursLines, pdf[pdfKey], party)
    const otherTotalParty = rows.reduce((s, r) => s + (r.other || 0), 0)
    const oursTotalParty = rows.reduce((s, r) => s + (r.mine || 0), 0)
    for (const r of rows) {
      if (r.status === 'Wrong value') counts.wrong++
      else if (r.status === 'Extra') counts.extra++
      else if (r.status === 'Missing') counts.missing++
      else counts.match++
    }
    otherTotal += otherTotalParty
    oursTotal += oursTotalParty
    blocks.push({
      party,
      code: pdfKey.split('|')[0],
      rows,
      otherTotal: otherTotalParty,
      oursTotal: oursTotalParty,
    })
  }

  const diff = oursTotal - otherTotal
  const rowDiff = blocks.flatMap((b) => b.rows).reduce((s, r) => s + r.diff, 0)
  if (Math.abs(diff - rowDiff) > 0.5) throw new Error(`totals drift: ${diff} != ${rowDiff}`)

  const sheet = buildSheet(blocks, {
    other: otherTotal, mine: oursTotal, diff, ...counts,
  })
  // write-excel-file is async; block until the file exists so a failed write
  // cannot be mistaken for success.
  return writeXlsxFile(sheet, {
    sheet: 'Comparative Oct 2026',
    orientation: 'landscape',
    columns: [{ width: 28 }, { width: 42 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 26 }, { width: 52 }],
    stickyRowsCount: 1,
  }).toFile(OUT_XLSX).then(() => {
    console.log(`\nWrote ${OUT_XLSX}`)
    console.log(`Other ${otherTotal.toLocaleString()} | Ours ${oursTotal.toLocaleString()} | Diff ${diff.toLocaleString()}`)
    console.log(`${counts.match} match, ${counts.wrong} wrong, ${counts.extra} extra, ${counts.missing} missing`)
    console.log('\nReview (rows our side cannot pair by name alone):')
    for (const b of blocks) {
      for (const r of b.rows) {
        if (r.status === 'Match') continue
        const other = r.other === null ? '—' : r.other.toLocaleString()
        const mine = r.mine === null ? '—' : r.mine.toLocaleString()
        console.log(`  ${b.party} | ${r.product} | other ${other} | ours ${mine} | ${r.status}${r.note ? ` | ${r.note}` : ''}`)
      }
    }
    console.log('\nParty differences:')
    for (const b of blocks) {
      const d = b.oursTotal - b.otherTotal
      if (d) console.log(`  ${b.party}: ${d > 0 ? '+' : ''}${d.toLocaleString()}`)
    }
  })
}

if (process.argv[1] && process.argv[1].endsWith('compare-party-sales-oct.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
