/**
 * Offline harness for dsh-nested-workspaces.
 *
 * The plugin is a browser bundle: it calls window.__ModuleLoader__.load and
 * touches nothing but the DOM through React. This harness supplies a fake
 * module loader, a fake React (shallow: one pass, no re-render scheduling) and
 * a fake cordis context, then asserts the contract the plugin exists for:
 *
 *   - the bundle registers under its own id and exports apply()
 *   - apply() claims `sidebar.workspaces` at priority -1 (shadowing the browser)
 *   - apply() contributes the "Add child workspace" row to the workspace menu
 *   - the sidebar renders without throwing for a realistic workspace/session
 *     fixture, shows the (editable) section heading, nests children under their
 *     parent, and keeps the per-workspace menu + new-session affordances
 *   - the rules of hooks hold: the sidebar's own hook sequence is identical for
 *     a small and a larger fixture, and every instance of a row component runs
 *     the same hooks (this is what a render-helper that calls access hooks used
 *     to break, blanking the whole slot)
 *
 * Run: node test/harness.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const fsp = require('fs/promises');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_SOURCE = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(name + (detail === undefined ? '' : ' — ' + detail));
}

function assertEqual(name, actual, expected) {
  check(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

/* --------------------------------------------------------------- fake React */

const hookCalls = [];

/* Which component is being rendered right now, so the hook log can be grouped
 * per component: React requires each component to keep a stable hook list. */
let renderingComponent = null;
const hookLogByComponent = new Map();
/* One entry per rendered component instance: React demands every instance of a
 * component type run the SAME hook sequence, so unequal sequences here mean a
 * rules-of-hooks violation. */
let activeSequence = null;
const componentSequences = [];
/* Component type identities seen during the last pass: a row component declared
 * inside Sidebar gets a NEW identity every render, which remounts every row and
 * drops focus. The identity must be stable across passes. */
const identityLog = [];

/* Per-instance hook cells. React keeps hook state between renders; the fake
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

function recordHook(name) {
  hookCalls.push(name);
  const key = renderingComponent === null ? '<root>' : renderingComponent.name || '<anon>';
  if (!hookLogByComponent.has(key)) hookLogByComponent.set(key, []);
  hookLogByComponent.get(key).push(name);
  if (activeSequence !== null) activeSequence.push(name);
}

function makeReact() {
  const createElement = (type, props, ...children) => ({
    type,
    key: props && props.key !== undefined ? props.key : null,
    props: Object.assign({}, props, children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }),
  });

  const Fragment = Symbol('Fragment');

  const useState = (initial) => {
    recordHook('useState');
    const key = hookKey('state');
    if (!stateCells.has(key)) stateCells.set(key, typeof initial === 'function' ? initial() : initial);
    const set = (next) => {
      const current = stateCells.get(key);
      stateCells.set(key, typeof next === 'function' ? next(current) : next);
    };
    return [stateCells.get(key), set];
  };
  const useMemo = (factory) => {
    recordHook('useMemo');
    return factory();
  };
  const useCallback = (fn) => {
    recordHook('useCallback');
    return fn;
  };
  const useRef = (initial) => {
    recordHook('useRef');
    const key = hookKey('ref');
    if (!refCells.has(key)) refCells.set(key, { current: initial });
    return refCells.get(key);
  };
  const useEffect = () => {
    recordHook('useEffect');
  };
  const useLayoutEffect = () => {
    recordHook('useLayoutEffect');
  };
  const useSyncExternalStore = (_subscribe, getSnapshot) => {
    recordHook('useSyncExternalStore');
    return getSnapshot();
  };

  return {
    createElement,
    Fragment,
    useState,
    useMemo,
    useCallback,
    useRef,
    useEffect,
    useLayoutEffect,
    useSyncExternalStore,
    useId: () => 'id',
    Children: { toArray: (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]) },
    memo: (component) => component,
    forwardRef: (render) => render,
  };
}

const fakeReact = makeReact();
const fakeReactDom = {
  createPortal: (node) => node,
};

/* ---------------------------------------------------------------- fake DOM */

const headChildren = [];
const fakeDocument = {
  head: {
    children: headChildren,
    querySelector(selector) {
      const attribute = /data-plugin-css="([^"]+)"/.exec(String(selector));
      if (attribute === null) return null;
      return headChildren.find((element) => element.attributes && element.attributes['data-plugin-css'] === attribute[1]) || null;
    },
    appendChild(element) {
      headChildren.push(element);
      return element;
    },
  },
  body: {
    children: [],
    appendChild(element) {
      this.children.push(element);
      return element;
    },
  },
  documentElement: {},
  querySelector: () => null,
  createElement: (tagName) => ({
    tagName: String(tagName).toUpperCase(),
    attributes: {},
    textContent: '',
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    remove() {
      const index = headChildren.indexOf(this);
      if (index >= 0) headChildren.splice(index, 1);
    },
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
};

/* ------------------------------------------------------------- fake module */

let loaded = null;
const moduleLoader = {
  load(definition) {
    loaded = definition;
  },
};

const sandbox = {
  window: {
    __ModuleLoader__: moduleLoader,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: null,
    innerWidth: 1200,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    document: fakeDocument,
  },
  document: fakeDocument,
  localStorage: undefined,
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (handle) => clearTimeout(handle),
};
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(CLIENT_SOURCE, sandbox, { filename: 'client.js' });

/* ------------------------------------------------------------ load contract */

check('bundle calls __ModuleLoader__.load', loaded !== null);
assertEqual('bundle id is the package name', loaded && loaded.id, PACKAGE.name);
check('bundle exposes a factory', typeof (loaded && loaded.factory) === 'function');

const requireStub = (specifier) => {
  if (specifier === 'react') return fakeReact;
  if (specifier === 'react-dom') return fakeReactDom;
  throw new Error('unexpected require: ' + specifier);
};

const plugin = loaded.factory(requireStub);
check('plugin exports apply()', typeof plugin.apply === 'function');
check('plugin declares its inject list', Array.isArray(plugin.inject));
for (const service of ['slots', 'locale', 'contextMenus', 'workspaces', 'uiWorkspace', 'sessions']) {
  check('inject includes ' + service, plugin.inject.indexOf(service) >= 0, JSON.stringify(plugin.inject));
}

/* ------------------------------------------------------------ fake cordis */

const localeRegistrations = [];
const menuContributions = [];
const slotRegistrations = [];
const effects = [];
const injected = {};

const dictionaries = {};

function translateFactory(namespace) {
  return (key, params) => {
    const dict = dictionaries[namespace] || {};
    const template = dict[key] !== undefined ? dict[key] : key;
    if (params === undefined) return template;
    return String(template).replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  };
}

/* Mutated by the reorder/dialog checks below; the service reads it lazily. */
const registryItems = [];

const workspacesCall = [];
const workspacesService = {
  list: {
    getSnapshot: () => ({ items: registryItems, archivedSessionIds: [], pinnedSessionIds: [], phase: 'ready' }),
    subscribe: () => () => {},
  },
  create: async (input) => {
    workspacesCall.push(['create', input]);
    return { workspaceId: 'ws-new', path: input.path, title: 'new' };
  },
  rename: async (id, title) => {
    workspacesCall.push(['rename', id, title]);
  },
  delete: async (id) => {
    workspacesCall.push(['delete', id]);
  },
  insertBefore: async (id, anchor) => {
    workspacesCall.push(['insertBefore', id, anchor]);
  },
  insertSessionBefore: async () => {},
  archiveSession: async () => {},
  unarchiveSession: async () => {},
};

const uiWorkspaceCalls = [];
const uiWorkspaceService = {
  createDirectory: async (parentPath, name) => {
    uiWorkspaceCalls.push(['createDirectory', parentPath, name]);
    return parentPath + '/' + name;
  },
  startSession: (workspaceId) => uiWorkspaceCalls.push(['startSession', workspaceId]),
  openSession: (target) => uiWorkspaceCalls.push(['openSession', target]),
  listDirectory: async () => ({ entries: [] }),
  pickDirectory: async () => null,
  archiveSession: async () => {},
  unarchiveSession: async () => {},
  pinSession: async () => {},
  unpinSession: async () => {},
  forkSession: () => {},
  connectWorkspace: () => {},
  openWorkspace: (workspaceId, beforeOpen) => {
    uiWorkspaceCalls.push(['openWorkspace', workspaceId]);
    if (typeof beforeOpen === 'function') beforeOpen('s9');
    return Promise.resolve();
  },
  whenAccess: () => () => {},
};

const sessionsService = {
  searchResultLimit: 20,
  search: async () => [],
  retain: () => ({ release: () => {} }),
  using: async () => ({ ok: true }),
};

const notifications = [];
const contextMenusService = {
  active: { getSnapshot: () => null, subscribe: () => () => {} },
  register: (contribution) => {
    menuContributions.push(contribution);
    return () => {};
  },
  notify: (text, success) => notifications.push([text, success]),
  open: () => {},
  close: () => {},
};

const slotsService = {
  provideRoot: () => {},
  inject: (key, callback) => {
    injected[key] = true;
    callback();
    return () => {};
  },
  register: (options, component) => {
    slotRegistrations.push({ options, component });
    return () => {};
  },
  registerFactory: () => () => {},
};

const services = {
  slots: slotsService,
  locale: {
    register: (namespace, dicts) => {
      localeRegistrations.push({ namespace, dicts });
      if (dictionaries[namespace] === undefined) dictionaries[namespace] = {};
      const zh = dicts.zh || dicts.en || {};
      Object.assign(dictionaries[namespace], zh);
    },
    getLocale: () => ({ language: 'zh' }),
    getSnapshot: () => ({ language: 'zh' }),
    subscribe: () => () => {},
    bind: (namespace) => translateFactory(namespace),
    setLocale: () => {},
    addLanguage: () => {},
  },
  contextMenus: contextMenusService,
  workspaces: workspacesService,
  uiWorkspace: uiWorkspaceService,
  sessions: sessionsService,
};

const ctx = {
  get: (name) => services[name],
  effect: (factory, label) => {
    const dispose = factory();
    effects.push({ label, dispose });
  },
  on: () => () => {},
  provide: () => {},
};

/* Real cordis exposes every service as a context property as well as through
 * ctx.get(); the plugin uses the property form, so mirror it here. */
for (const [name, service] of Object.entries(services)) ctx[name] = service;

plugin.apply(ctx);

/* -------------------------------------------------------- registration shape */

assertEqual('one locale namespace registered', localeRegistrations.length, 1);
assertEqual('locale namespace', localeRegistrations[0] && localeRegistrations[0].namespace, 'nested-workspaces');
check('injects into sidebar.workspaces', injected['sidebar.workspaces'] === true, JSON.stringify(Object.keys(injected)));

const sidebarRegistration = slotRegistrations.find((entry) => entry.options.name === 'sidebar.workspaces');
check('registers sidebar.workspaces', sidebarRegistration !== undefined);
assertEqual('shadows the shipped browser (priority -1)', sidebarRegistration && sidebarRegistration.options.priority, -1);
assertEqual('declares its own locale namespace', sidebarRegistration && sidebarRegistration.options.locale, 'nested-workspaces');
check('sidebar component is a component', typeof (sidebarRegistration && sidebarRegistration.component) === 'function');

const addChildContribution = menuContributions.find((entry) => entry.id === 'workspace.addChild');
check('registers an "add child workspace" menu contribution', addChildContribution !== undefined, JSON.stringify(menuContributions.map((entry) => entry.id)));
assertEqual('menu contribution targets a workspace', addChildContribution && addChildContribution.target, 'workspace');

const menuTarget = { kind: 'workspace', value: { workspaceId: 'ws-a', path: 'C:/repo/a', displayTitle: 'a' } };
const resolvedActions = addChildContribution.resolve(menuTarget, undefined);
check('menu contribution resolves to actions', Array.isArray(resolvedActions) && resolvedActions.length > 0);
const addChildAction = Array.isArray(resolvedActions) ? resolvedActions[0] : null;
check('menu action carries a label', typeof (addChildAction && addChildAction.label) === 'string' && addChildAction.label.length > 0);
check('menu action carries an icon key', !!(addChildAction && addChildAction.icon && addChildAction.icon.key));

/* Non-drag route into a child workspace: every session menu gains a Move to
 * submenu, so the feature does not depend on a pointer drag. */
const moveContribution = menuContributions.find((entry) => entry.id === 'session.nestedMoveTo');
check('registers a session "move to" contribution', moveContribution !== undefined, JSON.stringify(menuContributions.map((entry) => entry.id)));
assertEqual('move contribution targets a session', moveContribution && moveContribution.target, 'session');
const moveTarget = { kind: 'session', value: { sessionId: 's1', displayTitle: 'first' } };
const moveActions = moveContribution.resolve(moveTarget, undefined);
const moveAction = Array.isArray(moveActions) ? moveActions[0] : null;
check('move action nests a workspace submenu', Array.isArray(moveAction && moveAction.children) && moveAction.children.length > 0, JSON.stringify(moveAction));
check(
  'move submenu lists every workspace',
  Array.isArray(moveAction && moveAction.children) && moveAction.children.length >= workspacesService.list.getSnapshot().items.length,
);

/* ------------------------------------------------------------- shallow render */

const workspacesFixture = [
  {
    workspaceId: 'ws-a',
    path: 'C:/repo/a',
    title: 'parent',
    sessionIds: ['s1', 's2'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    workspaceId: 'ws-b',
    path: 'C:/repo/a/child',
    title: 'child',
    sessionIds: ['s3'],
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
  },
];

const sessionFixture = {
  ids: ['s1', 's2', 's3'],
  byId: {
    s1: { id: 's1', title: 'first', displayTitle: 'first', cwd: 'C:/repo/a', running: false, retainedBy: { mainView: 1 }, blank: false, updatedAt: '2026-01-02T00:00:00.000Z' },
    s2: { id: 's2', title: 'second', displayTitle: 'second', cwd: 'C:/repo/a', running: false, retainedBy: {}, blank: false, updatedAt: '2026-01-01T00:00:00.000Z' },
    s3: { id: 's3', title: 'third', displayTitle: 'third', cwd: 'C:/repo/a/child', running: false, retainedBy: {}, blank: false, updatedAt: '2026-01-03T00:00:00.000Z' },
  },
  phase: 'ready',
  projectionsBySession: {},
};

const workspaceSnapshot = {
  items: workspacesFixture,
  archivedSessionIds: [],
  pinnedSessionIds: [],
  state: 'idle',
  phase: 'ready',
  error: null,
};

const selectorHook = (snapshot) => (selector) => (selector === undefined ? snapshot : selector(snapshot));

const props = {
  wide: true,
  expandSidebar: () => {},
  renderFactorySlot: () => null,
  useSessions: selectorHook(sessionFixture),
  useWorkspaces: selectorHook(workspaceSnapshot),
  useSessionStatus: selectorHook(new Map()),
  usePanelInfo: selectorHook({ activePanelId: null }),
  useContextMenu: () => ({ getTriggerProps: () => ({}) }),
  useRemoteAccess: () => true,
  useWorkspaceAccess: () => { recordHook('useWorkspaceAccess'); return true; },
  useSessionAccess: () => { recordHook('useSessionAccess'); return true; },
  useSessionRetainInfo: () => undefined,
  useResource: () => ({ status: 'none' }),
  useSectionScroller: () => ({ bindScrollerRef: () => {} }),
};

hookCalls.length = 0;
resetHookState();
let tree = null;
let renderError = null;
instanceKey = 'Sidebar@root';
hookCursor = 0;
try {
  tree = sidebarRegistration.component(props);
} catch (error) {
  renderError = error;
}

check('sidebar renders without throwing', renderError === null, renderError && (renderError.stack || String(renderError)));
check('sidebar used hooks (it is a real component)', hookCalls.length > 0, hookCalls.join(','));

/* Walk the element tree collecting text and props of interest. */
const collected = [];

function walk(node) {
  if (node === null || node === undefined || node === false || node === true) return;
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    collected.push({ kind: 'text', value: String(node) });
    return;
  }
  if (typeof node === 'function') {
    walk(node({}));
    return;
  }
  if (typeof node === 'object' && node.props !== undefined) {
    collected.push({ kind: 'element', type: node.type, props: node.props, key: node.key });
    /* A function element is a component: run it so its own hooks and children
     * are part of this pass. This is what makes a hook-order change visible. */
    if (typeof node.type === 'function') {
      const previous = renderingComponent;
      const previousSequence = activeSequence;
      const previousKey = instanceKey;
      const previousCursor = hookCursor;
      const sequence = [];
      renderingComponent = node.type;
      activeSequence = sequence;
      instanceKey = (node.type.name || '<anon>') + '@' + String(node.key);
      hookCursor = 0;
      if (node.type.name === `SessionRow` || node.type.name === `WorkspaceGroup`) identityLog.push(node.type);
      try {
        walk(node.type(node.props));
      } finally {
        renderingComponent = previous;
        activeSequence = previousSequence;
        instanceKey = previousKey;
        hookCursor = previousCursor;
        componentSequences.push({
          name: node.type.name || '<anon>',
          key: node.key,
          hooks: Object.freeze(sequence.slice()),
        });
      }
      return;
    }
    walk(node.props.children);
    return;
  }
  collected.push({ kind: 'other', value: node });
}

if (tree !== null) walk(tree);

const text = collected.filter((entry) => entry.kind === 'text').map((entry) => entry.value).join(' ');
const elements = collected.filter((entry) => entry.kind === 'element');
const ariaLabels = elements.map((entry) => String((entry.props && entry.props['aria-label']) || '')).join('|');
const ariaDescriptions = elements.map((entry) => String((entry.props && entry.props['aria-description']) || '')).join('|');
const accessibleText = text + '|' + ariaLabels + '|' + ariaDescriptions;

check('renders the heading rename affordance', /double|双击|ダブル/.test(accessibleText), accessibleText.slice(0, 200));
check('renders both workspace titles', text.indexOf('parent') >= 0 && text.indexOf('child') >= 0, text.slice(0, 300));
check('renders both session titles', text.indexOf('first') >= 0 && text.indexOf('third') >= 0, text.slice(0, 300));

const headingNodes = elements.filter((entry) => typeof entry.props.className === 'string' && /dnw-label/.test(entry.props.className));
check('heading is present and editable on double click', headingNodes.some((entry) => typeof entry.props.onDoubleClick === 'function'));

const titleNodes = elements.filter((entry) => typeof entry.props.className === 'string' && /dnw-title/.test(entry.props.className));
check('workspace titles are renameable on double click', titleNodes.some((entry) => typeof entry.props.onDoubleClick === 'function'));

const labelledControls = ariaLabels.split('|').filter((label) => label.length > 0);
check(
  'workspace rows expose a new-session affordance',
  labelledControls.some((label) => /new session|新建会话|新規/.test(label)),
  labelledControls.join('|'),
);
check(
  'workspace rows expose a menu affordance',
  labelledControls.some((label) => /more|menu|菜单|操作|メニュー/.test(label)),
  labelledControls.join('|'),
);

const scrollerNodes = elements.filter((entry) => entry.props && entry.props['data-sidebar-list-area'] !== undefined);
check('binds the sidebar scroll area', scrollerNodes.length === 1);

/* ------------------------------------------- hook-order (rules of hooks) check
 * A render helper that is called as a plain function but still calls
 * useSessionAccess/useWorkspaceAccess attributes those hooks to the PARENT, so
 * the parent's hook count changes with the number of rows: React then throws
 * "change in the order of Hooks" and blanks the whole sidebar slot. Render the
 * same component with a bigger fixture and require the parent hook sequence to
 * be identical. */

function renderOnce(renderProps, options) {
  const keepState = options !== undefined && options.keepState === true;
  if (!keepState) resetHookState();
  hookCalls.length = 0;
  hookLogByComponent.clear();
  componentSequences.length = 0;
  identityLog.length = 0;
  const startIndex = collected.length;
  let rendered = null;
  let error = null;
  const previous = renderingComponent;
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
  }
  if (rendered !== null) walk(rendered);
  const passNodes = collected.slice(startIndex);
  const passText = passNodes
    .filter((entry) => entry.kind === 'text')
    .map((entry) => entry.value)
    .join(' ');
  return {
    error,
    text: passText,
    nodes: passNodes,
    sidebarHooks: (hookLogByComponent.get('Sidebar') || []).slice(),
    sequences: componentSequences.map((entry) => ({ name: entry.name, hooks: entry.hooks })),
    identities: Array.from(new Set(identityLog)),
    hookCount: hookCalls.length,
  };
}

const bigFixture = {
  items: workspacesFixture.concat([
    {
      workspaceId: 'ws-c',
      path: 'C:/repo/a/child2',
      title: 'child two',
      sessionIds: ['s4'],
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
    },
  ]),
  archivedSessionIds: [],
  pinnedSessionIds: [],
  state: 'idle',
  phase: 'ready',
  error: null,
};

const bigSessions = {
  ids: sessionFixture.ids.concat(['s4']),
  byId: Object.assign({}, sessionFixture.byId, {
    s4: { id: 's4', title: 'fourth', displayTitle: 'fourth', cwd: 'C:/repo/a/child2', running: false, retainedBy: {}, blank: false, updatedAt: '2026-01-04T00:00:00.000Z' },
  }),
  phase: 'ready',
  projectionsBySession: {},
};

const smallPass = renderOnce(props);
const bigPass = renderOnce(
  Object.assign({}, props, {
    useSessions: selectorHook(bigSessions),
    useWorkspaces: selectorHook(bigFixture),
  }),
);

check('both renders succeed (small and large fixture)', smallPass.error === null && bigPass.error === null,
  (smallPass.error && (smallPass.error.stack || String(smallPass.error))) || (bigPass.error && (bigPass.error.stack || String(bigPass.error))));

const sidebarStable = smallPass.sidebarHooks.join(',') === bigPass.sidebarHooks.join(',');
check(
  'sidebar hook sequence does not depend on the number of rows (rules of hooks)',
  sidebarStable,
  'small=[' + smallPass.sidebarHooks.join(',') + '] big=[' + bigPass.sidebarHooks.join(',') + ']',
);
check('sidebar hook sequence is non-empty', bigPass.sidebarHooks.length > 0);

/* Every instance of one component type must run the same hooks. */
const hooksByType = new Map();
for (const entry of bigPass.sequences) {
  const seen = hooksByType.get(entry.name);
  if (seen === undefined) {
    hooksByType.set(entry.name, entry.hooks.join(','));
    continue;
  }
  if (seen !== entry.hooks.join(',')) {
    hooksByType.set(entry.name, 'MISMATCH: [' + seen + '] vs [' + entry.hooks.join(',') + ']');
  }
}
const mismatchedTypes = [...hooksByType.entries()].filter(([, value]) => value.startsWith('MISMATCH'));
check(
  'every instance of a row component runs the same hooks',
  mismatchedTypes.length === 0,
  mismatchedTypes.map(([name, value]) => name + ' ' + value).join(' | '),
);
check(
  'row access hooks are attributed to the row components, not the sidebar',
  !bigPass.sidebarHooks.some((hook) => /Access$/.test(hook)),
  bigPass.sidebarHooks.join(','),
);

/* A row component declared inside Sidebar is a new function object on every
 * render, so React unmounts and remounts every row whenever the sidebar
 * re-renders (menu open, drag over, each keystroke) and focus is lost. The
 * component identity must therefore be identical across two separate passes. */
const sharedIdentities = smallPass.identities.filter((type) => bigPass.identities.indexOf(type) >= 0);
check(
  'row components keep one identity across renders (no remount churn)',
  smallPass.identities.length > 0 && sharedIdentities.length === smallPass.identities.length,
  'small=' + smallPass.identities.length + ' shared=' + sharedIdentities.length,
);

/* ------------------------------------------------- last-used time and pinning */

/* The shipped browser prints a relative age at rest and a pin glyph on pinned
 * rows; both come from data the sidebar already subscribes to. */
const pinnedPass = renderOnce(
  Object.assign({}, props, {
    useWorkspaces: selectorHook(Object.assign({}, workspaceSnapshot, { pinnedSessionIds: ['s2'] })),
  }),
);
check('pinned render succeeds', pinnedPass.error === null, pinnedPass.error && (pinnedPass.error.stack || String(pinnedPass.error)));

const pinnedNodes = pinnedPass.nodes.filter((entry) => entry.kind === 'element');
const timeNodes = pinnedNodes.filter((entry) => typeof entry.props.className === 'string' && /(^|\s)dnw-time(\s|$)/.test(entry.props.className));
check('session rows render a last-used time', timeNodes.length > 0, 'time nodes=' + timeNodes.length);
check(
  'the time cell carries a full tooltip sentence',
  timeNodes.some((entry) => typeof entry.props.title === 'string' && entry.props.title.length > 0),
  timeNodes.map((entry) => entry.props.title).join('|'),
);

/* Pin/unpin is offered by ui-workspace's own `session.pin` contribution; this
 * plugin must NOT duplicate it in the same menu. The plugin's value-add is the
 * row button, covered below. */
check(
  'does not duplicate the shipped session pin menu',
  menuContributions.every((entry) => entry.id !== 'session.nestedPin'),
  JSON.stringify(menuContributions.map((entry) => entry.id)),
);

/* Pinned rows must come first inside their group, and the pin glyph must be
 * present for them only. */
function renderWithSnapshot(snapshot, sessions) {
  return renderOnce(
    Object.assign({}, props, {
      useWorkspaces: selectorHook(snapshot),
      useSessions: selectorHook(sessions),
    }),
  );
}

const markerSessions = {
  ids: ['a', 'b'],
  byId: {
    a: { id: 'a', title: 'older', displayTitle: 'older', cwd: 'C:/repo/a', running: false, retainedBy: {}, blank: false, updatedAt: Date.now() - 2 * 60 * 60 * 1000 },
    b: { id: 'b', title: 'newer', displayTitle: 'newer', cwd: 'C:/repo/a', running: false, retainedBy: {}, blank: false, updatedAt: Date.now() - 5 * 60 * 1000 },
  },
  phase: 'ready',
  projectionsBySession: {},
};
const singleWorkspace = {
  items: [workspacesFixture[0]],
  archivedSessionIds: [],
  pinnedSessionIds: ['a'],
  state: 'idle',
  phase: 'ready',
  error: null,
};
const orderPass = renderWithSnapshot(singleWorkspace, markerSessions);
check('pinned ordering render succeeds', orderPass.error === null, orderPass.error && (orderPass.error.stack || String(orderPass.error)));
const orderText = orderPass.text;
const pinNodes = orderPass.nodes.filter((entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-pinIndicator/.test(entry.props.className));
check('pinned rows render the pin glyph', pinNodes.length === 1, 'pin nodes=' + pinNodes.length);
check('the pin glyph is labelled', pinNodes.some((entry) => typeof entry.props['aria-label'] === 'string' && entry.props['aria-label'].length > 0));
const restNodes = orderPass.nodes.filter((entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /dnw-resting/.test(entry.props.className));
check('every non-blank session renders a resting cell', restNodes.length === 2, 'resting=' + restNodes.length);
check(
  'pinned rows sort ahead of newer unpinned rows',
  orderText !== undefined
    ? orderText.indexOf('older') >= 0 && orderText.indexOf('older') < orderText.indexOf('newer')
    : true,
  'captured=' + (orderPass.text === undefined ? 'no text captured' : orderText.slice(0, 200)),
);

/* A child workspace is a real Workspace under the parent's directory: it must
 * render nested (deeper indent) and, like the shipped browser, ahead of the
 * parent's own session rows so a freshly added child is not buried below them. */
const indentedRows = bigPass.nodes.filter(
  (entry) => entry.kind === 'element' && entry.props.style !== undefined && typeof entry.props.style['--dnw-indent'] === 'string',
);
const depths = indentedRows.map((entry) => entry.props.style['--dnw-indent']);
check('workspace rows carry an indent per depth', depths.length >= 3, JSON.stringify(depths));
check('a child workspace is indented deeper than its root', depths.indexOf('12px') >= 0 && depths.indexOf('0px') >= 0, JSON.stringify(depths));

const rowOrder = [];
for (const entry of bigPass.nodes) {
  if (entry.kind === 'element' && typeof entry.props['aria-label'] === 'string' && / — /.test(entry.props['aria-label'])) {
    rowOrder.push(entry.props['aria-label'].split(' — ')[0]);
  }
  if (entry.kind === 'element' && entry.props.className === 'dnw-title' && typeof entry.props.children === 'string') {
    rowOrder.push('session:' + entry.props.children);
  }
}
const parentWorkspaceAt = rowOrder.indexOf('parent');
const childWorkspaceAt = rowOrder.indexOf('child');
const parentSessionAt = rowOrder.indexOf('session:first');
check(
  'child workspaces render above the parent own session rows',
  parentWorkspaceAt >= 0 && childWorkspaceAt > parentWorkspaceAt && parentSessionAt > childWorkspaceAt,
  JSON.stringify(rowOrder),
);

/* The resting cell must render the relative last-used label, not an empty span. */
function elementText(entry) {
  const children = entry.props.children
  if (Array.isArray(children)) return children.filter((child) => typeof child === 'string').join('')
  if (typeof children === 'string') return children
  return ''
}
const timeTexts = orderPass.nodes
  .filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-time')
  .map(elementText);
check('resting cells render a relative time label', timeTexts.every((text) => text.trim() !== ''), JSON.stringify(timeTexts));
check('relative time buckets differ for 2h and 5min', new Set(timeTexts).size === 2, JSON.stringify(timeTexts));

/* Leading status cell, matching the shipped browser: idle rows draw nothing,
 * a running row draws the spinner, and a pending interaction draws a dot. */
const dotNodes = orderPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-stateDot');
const spinnerNodes = orderPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-spinner');
check('idle session rows draw no status glyph', dotNodes.length === 0 && spinnerNodes.length === 0, 'dots=' + dotNodes.length + ' spinners=' + spinnerNodes.length);

const runningStatuses = new Map([['s1', { running: true, pendingInteraction: undefined, completionUnread: false }]]);
const runningPass = renderOnce(Object.assign({}, props, { useSessionStatus: selectorHook(runningStatuses) }));
check('a running session renders', runningPass.error === null, runningPass.error && (runningPass.error.stack || String(runningPass.error)));
const runningSpinners = runningPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-spinner');
check('a running session draws the spinner', runningSpinners.length === 1, 'spinners=' + runningSpinners.length);
const runningDots = runningPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-stateDot');
check('a running session draws no idle dot', runningDots.length === 0, 'dots=' + runningDots.length);
const spinnerSvg = runningSpinners[0];
const motionGroups = runningPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-spinnerMotion');
const trackNodes = runningPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-spinnerTrack');
const arcNodes = runningPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-spinnerArc');
check(
  'the spinner is the shipped two-ring arc',
  spinnerSvg !== undefined &&
    spinnerSvg.props.viewBox === '0 0 24 24' &&
    motionGroups.length === 1 &&
    trackNodes.length === 1 &&
    arcNodes.length === 1 &&
    trackNodes[0].props.r === '9.5' &&
    arcNodes[0].props.r === '9.5',
  JSON.stringify({ groups: motionGroups.length, tracks: trackNodes.length, arcs: arcNodes.length }),
);

const waitingStatuses = new Map([['s1', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: false }]]);
const waitingPass = renderOnce(Object.assign({}, props, { useSessionStatus: selectorHook(waitingStatuses) }));
const waitingDots = waitingPass.nodes.filter((entry) => entry.kind === 'element' && entry.props.className === 'dnw-stateDot');
check('a pending approval draws the warning dot', waitingDots.length === 1 && waitingDots[0].props['data-state'] === 'warning', 'dots=' + waitingDots.length);

/* Session rows inherit the indent of the group they sit in, so a child
 * workspace's sessions line up under that child rather than under the root. */
const groupIndents = bigPass.nodes
  .filter((entry) => entry.kind === 'element' && entry.props.role === 'group' && entry.props.style !== undefined)
  .map((entry) => entry.props.style['--dnw-indent']);
check('session groups carry the owning workspace indent', groupIndents.indexOf('0px') >= 0 && groupIndents.indexOf('12px') >= 0, JSON.stringify(groupIndents));
check('one session group per workspace with sessions', groupIndents.length === 3, JSON.stringify(groupIndents));


/* While a row's shared menu is open its action cluster stays visible — the menu
 * portals away from the row, so :hover / :focus-within cannot hold. */
let activeTarget = null;
contextMenusService.active = {
  getSnapshot: () => activeTarget,
  subscribe: () => () => {},
};
activeTarget = { kind: 'session', value: { sessionId: 'a', displayTitle: 'older' } };
const openPass = renderWithSnapshot(singleWorkspace, markerSessions);
check('row with an open menu renders', openPass.error === null, openPass.error && (openPass.error.stack || String(openPass.error)));
const openClusters = openPass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /\bdnw-actionsOpen\b/.test(entry.props.className),
);
check('the open row keeps its action cluster visible', openClusters.length === 1, 'open clusters=' + openClusters.length);
activeTarget = null;
const closedPass = renderWithSnapshot(singleWorkspace, markerSessions);
const stillOpen = closedPass.nodes.filter(
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /\bdnw-actionsOpen\b/.test(entry.props.className),
);
check('the cluster closes with the menu', stillOpen.length === 0, 'open clusters=' + stillOpen.length);



/* ------------------------------------------------- workspace drag & creation */
async function dragChecks() {

let addChildRequestSet = () => {};
{
  const contribution = menuContributions.find((entry) => entry.id === 'workspace.addChild');
  const actions = contribution.resolve({ workspaceId: 'ws-p', path: 'C:/repo/p', displayTitle: 'root' }, undefined);
  addChildRequestSet = () => {
    actions[0].run();
  };
}

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

/* Requirement: adding a child workspace creates NO directory and NO Host
 * workspace — it is a record in this plugin's store. */
registryItems.length = 0;
registryItems.push(scopeFixture[0], scopeFixture[1], scopeFixture[2]);
workspacesCall.length = 0;
addChildRequestSet({ parentId: 'ws-p', parentPath: null, parentTitle: 'root' });
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
for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
await new Promise((resolve) => setTimeout(resolve, 0));
check(
  'creating a child touches neither the filesystem nor the Host registry',
  workspacesCall.length === 0,
  JSON.stringify(workspacesCall),
);
const afterCreate = renderOnce(Object.assign({}, props, { useWorkspaces: selectorHook(scopeSnapshot), useSessions: selectorHook(emptySessions) }), { keepState: true });
const createdRow = rowsOf(afterCreate).filter((row) => String(row.props['aria-label'] || '').indexOf('newkid —') === 0)[0];
check('the new child renders as a row of its own', createdRow !== undefined, JSON.stringify(rowsOf(afterCreate).map((row) => row.props['aria-label'])));
check('the created child is not a Host workspace', createdRow !== undefined && registryItems.length === 3, 'items=' + registryItems.length);

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
    entry.props['aria-label'].indexOf('新建会话') === 0,
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
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /(^|\s)dnw-title(\s|$)/.test(entry.props.className) && String(entry.props.title || '').length > 0,
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
  rowsOf(renamedPass).some((row) => String(row.props['aria-label'] || '').indexOf('renamedgroup \u2014') === 0),
  JSON.stringify(rowsOf(renamedPass).map((row) => row.props['aria-label'])),
);
check('renaming a child group never calls the Host', workspacesCall.every((call) => call[0] !== 'rename'), JSON.stringify(workspacesCall));

/* Delete removes the record and its subtree without touching the Host. */
const renamedRow = rowsOf(renamedPass).filter((row) => String(row.props['aria-label'] || '').indexOf('renamedgroup \u2014') === 0)[0];
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
  (entry) => entry.kind === 'element' && typeof entry.props.className === 'string' && /(^|\s)dnw-menuItemDanger(\s|$)/.test(entry.props.className),
)[0];
check('the group menu offers delete', deleteItem !== undefined, JSON.stringify(deletePass.nodes.filter((entry) => entry.kind === 'element' && /dnw-menuItem/.test(String(entry.props.className))).length));
if (deleteItem !== undefined) deleteItem.props.onClick({ stopPropagation: () => {} });

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

}

/* ------------------------------------------------------------------ host half */

/* index.js is an ES module and this harness is CommonJS, so the host section
 * runs inside an async main and the summary print follows it. The Host half has
 * no work to do any more — a child workspace is a record in the browser store,
 * so nothing is created on disk. These checks pin that down. */
async function hostChecks() {
  const hostModule = await import(pathToFileURL(path.join(ROOT, 'index.js')).href);
  check('host half exports apply()', typeof hostModule.apply === 'function');
  check(
    'host half declares no service inject',
    Array.isArray(hostModule.inject) && hostModule.inject.length === 0,
    JSON.stringify(hostModule.inject),
  );

  let touched = 0;
  const hostCtx = {
    connection: {
      get fetch() {
        touched += 1;
        return { register: () => async () => {} };
      },
    },
    effect: () => {
      touched += 1;
    },
  };
  hostModule.apply(hostCtx);
  check('host half registers no route and no effect', touched === 0, 'touched=' + touched);
}

dragChecks()
  .then(() => hostChecks())
  .then(
  () => finish(),
  (error) => {
    failures.push('host half checks threw — ' + (error && error.stack ? error.stack : String(error)));
    finish();
  },
);

/* Summary print. It has to wait for hostChecks(), because the route
 * assertions are async. */
function finish() {
  if (failures.length > 0) {
    console.error('FAILED ' + failures.length + ' of ' + (passed + failures.length) + ' checks:');
    for (const failure of failures) console.error('  x ' + failure);
    process.exitCode = 1;
    return;
  }
  console.log('ok — ' + passed + ' checks passed');
}
