'use strict'
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'README.md')
let source = fs.readFileSync(FILE, 'utf8')

const anchor = `- **Last-used time.**`
if (source.indexOf(anchor) === -1) {
  console.log('MISS anchor')
  process.exit(1)
}

const bullet = `- **Reorder workspaces.** Drag a workspace row above or below another row that
  shares its parent: a child moves among its siblings, a root moves among the
  roots, and a drag that would cross the parent boundary is refused so a child
  can never be hoisted out of the workspace it belongs to. A newly created child
  is anchored above its existing siblings instead of below them.
`

if (source.indexOf('**Reorder workspaces.**') === -1) {
  source = source.replace(anchor, bullet + anchor)
}

fs.writeFileSync(FILE, source)
console.log('README reorder bullet present')
