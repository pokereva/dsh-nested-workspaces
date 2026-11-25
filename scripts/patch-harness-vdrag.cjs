/* Dragging one child group above another must rewrite the stored record order
 * and must not touch the Host (a group has no Host order to write). */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs')
let source = fs.readFileSync(FILE, 'utf8')
const marker = "check(\n  'a newly added child renders above the older siblings',\n  newerAt !== -1 && olderAt !== -1 && newerAt < olderAt,\n  JSON.stringify(orderLabels),\n);\n"
if (!source.includes(marker)) throw new Error('marker not found')

const extra = `
workspacesCall.length = 0;
let vdragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const virtualRow = (pass, title) =>
  rowsOf(pass).filter((row) => String(row.props['aria-label'] || '').indexOf(title + ' \\u2014') === 0)[0];
const dragSource = virtualRow(vdragPass, 'newkid');
check('a child group row can start a workspace drag', dragSource !== undefined);
if (dragSource !== undefined) dragSource.props.onDragStart(dragEvent({ closest: () => null }, 0));
vdragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const dragTarget = virtualRow(vdragPass, 'newerkid');
if (dragTarget !== undefined) dragTarget.props.onDragOver(Object.assign(dragEvent({ closest: () => null }, 4), { currentTarget: { getBoundingClientRect: fakeRect } }));
vdragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const sourceAgain = virtualRow(vdragPass, 'newkid');
if (sourceAgain !== undefined) sourceAgain.props.onDragEnd();
vdragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const afterDragLabels = rowsOf(vdragPass).map((row) => String(row.props['aria-label'] || ''));
const newkidAt = afterDragLabels.findIndex((label) => label.indexOf('newkid \\u2014') === 0);
const newerkidAt = afterDragLabels.findIndex((label) => label.indexOf('newerkid \\u2014') === 0);
check(
  'dragging a child group above its sibling reorders the records',
  newkidAt !== -1 && newerkidAt !== -1 && newkidAt < newerkidAt,
  JSON.stringify(afterDragLabels),
);
check('reordering child groups never calls the Host', workspacesCall.length === 0, JSON.stringify(workspacesCall));
`

source = source.replace(marker, marker + extra)
fs.writeFileSync(FILE, source)
console.log('added virtual drag check')
