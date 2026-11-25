# dsh-nested-workspaces

Nested child workspaces for the DeepSeek Harness sidebar.

DeepSeek Harness lists every workspace as a peer. This plugin turns that list
into a tree: a workspace can own child workspace *groups*, sessions can be filed
under any group, and the section title becomes yours to name.

A child is a grouping record kept by this plugin, not a new folder on disk — the
project directory is left exactly as it was.

## What it does

- **Editable section title.** Double-click 「工作区」 (or `Workspaces`) to rename
  it, press `Enter` to keep the name and `Escape` to cancel. `Enter` or `F2` does
  the same from the keyboard. The name is stored in this browser and falls back to
  the built-in label when emptied.
- **Add child workspace.** Right-click a workspace (or use its `…` menu) and pick
  **添加子工作区 / Add child workspace**. The dialog asks for a name and records a
  child group under that workspace. **Nothing is created on disk** — the child is a
  grouping kept in this plugin's own browser storage, so you can split a project
  into sections without littering the repository with empty folders.
- **New sessions run where the code is.** The `+` on a child group starts the
  session in the nearest real workspace above it (the root, or the parent group's
  real workspace), then files the new row under the child. The child never becomes
  a workspace, so DSH's path binding stays consistent.
- **File sessions under any workspace.** Drag a session row onto a workspace
  header, or drop it above/below another session to place it exactly. The `…` menu
  on every session also offers **移动到工作区 / Move to workspace** with one entry
  per workspace — the same change without dragging.
- **Every row keeps its affordances.** Each workspace row, child or not, has the
  same `…` menu (add child, new session, rename, delete) and the same
  new-session button.
- **Reorder workspaces.** Drag a workspace row above or below another row that
  shares its parent: a child moves among its siblings, a root moves among the
  roots, and a drag that would cross the parent boundary is refused so a child
  can never be hoisted out of the workspace it belongs to. A newly created child
  is anchored above its existing siblings instead of below them.
- **Last-used time.** Every session row shows how long ago it was last used
  (`刚刚 / 12分钟 / 3小时 / 2天`, `now / 12min / 3h / 2d`), hover-swapped for the
  row buttons exactly like the shipped browser. The full sentence (`12分钟前`)
  is the tooltip.
- **Pin.** The row's pin button pins the session; pinned rows show a filled pin
  glyph beside the time and sort to the top of their workspace. The session `…`
  menu offers the same toggle as **置顶 / 取消置顶**.
- **Row status, like the shipped browser.** An idle session row draws nothing in
  front of its title. While the session is working it shows the same rotating
  ring the built-in sidebar uses; a pending approval, plan review or question
  shows the amber warning dot, and an unread completion shows the green dot.
- **Nested indent.** A session row sitting inside a child workspace is indented
  by the same 12px step as that child, so sessions line up under their own
  workspace instead of under the root.
- **Workspace rename and delete.** Double-click a workspace title to rename it in
  place; the `…` menu offers the same plus a delete confirmation. Deleting a
  workspace only removes it from the sidebar — the folder and its sessions stay on
  disk and the sessions reappear under *Ungrouped*.
- **Search.** The magnifier filters workspaces and sessions by title or path.
- **Archived sessions.** The archive button in the header reveals them; each
  revealed row carries an unarchive button. Unarchive is otherwise unavailable
  while this plugin owns the sidebar — the shipped browser's own archive view
  is replaced.

## Limits

DSH assigns a session to a workspace by comparing the session's recorded working
directory with the workspace path. A session therefore cannot be re-homed to a
workspace with a different path. Filing a session under another workspace is a
*view* assignment kept by this plugin: the row is shown under the workspace you
dropped it on, and open/fork/archive keep working, but the session's own working
directory is unchanged.

A child workspace is a group, so it has no directory of its own either — the `+`
on a child starts its session in the nearest real workspace above it, and the
session then appears under that child. Deleting a child group deletes the record
and its nested groups; the sessions it showed return to the workspace that really
owns them.

This plugin replaces the shipped workspace browser (it registers the same sidebar
seat at a lower priority, which is the only way to own the section title and the
row list). A few things come with that trade:

- Workspace rows carry this plugin's own menu instead of the shipped one: rename,
  delete, new session and add child workspace all live there. Entries that other
  plugins contribute to the *shipped* workspace context menu are not shown here.
- Session rows carry this plugin's own pin button and resting cell (time + pin
  glyph) instead of the shipped ones, and per-session archiving stays in the
  session's own `…` menu, which is still the shipped menu.
- The shipped browser's child seats
  (`sidebar.workspaces.directoryFlow`, `sidebar.workspaces.session.row.action`,
  `sidebar.session.row.leading`, `sidebar.session.row.trailing`,
  `sidebar.session.row.hover`) are not rendered on these rows, so additions other
  plugins place in them will not appear inside this section. The session `…` menu
  is unaffected and remains the supported extension point.
- **Add child workspace needs no Host support at all.** Earlier versions created
  a real directory, which failed on a Host whose composed directory picker only
  serves the OS chooser (the `native` capability cannot
  `createDirectory`). Children are now records in the browser store, so the
  add-child dialog works everywhere and never touches the filesystem.
- **Upgrading from 1.x.** Children made by 1.x are real folders that were also
  registered with the Host, so they still show up as ordinary workspaces. Delete
  them here (the folder stays on disk) and add them again as groups if you want
  them to become records.

## Using it

Right-click any workspace in the sidebar.

| Action | Where |
| --- | --- |
| Rename the section title | double-click the 「工作区」 label |
| Add a child workspace | workspace `…` menu → 添加子工作区 |
| Reorder workspaces | drag a workspace row above or below a sibling that shares its parent |
| New session in a child | the `+` on the child's row |
| File a session under another workspace | drag the session row, or session `…` menu → 移动到工作区 |
| Rename / delete a workspace | double-click its title, or its `…` menu |
| Pin / unpin a session | the pin button on its row, or session `…` menu → 置顶 |
| See the last-used time | the resting label on its row; hover for the sentence |
| See whether a session is working | the rotating ring in front of its title |
| Show archived sessions | the archive button in the section header |

## Languages

The interface ships Simplified Chinese, English and Japanese. Other Harness
locales fall back to English.

## Install

```sh
dsh plugin add dsh-nested-workspaces
```

Restart `dsh web` after installing.

## License

MIT
