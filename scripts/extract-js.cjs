'use strict'
const fs = require('fs')
const path = require('path')

const file = process.argv[2]
const needle = process.argv[3]
const before = Number(process.argv[4] || 600)
const after = Number(process.argv[5] || 600)

const source = fs.readFileSync(file, 'utf8')
const at = source.indexOf(needle)
if (at === -1) {
  console.log('MISS')
  process.exit(1)
}
console.log(source.slice(Math.max(0, at - before), at + after))
