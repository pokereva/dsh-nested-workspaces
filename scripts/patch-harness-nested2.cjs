/* The menu marks the keyboard-active row with an extra class, so an exact
 * className match misses row 0 (which is the add-child row). */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs')
let source = fs.readFileSync(FILE, 'utf8')

const before = [
  'const addChildItem = nestedPass.nodes.filter(',
  "  (entry) => entry.kind === 'element' && entry.props.className === 'dnw-menuItem',",
  ')[0];',
].join('\n')

const after = [
  'const addChildItem = nestedPass.nodes.filter(',
  "  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /(^|\\s)dnw-menuItem(\\s|$)/.test(entry.props.className),",
  ')[0];',
].join('\n')

if (!source.includes(before)) throw new Error('pattern not found')
source = source.replace(before, after)
fs.writeFileSync(FILE, source)
console.log('relaxed the menu-row selector')
