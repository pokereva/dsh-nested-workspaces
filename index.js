/**
 * Host half of the nested-workspaces bundle.
 *
 * Every capability this plugin adds is client-side: child workspaces are ordinary
 * workspaces whose directory sits inside the parent workspace, so the existing
 * workspace controller already persists them. Nothing needs to run in the Host.
 */
export function apply() {}
