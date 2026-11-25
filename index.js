/**
 * dsh-nested-workspaces — Host half.
 *
 * A child workspace is a grouping record in this plugin's own storage, not a
 * directory and not a Workspace registration: DSH binds a Session to a
 * Workspace by exact path equality, so a folder could only ever hold sessions
 * whose cwd already matched it. Keeping the grouping purely in the Client
 * half means nothing is written into the user's project directories, and a
 * session started from a child simply runs in the nearest real ancestor.
 *
 * The Host half therefore has no work to do. It exists so the bundle is a
 * well-formed DSH package.
 */

/** No Host services are needed: the grouping lives in the browser. */
export const inject = []

/** Nothing to install on the Host. */
export function apply() {}
