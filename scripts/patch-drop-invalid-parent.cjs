/* The `nested-workspaces/invalid-parent` code was only ever produced by the
 * Host mkdir route. That route is gone, so the branch and its three locale
 * strings are dead. */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(FILE, 'utf8')
const before = source.length

const branch = "            if (code === 'nested-workspaces/invalid-parent') return t('errors.invalidParent')\n"
if (!source.includes(branch)) throw new Error('branch not found')
source = source.replace(branch, '')

const keyRe = /^ {8}'errors\.invalidParent': .*\n/mg
const hits = source.match(keyRe)
if (hits === null || hits.length !== 3) throw new Error('expected 3 locale keys, saw ' + (hits === null ? 0 : hits.length))
source = source.replace(keyRe, '')

fs.writeFileSync(FILE, source)
console.log('dropped invalidParent:', before - source.length, 'bytes')
