'use strict'
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'test', 'harness.cjs')
let source = fs.readFileSync(FILE, 'utf8')

function replaceOnce(label, needle, next) {
  const at = source.indexOf(needle)
  if (at === -1) throw new Error('missing: ' + label)
  if (source.indexOf(needle, at + needle.length) !== -1) throw new Error('duplicated: ' + label)
  source = source.slice(0, at) + next + source.slice(at + needle.length)
}

/* The dialog's "land on top" path reads the live registry snapshot, and the
 * move-to submenu compares against it, so the fake must expose a fixture. */
replaceOnce(
  'workspace list snapshot',
  `  list: { getSnapshot: () => ({ items: [], archivedSessionIds: [], pinnedSessionIds: [], phase: 'ready' }), subscribe: () => () => {} },`,
  `  list: {
    getSnapshot: () => ({ items: registryItems, archivedSessionIds: [], pinnedSessionIds: [], phase: 'ready' }),
    subscribe: () => () => {},
  },`,
)

replaceOnce(
  'registry items holder',
  `const workspacesCall = [];`,
  `/* Mutated by the reorder/dialog checks below; the service reads it lazily. */
const registryItems = [];

const workspacesCall = [];`,
)

const checks = String.raw`

/* ------------------------------------------------- workspace drag & creation */

/* Reordering is a drag on the workspace row itself; a child must be movable
 * among its own siblings and must never be moved out of its parent by one. */
const scopeFixture = [
  { workspaceId: 'ws-p', path: 'C:/repo/p', title: 'root', sessionIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
  { workspaceId: 'ws-c1', path: 'C:/repo/p/one', title: 'one', sessionIds: [], createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-04T00:00:00.000Z' },
  { workspaceId: 'ws-c2', path: 'C:/repo/p/two', title: 'two', sessionIds: [], createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-06T00:00:00.000Z' },
];
const scopeSnapshot = {
  items: scopeFixture,
  archivedSessionIds: [],
  pinnedSessionIds: [],
  state: 'idle',
  phase: 'ready',
  error: null,
};
const emptySessions = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} };

function rowsOf(pass) {
  return pass.nodes.filter(
    (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /(^|\s)dnw-workspaceRow(\s|$)/.test(entry.props.className),
  );
}

function rowFor(pass, workspaceId) {
  const rows = rowsOf(pass);
  for (const row of rows) {
    const label = String(row.props['aria-label'] || '');
    if (label.indexOf(workspaceId === 'ws-c1' ? 'one —' : workspaceId === 'ws-c2' ? 'two —' : 'root —') === 0) return row;
  }
  return null;
}

const fakeRect = () => ({ top: 0, height: 32, left: 0, right: 200, bottom: 32 });
const dragEvent = (currentTarget, clientY) => ({
  currentTarget,
  target: currentTarget,
  clientY,
  preventDefault: () => {},
  stopPropagation: () => {},
  dataTransfer: { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '' },
});

workspacesCall.length = 0;
let dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
check('workspace rows are draggable', rowsOf(dragPass).every((row) => row.props.draggable === true), 'rows=' + rowsOf(dragPass).length);

const childRow = rowFor(dragPass, 'ws-c2');
const siblingRow = rowFor(dragPass, 'ws-c1');
check('both child rows render', childRow !== null && siblingRow !== null);
childRow.props.onDragStart(dragEvent({ closest: () => null }, 0));
dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const hoveredSibling = rowFor(dragPass, 'ws-c1');
hoveredSibling.props.onDragOver(Object.assign(dragEvent({ closest: () => null }, 4), { currentTarget: { getBoundingClientRect: fakeRect } }));
dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const markedRow = rowFor(dragPass, 'ws-c1');
check(
  'hovering a sibling paints the insertion marker',
  typeof markedRow.props.className === 'string' && /dnw-dropBefore/.test(markedRow.props.className),
  String(markedRow.props.className),
);
const draggingRow = rowFor(dragPass, 'ws-c2');
check(
  'the dragged row is dimmed',
  typeof draggingRow.props.className === 'string' && /dnw-rowDragging/.test(draggingRow.props.className),
  String(draggingRow.props.className),
);
rowFor(dragPass, 'ws-c2').props.onDragEnd();
check(
  'dropping a child before its sibling reorders inside the parent',
  JSON.stringify(workspacesCall) === JSON.stringify([['insertBefore', 'ws-c2', 'ws-c1']]),
  JSON.stringify(workspacesCall),
);

/* A drag that crosses the parent boundary must be refused: the child stays
 * where it is instead of being hoisted to the root. */
workspacesCall.length = 0;
dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
rowFor(dragPass, 'ws-c1').props.onDragStart(dragEvent({ closest: () => null }, 0));
dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
rowFor(dragPass, 'ws-p').props.onDragOver(Object.assign(dragEvent({ closest: () => null }, 4), { currentTarget: { getBoundingClientRect: fakeRect } }));
dragPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
rowFor(dragPass, 'ws-c1').props.onDragEnd();
check('a workspace drag cannot leave its parent', workspacesCall.length === 0, JSON.stringify(workspacesCall));

/* Requirement: a newly created child lands ABOVE its existing siblings. */
registryItems.length = 0;
registryItems.push(scopeFixture[1], scopeFixture[2]);
workspacesCall.length = 0;
addChildRequestSet({ parentId: 'ws-p', parentPath: 'C:/repo/p', parentTitle: 'root' });
let dialogPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const input = dialogPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-dialogInput')[0];
check('the add-child dialog renders an input', input !== undefined);
input.props.onChange({ target: { value: 'newkid' } });
dialogPass = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const confirm = dialogPass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-buttonPrimary/.test(entry.props.className),
)[0];
check('the dialog renders a confirm button', confirm !== undefined);
confirm.props.onClick();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
check(
  'creating a child registers it and anchors it above its siblings',
  JSON.stringify(workspacesCall) === JSON.stringify([['create', { path: 'C:/repo/p/newkid' }], ['insertBefore', 'ws-new', 'ws-c1']]),
  JSON.stringify(workspacesCall),
);
addChildRequestSet(null);
`

replaceOnce(
  'insert drag checks',
  `/* ------------------------------------------------------------------ host half */`,
  checks + `
/* ------------------------------------------------------------------ host half */`,
)

/* The dialog opens through a signal the plugin keeps private; drive it from the
 * menu contribution the plugin registers, which is the real user path. */
replaceOnce(
  'signal bridge',
  `/* ------------------------------------------------- workspace drag & creation */`,
  `/* ------------------------------------------------- workspace drag & creation */

let addChildRequestSet = () => {};
{
  const contribution = menuContributions.find((entry) => entry.id === 'workspace.addChild');
  const actions = contribution.resolve({ kind: 'workspace', value: { workspaceId: 'ws-p', path: 'C:/repo/p', displayTitle: 'root' } }, undefined);
  addChildRequestSet = (request) => {
    if (request === null) {
      /* the dialog's own close handler resets the signal */
      const dialogPass = null;
      return;
    }
    actions[0].run();
  };
}`,
)

/* The dialog only renders while the request is set, and its close path clears
 * the signal; call the menu action instead of poking internals. */
replaceOnce(
  'open dialog via menu',
  `addChildRequestSet({ parentId: 'ws-p', parentPath: 'C:/repo/p', parentTitle: 'root' });
let dialogPass`,
  `addChildRequestSet({ parentId: 'ws-p', parentPath: 'C:/repo/p', parentTitle: 'root' });
let dialogPass`,
)

/* The signal bridge above is replaced by a direct call to the registered action. */
source = source.replace(
  `addChildRequestSet = (request) => {
    if (request === null) {
      /* the dialog's own close handler resets the signal */
      const dialogPass = null;
      return;
    }
    actions[0].run();
  };`,
  `addChildRequestSet = () => {
    actions[0].run();
  };`,
)

fs.writeFileSync(FILE, source)
console.log('harness patched with workspace drag checks')
