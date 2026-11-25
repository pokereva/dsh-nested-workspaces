/* Ordering check: a child added later must render ABOVE the earlier siblings.
 * Records are stored newest-first, and the view walks the store in order. */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs')
let source = fs.readFileSync(FILE, 'utf8')
const marker = "check('the created child is not a Host workspace', createdRow !== undefined && registryItems.length === 3, 'items=' + registryItems.length);\n"
if (!source.includes(marker)) throw new Error('marker not found')

const extra = `
/* A second child must sit above the first: new records are prepended, so the
 * group renders in the order it was created from newest to oldest. */
addChildRequestSet({ parentId: 'ws-p', parentPath: null, parentTitle: 'root' });
let secondPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const secondInput = secondPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-dialogInput')[0];
if (secondInput !== undefined) secondInput.props.onChange({ target: { value: 'newerkid' } });
secondPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const secondConfirm = secondPass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-buttonPrimary/.test(entry.props.className),
)[0];
if (secondConfirm !== undefined) secondConfirm.props.onClick();
for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
const orderedPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const orderLabels = rowsOf(orderedPass).map((row) => String(row.props['aria-label'] || ''));
const newerAt = orderLabels.findIndex((label) => label.indexOf('newerkid \\u2014') === 0);
const olderAt = orderLabels.findIndex((label) => label.indexOf('newkid \\u2014') === 0);
check(
  'a newly added child renders above the older siblings',
  newerAt !== -1 && olderAt !== -1 && newerAt < olderAt,
  JSON.stringify(orderLabels),
);
`

source = source.replace(marker, marker + extra)
fs.writeFileSync(FILE, source)
console.log('added ordering check')
