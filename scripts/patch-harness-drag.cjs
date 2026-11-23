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

/* 1. Per-instance hook cells so events can mutate state across renders. */
replaceOnce(
  'hook cell state',
  `function recordHook(name) {`,
  `/* Per-instance hook cells. React keeps hook state between renders; the fake
 * used to throw it away, which made an event handler's setState unobservable.
 * Cells are keyed by instance + call order, exactly the order React requires. */
const stateCells = new Map();
const refCells = new Map();
let hookCursor = 0;
let instanceKey = '<root>';

function hookKey(kind) {
  return instanceKey + '#' + hookCursor++;
}

function resetHookState() {
  stateCells.clear();
  refCells.clear();
}

function recordHook(name) {`,
)

replaceOnce(
  'useState',
  `  const useState = (initial) => {
    recordHook('useState');
    const value = typeof initial === 'function' ? initial() : initial;
    return [value, () => {}];
  };
  const useMemo = (factory) => {`,
  `  const useState = (initial) => {
    recordHook('useState');
    const key = hookKey('state');
    if (!stateCells.has(key)) stateCells.set(key, typeof initial === 'function' ? initial() : initial);
    const set = (next) => {
      const current = stateCells.get(key);
      stateCells.set(key, typeof next === 'function' ? next(current) : next);
    };
    return [stateCells.get(key), set];
  };
  const useMemo = (factory) => {`,
)

replaceOnce(
  'useRef',
  `  const useRef = (initial) => {
    recordHook('useRef');
    return { current: initial };
  };`,
  `  const useRef = (initial) => {
    recordHook('useRef');
    const key = hookKey('ref');
    if (!refCells.has(key)) refCells.set(key, { current: initial });
    return refCells.get(key);
  };`,
)

/* 2. Attribute hooks to the instance being rendered. */
replaceOnce(
  'root instance attribution',
  `hookCalls.length = 0;
let tree = null;
let renderError = null;
try {
  tree = sidebarRegistration.component(props);`,
  `hookCalls.length = 0;
resetHookState();
let tree = null;
let renderError = null;
instanceKey = 'Sidebar@root';
hookCursor = 0;
try {
  tree = sidebarRegistration.component(props);`,
)

replaceOnce(
  'component instance attribution',
  `      const previous = renderingComponent;
      const previousSequence = activeSequence;
      const sequence = [];
      renderingComponent = node.type;
      activeSequence = sequence;
      if (node.type.name === \`SessionRow\` || node.type.name === \`WorkspaceGroup\`) identityLog.push(node.type);
      try {
        walk(node.type(node.props));
      } finally {
        renderingComponent = previous;
        activeSequence = previousSequence;`,
  `      const previous = renderingComponent;
      const previousSequence = activeSequence;
      const previousKey = instanceKey;
      const previousCursor = hookCursor;
      const sequence = [];
      renderingComponent = node.type;
      activeSequence = sequence;
      instanceKey = (node.type.name || '<anon>') + '@' + String(node.key);
      hookCursor = 0;
      if (node.type.name === \`SessionRow\` || node.type.name === \`WorkspaceGroup\`) identityLog.push(node.type);
      try {
        walk(node.type(node.props));
      } finally {
        renderingComponent = previous;
        activeSequence = previousSequence;
        instanceKey = previousKey;
        hookCursor = previousCursor;`,
)

/* 3. renderOnce: optional state retention + instance attribution. */
replaceOnce(
  'renderOnce state scope',
  `function renderOnce(renderProps) {
  hookCalls.length = 0;
  hookLogByComponent.clear();`,
  `function renderOnce(renderProps, options) {
  const keepState = options !== undefined && options.keepState === true;
  if (!keepState) resetHookState();
  hookCalls.length = 0;
  hookLogByComponent.clear();`,
)

replaceOnce(
  'renderOnce instance key',
  `  const previous = renderingComponent;
  renderingComponent = sidebarRegistration.component;
  activeSequence = [];
  try {
    rendered = sidebarRegistration.component(renderProps);
  } catch (caught) {
    error = caught;
  } finally {
    renderingComponent = previous;
    activeSequence = null;
  }`,
  `  const previous = renderingComponent;
  renderingComponent = sidebarRegistration.component;
  activeSequence = [];
  instanceKey = 'Sidebar@root';
  hookCursor = 0;
  try {
    rendered = sidebarRegistration.component(renderProps);
  } catch (caught) {
    error = caught;
  } finally {
    renderingComponent = previous;
    activeSequence = null;
  }`,
)

/* 4. Record reorder calls instead of swallowing them. */
replaceOnce(
  'insertBefore recording',
  `  insertBefore: async () => {},`,
  `  insertBefore: async (id, anchor) => {
    workspacesCall.push(['insertBefore', id, anchor]);
  },`,
)

fs.writeFileSync(FILE, source)
console.log('harness patched for drag interaction tests')
