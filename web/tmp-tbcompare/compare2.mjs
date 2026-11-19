import { readFileSync, writeFileSync } from 'node:fs'
const ours = JSON.parse(readFileSync('tmp-tbcompare/ours.json','utf8'))
const there = JSON.parse(readFileSync('tmp-tbcompare/parsed.json','utf8')).theirs
const ourRows = ours.sections.flatMap(s => s.rows.map(r => ({...r, section: s.label})))
const ourMap = new Map(ourRows.map(r => [r.displayCode, r]))
const theirMap = new Map(there.map(r => [r.code, r]))
const onlyOurs = [...ourMap.keys()].filter(k => !theirMap.has(k))
const onlyTheirs = [...theirMap.keys()].filter(k => !ourMap.has(k))
console.log('only ours', onlyOurs.length, onlyOurs)
console.log('only theirs', onlyTheirs.length, onlyTheirs)
const diffs = []
for (const [code, t] of theirMap) {
  const o = ourMap.get(code)
  if (!o) continue
  const fields = ['od','oc','pd','pc','cd','cc']
  const of = { od: o.openingDebit, oc: o.openingCredit, pd: o.debit, pc: o.credit, cd: o.closingDebit, cc: o.closingCredit }
  const d = {}
  let any = false
  for (const f of fields) { const v = Math.round((of[f] - t[f]) * 100) / 100; d[f] = v; if (Math.abs(v) > 0.005) any = true }
  if (any) diffs.push({ code, name: o.accountName, theirName: t.name, ...d, theirs: t, ours: of })
}
console.log('diff rows', diffs.length)
for (const d of diffs.slice(0, 60)) console.log(d.code, d.name, '|', d.theirName, '| od', d.od, 'oc', d.oc, 'pd', d.pd, 'pc', d.pc, 'cd', d.cd, 'cc', d.cc, '| theirs', d.theirs.od, d.theirs.oc, d.theirs.pd, d.theirs.pc, d.theirs.cd, d.theirs.cc, '| ours', d.ours.od, d.ours.oc, d.ours.pd, d.ours.pc, d.ours.cd, d.ours.cc)
writeFileSync('tmp-tbcompare/diffs.json', JSON.stringify(diffs, null, 1))
