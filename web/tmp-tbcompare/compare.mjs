import { readFileSync, writeFileSync } from 'node:fs'
const ours = JSON.parse(readFileSync('tmp-tbcompare/ours.json','utf8'))
const theirRows = JSON.parse(readFileSync('tmp-tbcompare/theirs.json','utf8'))

// theirs: header at row 5; data rows have A=code, C=type
const theirs = []
let section = null
for (const row of theirRows) {
  const c = row.cells
  if (row.r <= 5) continue
  if (c.A && !c.C && !c.D && typeof c.A === 'string' && /\(/.test(c.A)) { section = c.A; continue }
  if (c.A && /^\d+$/.test(String(c.A))) {
    theirs.push({ r: row.r, code: String(c.A), name: c.B, type: c.C, od: c.D ?? 0, oc: c.E ?? 0, pd: c.F ?? 0, pc: c.G ?? 0, cd: c.H ?? 0, cc: c.I ?? 0, section })
  }
}
console.log('their accounts', theirs.length, 'our accounts', ours.sections.reduce((n,s)=>n+s.rows.length,0))
const ourMap = new Map()
for (const s of ours.sections) for (const r of s.rows) ourMap.set(r.accountCode, r)
const theirMap = new Map(theirs.map(t => [t.code, t]))
const onlyOurs = [...ourMap.keys()].filter(k => !theirMap.has(k))
const onlyTheirs = [...theirMap.keys()].filter(k => !ourMap.has(k))
console.log('only ours', onlyOurs.length, onlyOurs.slice(0,20))
console.log('only theirs', onlyTheirs.length, onlyTheirs.slice(0,20))
writeFileSync('tmp-tbcompare/parsed.json', JSON.stringify({ theirs }, null, 1))
