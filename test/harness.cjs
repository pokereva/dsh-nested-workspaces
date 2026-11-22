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
    const value = typeof initial === 'function' ? initial() : initial;
    return [value, () => {}];
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
    return { current: initial };
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

const workspacesCall = [];
const workspacesService = {
  list: { getSnapshot: () => ({ items: [], archivedSessionIds: [], pinnedSessionIds: [], phase: 'ready' }), subscribe: () => () => {} },
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
  insertBefore: async () => {},
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
  openWorkspace: () => {},
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
let tree = null;
let renderError = null;
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
    collected.push({ kind: 'element', type: node.type, props: node.props });
    /* A function element is a component: run it so its own hooks and children
     * are part of this pass. This is what makes a hook-order change visible. */
    if (typeof node.type === 'function') {
      const previous = renderingComponent;
      const previousSequence = activeSequence;
      const sequence = [];
      renderingComponent = node.type;
      activeSequence = sequence;
      try {
        walk(node.type(node.props));
      } finally {
        renderingComponent = previous;
        activeSequence = previousSequence;
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

function renderOnce(renderProps) {
  hookCalls.length = 0;
  hookLogByComponent.clear();
  componentSequences.length = 0;
  let rendered = null;
  let error = null;
  const previous = renderingComponent;
  renderingComponent = sidebarRegistration.component;
  activeSequence = [];
  try {
    rendered = sidebarRegistration.component(renderProps);
  } catch (caught) {
    error = caught;
  } finally {
    renderingComponent = previous;
    activeSequence = null;
  }
  if (rendered !== null) walk(rendered);
  return {
    error,
    sidebarHooks: (hookLogByComponent.get('Sidebar') || []).slice(),
    sequences: componentSequences.map((entry) => ({ name: entry.name, hooks: entry.hooks })),
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

/* ------------------------------------------------------------ summary print */

if (failures.length > 0) {
  console.error('FAILED ' + failures.length + ' of ' + (passed + failures.length) + ' checks:');
  for (const failure of failures) console.error('  x ' + failure);
  process.exitCode = 1;
} else {
  console.log('ok — ' + passed + ' checks passed');
}
