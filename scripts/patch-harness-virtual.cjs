/* One-shot patch: exercise the virtual-group behaviours in dragChecks —
 * new session runs in the nearest real ancestor and is filed into the group,
 * rename edits the record, delete removes the record. */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs');
let source = fs.readFileSync(FILE, 'utf8');

const anchor = `check('the created child is not a Host workspace', createdRow !== undefined && registryItems.length === 3, 'items=' + registryItems.length);
addChildRequestSet(null);
`;

if (source.indexOf(anchor) === -1) throw new Error('missing anchor');

const addition = `${anchor}
/* A virtual group has no directory: its new-session button must start the
 * session in the nearest REAL ancestor (ws-p here), then file the row under
 * the group record. */
uiWorkspaceCalls.length = 0;
const sessionFixture9 = {
  ids: ['s9'],
  byId: { s9: { id: 's9', title: 'ninth', displayTitle: 'ninth', cwd: 'C:/repo/p', running: false, retainedBy: {}, blank: false, updatedAt: '2026-01-07T00:00:00.000Z' } },
  phase: 'ready',
  projectionsBySession: {},
};
const plusForChild = afterCreate.nodes.filter(
  (entry) =>
    entry.kind === 'element' &&
    typeof (entry.props && entry.props['aria-label']) === 'string' &&
    entry.props['aria-label'].indexOf('newkid') >= 0 &&
    entry.props['aria-label'].indexOf('\u65b0\u5efa\u4f1a\u8bdd') === 0,
)[0];
check('the child group carries its own new-session button', plusForChild !== undefined, JSON.stringify(afterCreate.nodes.filter((entry) => entry.kind === 'element').map((entry) => entry.props && entry.props['aria-label']).filter(Boolean)));
if (plusForChild !== undefined) plusForChild.props.onClick({ stopPropagation: () => {} });
for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
check(
  'a new session in a child group starts in the nearest real workspace',
  JSON.stringify(uiWorkspaceCalls) === JSON.stringify([['openWorkspace', 'ws-p']]),
  JSON.stringify(uiWorkspaceCalls),
);
const filed = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(sessionFixture9) }), { keepState: true });
check('the created session is filed under the child group', filed.text.indexOf('ninth') >= 0, filed.text.slice(0, 200));

/* Rename acts on the record, not on a Host workspace. */
const createdTitle = afterCreate.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /(^|\\s)dnw-title(\\s|$)/.test(entry.props.className) && String(entry.props.title || '').length > 0,
).filter((entry) => String(entry.props.children || '') === 'newkid')[0];
check('the child group title is renameable', createdTitle !== undefined && typeof createdTitle.props.onDoubleClick === 'function');
if (createdTitle !== undefined) createdTitle.props.onDoubleClick({ preventDefault: () => {}, stopPropagation: () => {} });
let renamePass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const renameInput = renamePass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-dialogInput')[0];
check('renaming a child group opens a dialog', renameInput !== undefined);
if (renameInput !== undefined) {
  renameInput.props.onChange({ target: { value: 'renamedgroup' } });
  renamePass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
  const renameConfirm = renamePass.nodes.filter(
    (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-buttonPrimary/.test(entry.props.className),
  )[0];
  check('the rename dialog renders a confirm button', renameConfirm !== undefined);
  if (renameConfirm !== undefined) renameConfirm.props.onClick();
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
}
const renamedPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
check(
  'renaming a child group rewrites the record title',
  rowsOf(renamedPass).some((row) => String(row.props['aria-label'] || '').indexOf('renamedgroup \\u2014') === 0),
  JSON.stringify(rowsOf(renamedPass).map((row) => row.props['aria-label'])),
);
check('renaming a child group never calls the Host', workspacesCall.every((call) => call[0] !== 'rename'), JSON.stringify(workspacesCall));

/* Delete removes the record and its subtree without touching the Host. */
const renamedRow = rowsOf(renamedPass).filter((row) => String(row.props['aria-label'] || '').indexOf('renamedgroup \\u2014') === 0)[0];
check('the renamed child group still renders', renamedRow !== undefined);
if (renamedRow !== undefined) {
  renamedRow.props.onContextMenu({
    preventDefault: () => {},
    stopPropagation: () => {},
    type: 'contextmenu',
    clientX: 10,
    clientY: 10,
    currentTarget: { getBoundingClientRect: fakeRect },
  });
}
let deletePass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const deleteItem = deletePass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-menuItem/.test(entry.props.className),
).filter((entry) => {
  const kids = entry.props.children;
  const flat = Array.isArray(kids) ? kids : [kids];
  return flat.some((kid) => typeof kid === 'string' && kid === '\u5220\u9664\u5de5\u4f5c\u533a');
})[0];
check('the group menu offers delete', deleteItem !== undefined, JSON.stringify(deletePass.nodes.filter((entry) => entry.kind === 'element' && /dnw-menuItem/.test(String(entry.props.className))).length));
if (deleteItem !== undefined) deleteItem.props.onClick();
deletePass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const deleteConfirm = deletePass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-buttonPrimary/.test(entry.props.className),
)[0];
check('deleting a group asks for confirmation', deleteConfirm !== undefined);
if (deleteConfirm !== undefined) deleteConfirm.props.onClick();
for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
const gonePass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
check(
  'deleting a child group removes only the record',
  rowsOf(gonePass).every((row) => String(row.props['aria-label'] || '').indexOf('renamedgroup') === -1),
  JSON.stringify(rowsOf(gonePass).map((row) => row.props['aria-label'])),
);
check('deleting a child group never calls the Host', workspacesCall.every((call) => call[0] !== 'delete'), JSON.stringify(workspacesCall));
`;

source = source.replace(anchor, addition);
fs.writeFileSync(FILE, source);
console.log('virtual group checks added');
