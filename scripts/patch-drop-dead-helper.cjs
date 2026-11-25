/* childrenOfParent was written for the record walk but the view memo builds
 * childrenOf directly; the helper never had a caller. */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(FILE, 'utf8')
const before = source.length

const needle = [
  '    /** The child records that sit directly under one group, in stored order. */',
  '    function childrenOfParent(children, parentId) {',
  '      return children.filter(entry => entry.parentId === parentId)',
  '    }',
  '',
  '',
].join('\n')

if (!source.includes(needle)) throw new Error('helper not found')
source = source.replace(needle, '')
fs.writeFileSync(FILE, source)
console.log('dropped childrenOfParent:', before - source.length, 'bytes')
