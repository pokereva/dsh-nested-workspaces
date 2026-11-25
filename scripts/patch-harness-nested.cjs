/* A group can hold groups. The tree is derived from records in a fixpoint
 * loop, so a second-level record must resolve even though its parent is also
 * a record. */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs')
let source = fs.readFileSync(FILE, 'utf8')
const marker = "check('reordering child groups never calls the Host', workspacesCall.length === 0, JSON.stringify(workspacesCall));\n"
if (!source.includes(marker)) throw new Error('marker not found')

const extra = `
/* Nested groups: the parent of a record may itself be a record. */
workspacesCall.length = 0;
const nestedRow = virtualRow(vdragPass, 'newerkid');
check('the second child group renders before nesting', nestedRow !== undefined);
if (nestedRow !== undefined) {
  nestedRow.props.onContextMenu({
    preventDefault: () => {},
    stopPropagation: () => {},
    type: 'contextmenu',
    clientX: 10,
    clientY: 10,
    currentTarget: { getBoundingClientRect: fakeRect },
  });
}
let nestedPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const addChildItem = nestedPass.nodes.filter(
  (entry) => entry.kind === 'element' && entry.props.className === 'dnw-menuItem',
)[0];
if (addChildItem !== undefined) addChildItem.props.onClick({ stopPropagation: () => {} });
nestedPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const nestedInput = nestedPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-dialogInput')[0];
check('a group can open its own add-child dialog', nestedInput !== undefined);
if (nestedInput !== undefined) nestedInput.props.onChange({ target: { value: 'grandkid' } });
nestedPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const nestedConfirm = nestedPass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-buttonPrimary/.test(entry.props.className),
)[0];
if (nestedConfirm !== undefined) nestedConfirm.props.onClick();
for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
const deepPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const deepRow = virtualRow(deepPass, 'grandkid');
check('a nested child group resolves even though its parent is a record', deepRow !== undefined, JSON.stringify(rowsOf(deepPass).map((row) => row.props['aria-label'])));
if (deepRow !== undefined) {
  const style = deepRow.props.style || {};
  check('the nested group is indented one step further', style['--dnw-indent'] === '24px', JSON.stringify(style));
}
check('adding a nested group never calls the Host', workspacesCall.length === 0, JSON.stringify(workspacesCall));
`

source = source.replace(marker, marker + extra)
fs.writeFileSync(FILE, source)
console.log('added nested group checks')
