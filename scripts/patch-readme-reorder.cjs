'use strict'
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'README.md')
let source = fs.readFileSync(FILE, 'utf8')

const anchor = '| Add a child workspace | workspace `…` menu → 添加子工作区 |'
if (source.indexOf(anchor) === -1) {
  console.log('MISS anchor')
  process.exit(1)
}

if (source.indexOf('| Reorder workspaces |') === -1) {
  source = source.replace(
    anchor,
    anchor + '\n| Reorder workspaces | drag a workspace row above or below a sibling that shares its parent |',
  )
}

fs.writeFileSync(FILE, source)
console.log('README reorder row present')
