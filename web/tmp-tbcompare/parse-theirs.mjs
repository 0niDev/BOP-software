import { readFileSync, writeFileSync } from 'node:fs'
const rows = JSON.parse(readFileSync('tmp-tbcompare/theirs.json', 'utf8'))
const TYPES = new Set(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'])
const theirs = []
let section = null
for (const row of rows) {
  const c = row.cells
  if (row.r <= 5) continue
  if (!c.C && typeof c.A === 'string' && /\(\d+\)\s*$/.test(c.A)) { section = c.A; continue }
  const code = c.A == null ? null : String(c.A)
  if (code && /^[0-9][0-9a-z]*$/i.test(code) && c.C && TYPES.has(c.C)) {
    theirs.push({ r: row.r, code, name: c.B, type: c.C, od: c.D ?? 0, oc: c.E ?? 0, pd: c.F ?? 0, pc: c.G ?? 0, cd: c.H ?? 0, cc: c.I ?? 0, section })
  }
}
const sum = (f) => Math.round(theirs.reduce((s, r) => s + r[f], 0) * 100) / 100
console.log('rows', theirs.length, 'od', sum('od'), 'oc', sum('oc'), 'pd', sum('pd'), 'pc', sum('pc'), 'cd', sum('cd'), 'cc', sum('cc'))
writeFileSync('tmp-tbcompare/theirs-parsed.json', JSON.stringify(theirs, null, 1))

const ours = JSON.parse(readFileSync('tmp-tbcompare/ours.json', 'utf8'))
const ourRows = ours.sections.flatMap(s => s.rows.map(r => ({ ...r, section: s.label })))
const norm = (s) => String(s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
const theirByName = new Map()
for (const t of theirs) {
  const k = norm(t.name)
  if (!theirByName.has(k)) theirByName.set(k, [])
  theirByName.get(k).push(t)
}
let matched = 0, unmatchedOurs = []
for (const o of ourRows) {
  const hits = theirByName.get(norm(o.accountName)) ?? []
  if (hits.length) matched++
  else unmatchedOurs.push(`${o.displayCode} ${o.accountName}`)
}
console.log('name-matched ours', matched, 'of', ourRows.length)
console.log('unmatched ours:', unmatchedOurs.join(' | '))
const dupes = [...theirByName.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}x${v.length}`)
console.log('duplicate names theirs:', dupes.join(', '))
