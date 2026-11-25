/* Deleting a real workspace leaves its child groups pointing at a parent id
 * that no longer exists — they would silently disappear from the tree and
 * never come back. Prune them (and their subtree) in the same step. */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(FILE, 'utf8')

const needle = [
  '              await workspaces.delete(workspace.workspaceId)',
  "              notify(t('deleted'), true)",
  '              onClose()',
].join('\n')

if (!source.includes(needle)) throw new Error('real delete branch not found')

const replacement = [
  '              await workspaces.delete(workspace.workspaceId)',
  '              /* Its child groups can no longer be reached through the tree, so',
  '               * drop the records instead of leaving them orphaned in storage. */',
  '              const orphans = new Set([workspace.workspaceId])',
  '              let spread = true',
  '              while (spread) {',
  '                spread = false',
  '                for (const entry of store.get().children) {',
  '                  if (orphans.has(entry.parentId) && !orphans.has(entry.id)) {',
  '                    orphans.add(entry.id)',
  '                    spread = true',
  '                  }',
  '                }',
  '              }',
  '              if (orphans.size > 1) {',
  '                store.update(current => {',
  '                  const assign = { ...current.assign }',
  '                  for (const [sessionId, groupKey] of Object.entries(assign)) {',
  '                    if (orphans.has(groupKey)) delete assign[sessionId]',
  '                  }',
  '                  return {',
  '                    ...current,',
  '                    children: current.children.filter(entry => !orphans.has(entry.id)),',
  '                    assign,',
  '                  }',
  '                })',
  '              }',
  "              notify(t('deleted'), true)",
  '              onClose()',
].join('\n')

source = source.replace(needle, replacement)
fs.writeFileSync(FILE, source)
console.log('prune added')
