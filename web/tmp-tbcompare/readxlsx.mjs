import { readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'

function parse(sheetXml, shared) {
  const rows = []
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let m
  while ((m = rowRe.exec(sheetXml))) {
    const r = Number(m[1]); const body = m[2]
    const cells = {}
    const cRe = /<c r="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g
    let c
    while ((c = cRe.exec(body))) {
      const col = c[1]; const attrs = c[3] || ''; const inner = c[4] || ''
      const t = /t="([^"]+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      const isv = /<is>([\s\S]*?)<\/is>/.exec(inner)?.[1]
      let val = null
      if (t === 's' && v != null) val = shared[Number(v)]
      else if (t === 'inlineStr' && isv) val = isv.replace(/<[^>]+>/g, '')
      else if (t === 'str' && v != null) val = v
      else if (v != null) val = Number(v)
      if (val !== null && val !== '') cells[col] = val
    }
    rows.push({ r, cells })
  }
  return rows
}

const [, , file, out] = process.argv
const zip = unzipSync(new Uint8Array(readFileSync(file)))
const shared = []
if (zip['xl/sharedStrings.xml']) {
  const s = strFromU8(zip['xl/sharedStrings.xml'])
  for (const mm of s.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push([...mm[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"))
  }
}
const rows = parse(strFromU8(zip['xl/worksheets/sheet1.xml']), shared)
writeFileSync(out, JSON.stringify(rows, null, 1))
for (const row of rows) {
  const arr = Object.entries(row.cells).sort(([a],[b]) => a.localeCompare(b))
  console.log(row.r, arr.map(([k,v]) => `${k}=${typeof v === 'number' ? v : JSON.stringify(v)}`).join(' | '))
}
