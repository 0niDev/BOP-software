import { readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
const buf = readFileSync(process.argv[2])
const zip = unzipSync(new Uint8Array(buf))
console.log(Object.keys(zip))
const wb = strFromU8(zip['xl/workbook.xml'])
console.log(wb.slice(0,3000))
console.log('---sheet1---')
console.log(strFromU8(zip['xl/worksheets/sheet1.xml']).slice(0,3000))
console.log('---shared---')
if (zip['xl/sharedStrings.xml']) console.log(strFromU8(zip['xl/sharedStrings.xml']).slice(0,3000))
