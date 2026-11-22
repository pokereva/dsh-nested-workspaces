window.__ModuleLoader__.load({
  id: 'dsh-nested-workspaces',
  factory(require) {
    'use strict'

    const React = require('react')
    const {
      createElement: h,
      Fragment,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = React
    const { createPortal } = require('react-dom')

    const NS = 'nested-workspaces'
    const STYLE_ID = 'dsh-nested-workspaces/sidebar'
    const STORAGE_KEY = 'dsh.nested-workspaces.v1'
    const INDENT_PX = 12
    const UNGROUPED = ''

    /* ------------------------------------------------------------------ locale */

    const DICT = {
      zh: {
        'heading.default': '工作区',
        'heading.hint': '双击修改标题，清空可恢复默认',
        'menu.addChild': '添加子工作区',
        'actions.addWorkspace': '添加工作区',
        'actions.newSession': '新建会话',
        'actions.search': '搜索工作区或会话',
        'actions.menu': '更多操作',
        'actions.rename': '重命名',
        'actions.delete': '删除工作区',
        'actions.unarchive': '取消归档',
        'actions.create': '创建',
        'actions.cancel': '取消',
        'actions.confirm': '删除',
        'dialog.rename.title': '重命名工作区',
        'dialog.delete.title': '删除工作区',
        'dialog.delete.description': '将把「{name}」从侧边栏移除，磁盘上的文件不会被删除。',
        'renamed': '已重命名',
        'deleted': '已删除工作区',
        'dialog.addChild.title': '添加子工作区',
        'dialog.addWorkspace.title': '添加工作区',
        'dialog.addChild.description': '将在 {parent} 下创建新的子工作区目录。',
        'dialog.addWorkspace.description': '填写工作区目录的绝对路径；留空则打开目录选择器。',
        'field.name': '子工作区名称',
        'field.path': '工作区路径（留空可选择）',
        'errors.nameRequired': '请输入名称。',
        'errors.nameInvalid': '名称不能包含路径分隔符。',
        'errors.exists': '同名目录已存在。',
        'errors.createFailed': '创建失败：{message}',
        'errors.renameFailed': '重命名失败：{message}',
        'errors.deleteFailed': '删除失败：{message}',
        'actions.moveTo': '移动到',
        'actions.showArchived': '显示已归档会话',
        'actions.hideArchived': '隐藏已归档会话',
        'created': '已创建工作区',
        'createdChild': '已创建子工作区',
        'moved': '已移动会话',
        'rail.search': '搜索',
        'expandGroup': '展开分组',
        'collapseGroup': '收起分组',
        'session.new': '新会话',
        'session.untitled': '未命名会话',
        'ungrouped': '未分组',
        'empty': '暂无会话',
        'search.empty': '没有匹配结果',
      },
      en: {
        'heading.default': 'Workspaces',
        'heading.hint': 'Double-click to rename; clear it to restore the default',
        'menu.addChild': 'Add child workspace',
        'actions.addWorkspace': 'Add workspace',
        'actions.newSession': 'New session',
        'actions.search': 'Search workspaces or sessions',
        'actions.menu': 'More actions',
        'actions.rename': 'Rename',
        'actions.delete': 'Delete workspace',
        'actions.unarchive': 'Unarchive',
        'actions.create': 'Create',
        'actions.cancel': 'Cancel',
        'actions.confirm': 'Delete',
        'dialog.rename.title': 'Rename workspace',
        'dialog.delete.title': 'Delete workspace',
        'dialog.delete.description': 'This removes "{name}" from the sidebar. Files on disk are kept.',
        'renamed': 'Renamed',
        'deleted': 'Workspace deleted',
        'dialog.addChild.title': 'Add child workspace',
        'dialog.addWorkspace.title': 'Add workspace',
        'dialog.addChild.description': 'A new child workspace directory will be created under {parent}.',
        'dialog.addWorkspace.description': 'Enter the absolute path of the workspace directory, or leave it empty to pick a folder.',
        'field.name': 'Child workspace name',
        'field.path': 'Workspace path (empty to pick)',
        'errors.nameRequired': 'Enter a name.',
        'errors.nameInvalid': 'The name must not contain path separators.',
        'errors.exists': 'A directory with that name already exists.',
        'errors.createFailed': 'Could not create: {message}',
        'errors.renameFailed': 'Could not rename: {message}',
        'errors.deleteFailed': 'Could not delete: {message}',
        'actions.moveTo': 'Move to',
        'actions.showArchived': 'Show archived sessions',
        'actions.hideArchived': 'Hide archived sessions',
        'created': 'Workspace created',
        'createdChild': 'Child workspace created',
        'moved': 'Session moved',
        'rail.search': 'Search',
        'expandGroup': 'Expand group',
        'collapseGroup': 'Collapse group',
        'session.new': 'New session',
        'session.untitled': 'Untitled session',
        'ungrouped': 'Ungrouped',
        'empty': 'No sessions',
        'search.empty': 'No matches',
      },
      ja: {
        'heading.default': 'ワークスペース',
        'heading.hint': 'ダブルクリックで名前を変更、空欄で既定に戻す',
        'menu.addChild': '子ワークスペースを追加',
        'actions.addWorkspace': 'ワークスペースを追加',
        'actions.newSession': '新しいセッション',
        'actions.search': '検索',
        'actions.menu': 'その他の操作',
        'actions.rename': '名前を変更',
        'actions.delete': 'ワークスペースを削除',
        'actions.unarchive': 'アーカイブ解除',
        'actions.create': '作成',
        'actions.cancel': 'キャンセル',
        'actions.confirm': '削除',
        'dialog.rename.title': 'ワークスペース名を変更',
        'dialog.delete.title': 'ワークスペースを削除',
        'dialog.delete.description': '「{name}」をサイドバーから削除します。ディスク上のファイルは残ります。',
        'renamed': '名前を変更しました',
        'deleted': 'ワークスペースを削除しました',
        'dialog.addChild.title': '子ワークスペースを追加',
        'dialog.addWorkspace.title': 'ワークスペースを追加',
        'dialog.addChild.description': '{parent} の下に子ワークスペースを作成します。',
        'dialog.addWorkspace.description': 'ワークスペースの絶対パスを入力するか、空欄のままフォルダを選択してください。',
        'field.name': '子ワークスペース名',
        'field.path': 'ワークスペースのパス（空欄で選択）',
        'errors.nameRequired': '名前を入力してください。',
        'errors.nameInvalid': '名前にパス区切り文字は使えません。',
        'errors.exists': '同じ名前のディレクトリが既に存在します。',
        'errors.createFailed': '作成できませんでした: {message}',
        'errors.renameFailed': '名前を変更できませんでした: {message}',
        'errors.deleteFailed': '削除できませんでした: {message}',
        'actions.moveTo': '移動先',
        'actions.showArchived': 'アーカイブ済みを表示',
        'actions.hideArchived': 'アーカイブ済みを隠す',
        'created': 'ワークスペースを作成しました',
        'createdChild': '子ワークスペースを作成しました',
        'moved': 'セッションを移動しました',
        'rail.search': '検索',
        'expandGroup': 'グループを開く',
        'collapseGroup': 'グループを閉じる',
        'session.new': '新しいセッション',
        'session.untitled': '無題のセッション',
        'ungrouped': '未分類',
        'empty': 'セッションはありません',
        'search.empty': '一致する項目はありません',
      },
    }

    /* ------------------------------------------------------------------- styles */

    const CSS = `
.dnw-root{display:flex;flex-direction:column;min-height:0;height:100%;color:var(--dsw-alias-label-primary)}
.dnw-header{flex:none;display:flex;align-items:center;gap:4px;height:36px;padding-left:var(--dsh-sidebar-row-padding,12px);box-sizing:border-box;border-radius:var(--dsw-radius-md);overflow:hidden;color:var(--dsw-alias-label-tertiary)}
.dnw-label{position:relative;left:-1px;flex:none;max-width:45%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px;font-size:14px;color:var(--dsw-alias-label-tertiary);user-select:none}
.dnw-labelEditable{cursor:text;border-radius:var(--dsw-radius-xs);padding:0 2px;margin:0 -2px}
.dnw-labelEditable:hover{color:var(--dsw-alias-label-secondary)}
.dnw-headingInput{flex:1;min-width:0;margin:0;padding:0 2px;font:inherit;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);outline:none}
.dnw-headerActions{display:flex;align-items:center;gap:4px;flex:none;margin-left:auto}
.dnw-iconButton{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dnw-iconButton:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dnw-iconButtonOn{background-color:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}
.dnw-rowDragging{opacity:0.5}
.dnw-iconButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dnw-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:8px;scrollbar-width:thin}
.dnw-searchRow{padding:0 8px 4px;padding-left:var(--dsh-sidebar-row-padding,12px)}
.dnw-searchInput{width:100%;box-sizing:border-box;height:32px;padding:0 4px 0 0;font:inherit;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);outline:none}
.dnw-searchInput:focus{border-color:var(--dsw-alias-state-business-primary)}
.dnw-row{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,6px);height:32px;padding:0 8px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) - var(--dsh-sidebar-paint-inset,3px) + var(--dnw-indent,0px));border-inline:var(--dsh-sidebar-paint-inset,3px) solid transparent;background-clip:padding-box;border-radius:var(--dsw-radius-md);cursor:pointer;user-select:none;position:relative;color:var(--dsw-alias-label-primary)}
@media (hover:hover){.dnw-row:hover{background-color:var(--dsw-alias-interactive-bg-hover)}}
.dnw-rowSelected{background-color:var(--dsw-alias-interactive-bg-hover)}
.dnw-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dnw-slot{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.dnw-lead{position:relative}
.dnw-folderIcon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.dnw-folderActive{color:var(--dsw-alias-state-business-primary)}
.dnw-chevron{flex:none;display:none;align-items:center;justify-content:center;width:16px;height:20px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer}
.dnw-workspaceRow:hover .dnw-folderIcon,.dnw-workspaceRow:focus-within .dnw-folderIcon{display:none}
.dnw-workspaceRow:hover .dnw-chevron,.dnw-workspaceRow:focus-within .dnw-chevron,.dnw-workspaceRow:has(.dnw-chevronOpen) .dnw-chevron{display:inline-flex}
.dnw-workspaceRow:has(.dnw-chevronOpen) .dnw-folderIcon{display:none}
@media (hover:none){.dnw-chevron{display:inline-flex}.dnw-folderIcon{display:none}}
.dnw-arrowInner{display:inline-flex;transition:transform 150ms var(--ds-ease-in-out,ease)}
.dnw-chevronOpen .dnw-arrowInner{transform:rotate(90deg)}
.dnw-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.dnw-titleMuted{color:var(--dsw-alias-label-caption)}
.dnw-rowArchived .dnw-title{color:var(--dsw-alias-label-caption)}
.dnw-actions{flex:none;display:none;align-items:center;gap:13px}
.dnw-row:hover .dnw-actions,.dnw-actionsOpen{display:flex}
@media (hover:none){.dnw-actions{display:flex}}
.dnw-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary);flex:none}
.dnw-dotIdle{background:var(--dsw-alias-label-caption);opacity:.5}
.dnw-empty{padding:2px 8px 4px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) + 22px + var(--dnw-indent,0px));font-size:13px;line-height:20px;color:var(--dsw-alias-label-caption)}
.dnw-dropBefore::before,.dnw-dropAfter::after{content:"";position:absolute;left:calc(-1 * var(--dsh-sidebar-paint-inset,3px));right:calc(4px - var(--dsh-sidebar-paint-inset,3px));height:2px;border-radius:1px;background:var(--dsw-alias-state-business-primary)}
.dnw-dropBefore::before{top:-8px}
.dnw-dropAfter::after{bottom:-8px}
.dnw-dropOn{background-color:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}
.dnw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}
.dnw-railButton{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dnw-railButton:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dnw-scrim{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.32)}
.dnw-dialog{width:min(420px,100%);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-elevated,#fff);color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px rgba(0,0,0,.28);font-size:14px;line-height:20px}
.dnw-dialogTitle{font-size:15px;font-weight:600;line-height:22px}
.dnw-dialogText{font-size:13px;line-height:19px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.dnw-dialogInput{width:100%;box-sizing:border-box;height:44px;padding:0 10px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);outline:none}
.dnw-dialogInput:focus{border-color:var(--dsw-alias-state-business-primary)}
.dnw-dialogError{font-size:13px;line-height:19px;color:var(--dsw-alias-state-error-primary,#d33)}
.dnw-dialogFooter{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
.dnw-button{height:32px;padding:0 14px;font:inherit;font-size:13px;line-height:30px;border-radius:var(--dsw-radius-md,8px);border:0.5px solid var(--dsw-alias-border-l4);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}
.dnw-button:hover{background-color:var(--dsw-alias-interactive-bg-hover)}
.dnw-buttonPrimary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:#fff}
.dnw-buttonDanger{background:var(--dsw-alias-state-error-primary,#d33)}
.dnw-button:disabled{opacity:.5;cursor:default}
.dnw-menu{position:fixed;z-index:2147483001;min-width:184px;padding:4px;display:flex;flex-direction:column;gap:1px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-elevated,#fff);box-shadow:0 10px 30px rgba(0,0,0,.22),0 0 0 0.5px var(--dsw-alias-border-l4,rgba(0,0,0,.08));font-size:13px;line-height:18px}
.dnw-menuItem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:var(--dsw-radius-xs);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:start;cursor:pointer}
.dnw-menuItem:hover,.dnw-menuItem:focus-visible,.dnw-menuItemActive{background-color:var(--dsw-alias-interactive-bg-hover);outline:none}
.dnw-menuItemDanger{color:var(--dsw-alias-state-error-primary,#d33)}
.dnw-menuIcon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}
.dnw-menuItemDanger .dnw-menuIcon{color:inherit}
.dnw-menuSeparator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l4,rgba(0,0,0,.08))}
@media (prefers-reduced-motion: reduce){.dnw-arrowInner{transition:none}}
@media (pointer:coarse){.dnw-searchInput,.dnw-headingInput,.dnw-dialogInput{font-size:16px}}
`
    function ensureStyles() {
      const head = typeof document === 'undefined' || document === null ? null : document.head
      if (head === null) return () => {}
      let element = head.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
      if (element === null) {
        element = document.createElement('style')
        element.setAttribute('data-plugin-css', STYLE_ID)
        element.textContent = CSS
        head.appendChild(element)
        return () => {
          element.remove()
        }
      }
      element.textContent = CSS
      return () => {}
    }

    /* -------------------------------------------------------------------- icons */

    const svg = (children, extra) =>
      h(
        'svg',
        Object.assign(
          {
            width: 16,
            height: 16,
            viewBox: '0 0 20 20',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          extra || null,
        ),
        children,
      )

    const IconChevron = () => svg(h('path', { key: 'p', d: 'M8 5l4.5 5L8 15' }))
    const IconFolder = () => svg(h('path', { key: 'p', d: 'M3 6.5A1.5 1.5 0 014.5 5h3l1.6 2h6.4A1.5 1.5 0 0117 8.5v6A1.5 1.5 0 0115.5 16h-11A1.5 1.5 0 013 14.5z' }))
    const IconFolderPlus = () =>
      svg([h('path', { key: 'a', d: 'M3 6.5A1.5 1.5 0 014.5 5h3l1.6 2h6.4A1.5 1.5 0 0117 8.5v6A1.5 1.5 0 0115.5 16h-11A1.5 1.5 0 013 14.5z' }), h('path', { key: 'b', d: 'M10 10.5v3M8.5 12h3' })])
    const IconPlus = () => svg(h('path', { key: 'p', d: 'M10 4.5v11M4.5 10h11' }))
    const IconSearch = () => svg([h('circle', { key: 'c', cx: 9, cy: 9, r: 5 }), h('path', { key: 'p', d: 'M12.8 12.8L16.5 16.5' })])
    const IconDots = () => svg([h('circle', { key: 'a', cx: 5, cy: 10, r: 1.2, fill: 'currentColor', stroke: 'none' }), h('circle', { key: 'b', cx: 10, cy: 10, r: 1.2, fill: 'currentColor', stroke: 'none' }), h('circle', { key: 'c', cx: 15, cy: 10, r: 1.2, fill: 'currentColor', stroke: 'none' })])
    const IconEdit = () => svg([h('path', { key: 'a', d: 'M4 16h3l8.2-8.2a1.6 1.6 0 000-2.3l-.7-.7a1.6 1.6 0 00-2.3 0L4 13z' }), h('path', { key: 'b', d: 'M12.4 6.2l1.4 1.4' })])
    const IconTrash = () => svg([h('path', { key: 'a', d: 'M4.5 6.5h11' }), h('path', { key: 'b', d: 'M8 6.5V4.8h4v1.7' }), h('path', { key: 'c', d: 'M6 6.5l.7 9h6.6l.7-9' })])
    const IconClose = () => svg([h('path', { key: 'p', d: 'M6 6l8 8M14 6l-8 8' })])
    const IconArchive = () =>
      svg([h('path', { key: 'a', d: 'M3.5 5.5h13v3h-13z' }), h('path', { key: 'b', d: 'M4.8 8.5v6.2h10.4V8.5' }), h('path', { key: 'c', d: 'M8 11.2h4' })])
    const IconUnarchive = () =>
      svg([
        h('path', { key: 'a', d: 'M3.5 5.5h13v3h-13z' }),
        h('path', { key: 'b', d: 'M4.8 8.5v6.2h10.4V8.5' }),
        h('path', { key: 'c', d: 'M10 13.4V9.9M8.4 11.5L10 9.9l1.6 1.6' }),
      ])

    /* ---------------------------------------------------------------- utilities */

    const cls = (...parts) => parts.filter(Boolean).join(' ')

    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    function folderPath(path) {
      const windows = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\')
      const normalized = windows ? path.replaceAll('\\', '/') : path
      return normalized.replace(/\/+$/, '')
    }

    /** Longest registered ancestor directory of `path`, returned in its original form. */
    function owningParentPath(path, roots) {
      const child = folderPath(path)
      let best = null
      let bestLength = -1
      for (const root of roots) {
        if (root === path) continue
        const parent = folderPath(root)
        if (parent === '' || child === parent) continue
        if (!child.startsWith(parent + '/')) continue
        if (parent.length > bestLength) {
          best = root
          bestLength = parent.length
        }
      }
      return best
    }

    function createSignal(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          if (Object.is(next, value)) return
          value = next
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      }
    }

    function createStore() {
      const read = () => {
        const empty = { title: null, assign: {}, order: {}, collapsed: {} }
        if (typeof localStorage === 'undefined') return empty
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw === null || raw === '') return empty
          const parsed = JSON.parse(raw)
          if (!isRecord(parsed)) return empty
          return {
            title: typeof parsed.title === 'string' && parsed.title.trim() !== '' ? parsed.title : null,
            assign: isRecord(parsed.assign) ? parsed.assign : {},
            order: isRecord(parsed.order) ? parsed.order : {},
            collapsed: isRecord(parsed.collapsed) ? parsed.collapsed : {},
          }
        } catch {
          return empty
        }
      }
      let state = read()
      const listeners = new Set()
      const write = () => {
        if (typeof localStorage === 'undefined') return
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } catch {
          /* storage full or blocked: the view still works for this tab */
        }
      }
      return {
        get: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        update(recipe) {
          state = recipe(state)
          write()
          for (const listener of listeners) listener()
        },
      }
    }

    /**
     * Re-home one session inside the plugin's own grouping.  The workspace
     * controller refuses to move a session into a workspace whose path is not
     * the session's recorded cwd, so this is a display assignment: the row is
     * rendered under `groupKey` while its cwd stays untouched.
     */
    function assignSessionIn(store, items, sessionId, groupKey, beforeSessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      store.update(current => {
        const known = new Set()
        let realOwner = null
        for (const item of items) {
          known.add(item.workspaceId)
          if (realOwner === null && item.sessionIds.includes(sessionId)) realOwner = item.workspaceId
        }
        const assigned = current.assign[sessionId]
        const previousKey =
          typeof assigned === 'string' && known.has(assigned)
            ? assigned
            : realOwner === null
              ? UNGROUPED
              : realOwner

        const assign = { ...current.assign }
        if (groupKey === UNGROUPED || groupKey === realOwner) delete assign[sessionId]
        else assign[sessionId] = groupKey

        const order = { ...current.order }
        const previous = Array.isArray(order[previousKey]) ? order[previousKey] : null
        if (previous !== null) order[previousKey] = previous.filter(id => id !== sessionId)
        const target = Array.isArray(order[groupKey]) ? order[groupKey].slice() : []
        const without = target.filter(id => id !== sessionId)
        const at = beforeSessionId === undefined ? -1 : without.indexOf(beforeSessionId)
        if (at >= 0) without.splice(at, 0, sessionId)
        else without.push(sessionId)
        order[groupKey] = without
        return { ...current, assign, order }
      })
    }

    return {
      inject: ['slots', 'locale', 'contextMenus', 'workspaces', 'uiWorkspace', 'sessions'],
      apply(ctx) {
        const store = createStore()
        const addChildRequest = createSignal(null)

        ctx.effect(ensureStyles, 'dsh-nested-workspaces: styles')

        try {
          ctx.locale.register(NS, DICT)
        } catch {
          /* hot reload: this namespace is already installed for this build */
        }

        const t = ctx.locale.bind(NS)
        const workspaces = ctx.get('workspaces')
        const uiWorkspace = ctx.get('uiWorkspace')
        const sessions = ctx.get('sessions')
        const contextMenus = ctx.get('contextMenus')

        const notify = (text, success) => {
          try {
            contextMenus.notify(text, success)
          } catch {
            /* no toast surface: the dialog already reported the outcome inline */
          }
        }

        const headingText = () => {
          const custom = store.get().title
          return custom === null ? t('heading.default') : custom
        }

        /* ------------------------------------------------------- context menus */

        ctx.effect(
          () =>
            ctx.contextMenus.register({
              id: 'workspace.addChild',
              target: 'workspace',
              order: 150,
              observe: () => [ctx.workspaces.list, ctx.locale],
              resolve: target => [
                {
                  id: 'addChild',
                  label: ctx.locale.bind(NS)('menu.addChild'),
                  icon: { key: 'workspace.addChild' },
                  run: () => {
                    addChildRequest.set({
                      parentId: target.workspaceId,
                      parentPath: target.path,
                      parentTitle: target.displayTitle,
                    })
                  },
                },
              ],
            }),
          'dsh-nested-workspaces: add-child menu',
        )

        ctx.effect(
          () =>
            ctx.slots.inject('contextMenu.icon', () =>
              ctx.slots.register({ name: 'contextMenu.icon', key: 'workspace.addChild' }, IconFolderPlus),
            ),
          'dsh-nested-workspaces: add-child icon',
        )

        /*
         * The non-drag half of "manage sessions inside a child workspace": every
         * session menu gains a Move to submenu listing the workspaces this build
         * can see, plus the ungrouped bucket.  It writes the same display
         * assignment a drop writes, so both routes land in one place.
         */
        ctx.effect(
          () =>
            ctx.contextMenus.register({
              id: 'session.nestedMoveTo',
              target: 'session',
              order: 500,
              observe: () => [ctx.workspaces.list, ctx.locale],
              resolve: target => {
                const items = ctx.workspaces.list.getSnapshot().items
                const sessionId = target.sessionId
                const children = items.map(item => ({
                  id: 'move:' + item.workspaceId,
                  label: item.title || item.path,
                  run: () => {
                    assignSessionIn(store, items, sessionId, item.workspaceId, undefined)
                    notify(ctx.locale.bind(NS)('moved'), true)
                  },
                }))
                children.push({
                  id: 'move:ungrouped',
                  label: ctx.locale.bind(NS)('ungrouped'),
                  separatorBefore: true,
                  run: () => {
                    assignSessionIn(store, items, sessionId, UNGROUPED, undefined)
                    notify(ctx.locale.bind(NS)('moved'), true)
                  },
                })
                return [
                  {
                    id: 'moveTo',
                    label: ctx.locale.bind(NS)('actions.moveTo'),
                    children,
                  },
                ]
              },
            }),
          'dsh-nested-workspaces: move-to menu',
        )

        /* --------------------------------------------------------------- dialog */

        function NewWorkspaceDialog(props) {
          const request = props.request
          const isChild = typeof request.parentPath === 'string'
          const [value, setValue] = useState(isChild ? '' : '')
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const inputRef = useRef(null)
          const commitRef = useRef(null)

          useEffect(() => {
            const element = inputRef.current
            if (element !== null) {
              element.focus()
              if (!isChild && value !== '') element.select()
            }
          }, [isChild])

          useEffect(() => {
            const onKeyDown = event => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                props.onClose()
              }
            }
            document.addEventListener('keydown', onKeyDown, true)
            return () => document.removeEventListener('keydown', onKeyDown, true)
          }, [props.onClose])

          const describe = failure => {
            const code = failure !== null && typeof failure === 'object' && typeof failure.code === 'string' ? failure.code : ''
            const message = failure && failure.message ? String(failure.message) : String(failure)
            if (code === 'directory-picker/exists' || message.includes('directory-exists') || message.includes('already exists')) {
              return t('errors.exists')
            }
            return t('errors.createFailed', { message })
          }

          const submit = async () => {
            if (busy) return
            const trimmed = value.trim()
            if (trimmed === '' && isChild) {
              setError(t('errors.nameRequired'))
              return
            }
            if (isChild && /[\\/]/.test(trimmed)) {
              setError(t('errors.nameInvalid'))
              return
            }
            setBusy(true)
            setError(null)
            try {
              let path = trimmed
              if (isChild) {
                path = await uiWorkspace.createDirectory(request.parentPath, trimmed)
              } else if (path === '') {
                /* No typed path: ask the host's directory picker, which is the
                 * same flow the shipped picker uses. */
                const picked = await uiWorkspace.pickDirectory()
                setBusy(false)
                if (picked === null || picked === undefined || picked === '') return
                path = picked
                setValue(picked)
                setBusy(true)
              }
              await workspaces.create({ path })
              if (isChild) {
                store.update(state => ({
                  ...state,
                  collapsed: { ...state.collapsed, [request.parentId]: false },
                }))
                notify(t('createdChild'), true)
              } else {
                notify(t('created'), true)
              }
              props.onClose()
            } catch (failure) {
              setError(describe(failure))
            } finally {
              setBusy(false)
            }
          }
          commitRef.current = submit

          return h(
            DialogShell,
            {
              title: isChild ? t('dialog.addChild.title') : t('dialog.addWorkspace.title'),
              description: isChild
                ? t('dialog.addChild.description', { parent: request.parentPath })
                : t('dialog.addWorkspace.description'),
              error,
              busy,
              confirmLabel: t('actions.create'),
              onCancel: () => {
                if (!busy) props.onClose()
              },
              onConfirm: submit,
              confirmDisabled: isChild && value.trim() === '',
            },
            h('input', {
              ref: inputRef,
              className: 'dnw-dialogInput',
              value,
              spellCheck: false,
              autoComplete: 'off',
              'aria-label': isChild ? t('field.name') : t('field.path'),
              placeholder: isChild ? t('field.name') : t('field.path'),
              onChange: event => setValue(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              },
            }),
          )
        }

        /* ----------------------------------------------------------- popover menu */

        /**
         * A small anchored menu. The shipped workspace menu rows raise their
         * dialog from inside the browsing region this plugin now owns, so the
         * workspace row carries its own menu instead of borrowing that one.
         */
        function MenuPopover(props) {
          const { anchor, items, onClose } = props
          const [index, setIndex] = useState(0)
          const popoverRef = useRef(null)
          const itemRefs = useRef([])
          const restoreRef = useRef(null)

          /** First enabled item at or after `from`, wrapping once. */
          const seek = from => {
            for (let step = 0; step < items.length; step += 1) {
              const at = (from + step + items.length) % items.length
              if (items[at] !== undefined && items[at].disabled !== true) return at
            }
            return -1
          }

          useEffect(() => {
            const onPointerDown = event => {
              const element = popoverRef.current
              if (element !== null && element.contains(event.target)) return
              onClose()
            }
            const onKeyDown = event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                onClose()
                return
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                if (items.length === 0) return
                const first = seek(0)
                if (first < 0) return
                if (event.key === 'Home') setIndex(first)
                else if (event.key === 'End') setIndex(seek(Math.max(0, items.length - 1) < 0 ? 0 : items.length - 1))
                else {
                  const step = event.key === 'ArrowDown' ? 1 : -1
                  setIndex(current => {
                    const next = seek(current + step)
                    return next < 0 ? current : next
                  })
                }
                return
              }
              if (event.key === 'Enter' || event.key === ' ') {
                const active = document.activeElement
                const position = itemRefs.current.findIndex(node => node === active)
                const chosen = position >= 0 ? items[position] : items[index]
                if (chosen === undefined || chosen.disabled === true) return
                event.preventDefault()
                onClose()
                void chosen.onSelect()
              }
            }
            document.addEventListener('mousedown', onPointerDown, true)
            document.addEventListener('keydown', onKeyDown, true)
            window.addEventListener('resize', onClose)
            return () => {
              document.removeEventListener('mousedown', onPointerDown, true)
              document.removeEventListener('keydown', onKeyDown, true)
              window.removeEventListener('resize', onClose)
            }
          }, [items, index, onClose])

          /* Focus the active row, and give focus back to whatever opened the
           * menu when it closes, so keyboard users are never stranded. */
          useEffect(() => {
            restoreRef.current = document.activeElement
            const initial = seek(0)
            if (initial >= 0) setIndex(initial)
            return () => {
              const previous = restoreRef.current
              if (previous !== null && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
            }
          }, [])

          useEffect(() => {
            const node = itemRefs.current[index]
            if (node !== undefined && node !== null) node.focus()
          }, [index])

          const portalTarget = typeof document === 'undefined' ? null : document.body
          if (portalTarget === null) return null

          const style = {
            top: Math.round(anchor.bottom + 4) + 'px',
            left: Math.round(Math.max(8, Math.min(anchor.left, (window.innerWidth || 0) - 200))) + 'px',
          }

          return createPortal(
            h(
              'div',
              {
                ref: popoverRef,
                className: 'dnw-menu',
                role: 'menu',
                tabIndex: -1,
                style,
                onContextMenu: event => event.preventDefault(),
              },
              items.map((item, position) =>
                h(
                  Fragment,
                  { key: item.id },
                  item.separatorBefore === true && position > 0 ? h('div', { className: 'dnw-menuSeparator', role: 'separator' }) : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'menuitem',
                      ref: node => {
                        itemRefs.current[position] = node
                      },
                      tabIndex: position === index ? 0 : -1,
                      className: cls('dnw-menuItem', item.danger === true && 'dnw-menuItemDanger', position === index && 'dnw-menuItemActive'),
                      disabled: item.disabled === true,
                      onMouseEnter: () => setIndex(position),
                      onFocus: () => setIndex(position),
                      onClick: () => {
                        onClose()
                        void item.onSelect()
                      },
                    },
                    item.icon === undefined ? null : h('span', { className: 'dnw-menuIcon' }, h(item.icon, null)),
                    h('span', { className: 'dnw-menuLabel' }, item.label),
                  ),
                ),
              ),
            ),
            portalTarget,
          )
        }

        /* ------------------------------------------------------------ dialogs */

        /** Shared modal shell: scrim, Escape, focus trap entry, footer buttons. */
        function DialogShell(props) {
          const { title, description, children, error, busy, confirmLabel, danger, onCancel, onConfirm, confirmDisabled } = props
          const dialogRef = useRef(null)
          const restoreRef = useRef(null)

          useEffect(() => {
            const onKeyDown = event => {
              const element = dialogRef.current
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                if (!busy) onCancel()
                return
              }
              /* Keep Tab inside the dialog: the scrim covers the page, so
               * focus must not be able to walk out behind it. */
              if (event.key !== 'Tab' || element === null) return
              const focusable = element.querySelectorAll(
                'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
              )
              if (focusable.length === 0) return
              const first = focusable[0]
              const last = focusable[focusable.length - 1]
              const active = document.activeElement
              if (event.shiftKey && (active === first || !element.contains(active))) {
                event.preventDefault()
                last.focus()
              } else if (!event.shiftKey && (active === last || !element.contains(active))) {
                event.preventDefault()
                first.focus()
              }
            }
            document.addEventListener('keydown', onKeyDown, true)
            return () => document.removeEventListener('keydown', onKeyDown, true)
          }, [busy, onCancel])

          useEffect(() => {
            restoreRef.current = document.activeElement
            return () => {
              const previous = restoreRef.current
              if (previous !== null && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
            }
          }, [])

          const portalTarget = typeof document === 'undefined' ? null : document.body
          if (portalTarget === null) return null

          return createPortal(
            h(
              'div',
              {
                className: 'dnw-scrim',
                onMouseDown: event => {
                  if (event.target === event.currentTarget && !busy) onCancel()
                },
              },
              h(
                'div',
                {
                  ref: dialogRef,
                  className: 'dnw-dialog',
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-label': title,
                },
                h('div', { className: 'dnw-dialogTitle' }, title),
                description === null ? null : h('div', { className: 'dnw-dialogText' }, description),
                children,
                error === null ? null : h('div', { className: 'dnw-dialogError', role: 'alert' }, error),
                h(
                  'div',
                  { className: 'dnw-dialogFooter' },
                  h(
                    'button',
                    { type: 'button', className: 'dnw-button', disabled: busy, onClick: onCancel },
                    t('actions.cancel'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: cls('dnw-button', 'dnw-buttonPrimary', danger === true && 'dnw-buttonDanger'),
                      disabled: busy || confirmDisabled === true,
                      onClick: onConfirm,
                    },
                    confirmLabel,
                  ),
                ),
              ),
            ),
            portalTarget,
          )
        }

        /** Inline rename for one Workspace, mirroring the shipped dialog's guards. */
        function WorkspaceRenameDialog(props) {
          const { workspace, onClose } = props
          const [value, setValue] = useState(workspace.title)
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const inputRef = useRef(null)
          const trimmed = value.trim()

          useEffect(() => {
            const element = inputRef.current
            if (element !== null) {
              element.focus()
              element.select()
            }
          }, [])

          const submit = async () => {
            if (busy || trimmed === '' || trimmed === workspace.title) return
            setBusy(true)
            setError(null)
            try {
              await workspaces.rename(workspace.workspaceId, trimmed)
              notify(t('renamed'), true)
              onClose()
            } catch (failure) {
              setError(t('errors.renameFailed', { message: failure && failure.message ? String(failure.message) : String(failure) }))
            } finally {
              setBusy(false)
            }
          }

          return h(
            DialogShell,
            {
              title: t('dialog.rename.title'),
              description: null,
              error,
              busy,
              confirmLabel: t('actions.rename'),
              onCancel: () => {
                if (!busy) onClose()
              },
              onConfirm: submit,
              confirmDisabled: trimmed === '' || trimmed === workspace.title,
            },
            h('input', {
              ref: inputRef,
              className: 'dnw-dialogInput',
              value,
              spellCheck: false,
              autoComplete: 'off',
              'aria-label': t('dialog.rename.title'),
              onChange: event => setValue(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                }
              },
            }),
          )
        }

        /** Remove one Workspace from the list; the directory on disk is untouched. */
        function WorkspaceDeleteDialog(props) {
          const { workspace, onClose } = props
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)

          const submit = async () => {
            if (busy) return
            setBusy(true)
            setError(null)
            try {
              await workspaces.delete(workspace.workspaceId)
              notify(t('deleted'), true)
              onClose()
            } catch (failure) {
              setError(t('errors.deleteFailed', { message: failure && failure.message ? String(failure.message) : String(failure) }))
            } finally {
              setBusy(false)
            }
          }

          return h(DialogShell, {
            title: t('dialog.delete.title'),
            description: t('dialog.delete.description', { name: workspace.title }),
            error,
            busy,
            danger: true,
            confirmLabel: t('actions.confirm'),
            onCancel: () => {
              if (!busy) onClose()
            },
            onConfirm: submit,
          })
        }

        /* ------------------------------------------------------------- sidebar */

        function Sidebar(props) {
          const { wide, expandSidebar, renderFactorySlot, useSessions, useWorkspaces, useSessionStatus, useSectionScroller } = props
          const useWorkspaceAccess = typeof props.useWorkspaceAccess === 'function' ? props.useWorkspaceAccess : () => true
          const useSessionAccess = typeof props.useSessionAccess === 'function' ? props.useSessionAccess : () => true
          const state = useSyncExternalStore(store.subscribe, store.get, store.get)
          const request = useSyncExternalStore(addChildRequest.subscribe, addChildRequest.get, addChildRequest.get)
          const list = useSessions(snapshot => snapshot)
          const workspaceSnapshot = useWorkspaces(snapshot => snapshot)
          const statuses = useSessionStatus(snapshot => snapshot)

          const scroller = typeof useSectionScroller === 'function' ? useSectionScroller() : null
          const bindScrollerRef = scroller === null ? undefined : scroller.bindScrollerRef

          const [editingTitle, setEditingTitle] = useState(false)
          const [draftTitle, setDraftTitle] = useState('')
          const [searchOpen, setSearchOpen] = useState(false)
          const [query, setQuery] = useState('')
          const [draggingId, setDraggingId] = useState(null)
          const [dropTarget, setDropTarget] = useState(null)
          const [menu, setMenu] = useState(null)
          const [renaming, setRenaming] = useState(null)
          const [deleting, setDeleting] = useState(null)
          const [showArchived, setShowArchived] = useState(false)
          const dragIdRef = useRef(null)
          const titleInputRef = useRef(null)
          const cancelTitleRef = useRef(false)
          const closeMenu = useCallback(() => setMenu(null), [])

          useEffect(() => {
            if (editingTitle && titleInputRef.current !== null) {
              titleInputRef.current.focus()
              titleInputRef.current.select()
            }
          }, [editingTitle])

          const items = workspaceSnapshot.items
          const view = useMemo(() => {
            const byId = new Map(items.map(item => [item.workspaceId, item]))
            const byPath = new Map(items.map(item => [item.path, item.workspaceId]))
            const paths = items.map(item => item.path)
            const parentOf = new Map()
            for (const item of items) {
              const parentPath = owningParentPath(item.path, paths)
              if (parentPath === null) continue
              const parentId = byPath.get(parentPath)
              if (parentId !== undefined) parentOf.set(item.workspaceId, parentId)
            }
            const childrenOf = new Map()
            const roots = []
            for (const item of items) {
              const parentId = parentOf.get(item.workspaceId)
              if (parentId === undefined) {
                roots.push(item)
                continue
              }
              const bucket = childrenOf.get(parentId)
              if (bucket === undefined) childrenOf.set(parentId, [item])
              else bucket.push(item)
            }

            const archived = new Set(workspaceSnapshot.archivedSessionIds)
            const realOwner = new Map()
            for (const item of items) for (const id of item.sessionIds) realOwner.set(id, item.workspaceId)
            const currentId = list.ids.find(id => ((list.byId[id] && list.byId[id].retainedBy.mainView) || 0) > 0) || null

            const ownerOf = id => {
              const assigned = state.assign[id]
              if (typeof assigned === 'string' && byId.has(assigned)) return assigned
              const real = realOwner.get(id)
              return real === undefined ? UNGROUPED : real
            }

            const members = new Map()
            members.set(UNGROUPED, [])
            for (const item of items) members.set(item.workspaceId, [])

            const needle = query.trim().toLowerCase()
            const matches = text => needle === '' || String(text || '').toLowerCase().includes(needle)
            const workspaceMatches = new Map()
            for (const item of items) workspaceMatches.set(item.workspaceId, matches(item.title) || matches(item.path))

            for (const id of list.ids) {
              const session = list.byId[id]
              if (session === undefined) continue
              if (session.origin === 'subagent') continue
              if (session.blank && id !== currentId) continue
              const isArchived = archived.has(id)
              if (isArchived && !showArchived) continue
              const key = ownerOf(id)
              const bucket = members.get(key)
              if (bucket === undefined) continue
              const title = sessionTitle(session)
              if (needle !== '' && !matches(title) && !workspaceMatches.get(key)) continue
              bucket.push(session)
            }

            for (const [key, bucket] of members) {
              const saved = state.order[key]
              if (!Array.isArray(saved) || saved.length === 0) {
                bucket.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
                continue
              }
              const rank = new Map()
              for (let index = 0; index < saved.length; index += 1) rank.set(saved[index], index)
              const known = []
              const rest = []
              for (const session of bucket) {
                if (rank.has(session.id)) known.push(session)
                else rest.push(session)
              }
              known.sort((a, b) => rank.get(a.id) - rank.get(b.id))
              rest.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
              members.set(key, known.concat(rest))
            }

            const filtering = needle !== ''
            let visibleCount = 0
            for (const bucket of members.values()) visibleCount += bucket.length

            return { byId, parentOf, childrenOf, roots, members, currentId, ownerOf, realOwner, archived, filtering, visibleCount }
          }, [items, list, state.order, state.assign, workspaceSnapshot.archivedSessionIds, query, showArchived])

          const setExpanded = useCallback((workspaceId, expanded) => {
            store.update(current => ({
              ...current,
              collapsed: { ...current.collapsed, [workspaceId]: !expanded },
            }))
          }, [])

          const assignSession = useCallback(
            (sessionId, groupKey, beforeSessionId) => {
              if (typeof sessionId !== 'string' || sessionId === '') return
              store.update(current => {
                const realOwner = view.realOwner.get(sessionId)
                const previousKey = view.ownerOf(sessionId)
                const assign = { ...current.assign }
                if (groupKey === UNGROUPED || groupKey === realOwner) delete assign[sessionId]
                else assign[sessionId] = groupKey

                const order = { ...current.order }
                const previous = Array.isArray(order[previousKey]) ? order[previousKey] : null
                if (previous !== null) order[previousKey] = previous.filter(id => id !== sessionId)
                const target = Array.isArray(order[groupKey]) ? order[groupKey].slice() : []
                const without = target.filter(id => id !== sessionId)
                const at = beforeSessionId === undefined ? -1 : without.indexOf(beforeSessionId)
                if (at >= 0) without.splice(at, 0, sessionId)
                else without.push(sessionId)
                order[groupKey] = without
                return { ...current, assign, order }
              })
            },
            [view],
          )

          const openMenu = (target, label) => {
            if (typeof renderFactorySlot !== 'function') return null
            const node = renderFactorySlot('contextMenu.button', { target, label, className: 'dnw-iconButton' })
            if (node !== null && node !== undefined) return node
            return h('button', { type: 'button', className: 'dnw-iconButton', 'aria-label': label, title: label, onClick: event => event.stopPropagation() }, h(IconDots, null))
          }

          const openWorkspaceMenu = (event, workspace) => {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            const atPointer = event.type === 'contextmenu' && (event.clientX !== 0 || event.clientY !== 0)
            setMenu({
              workspaceId: workspace.workspaceId,
              anchor: atPointer
                ? { top: event.clientY, bottom: event.clientY, left: event.clientX }
                : { top: rect.top, bottom: rect.bottom, left: rect.left },
            })
          }

          const menuWorkspace =
            menu === null ? null : items.find(item => item.workspaceId === menu.workspaceId) || null

          const menuItems =
            menuWorkspace === null
              ? []
              : [
                  {
                    id: 'addChild',
                    label: t('menu.addChild'),
                    icon: IconFolderPlus,
                    onSelect: () =>
                      addChildRequest.set({
                        parentId: menuWorkspace.workspaceId,
                        parentPath: menuWorkspace.path,
                        parentTitle: menuWorkspace.title,
                      }),
                  },
                  {
                    id: 'newSession',
                    label: t('actions.newSession'),
                    icon: IconPlus,
                    onSelect: () => uiWorkspace.startSession(menuWorkspace.workspaceId),
                  },
                  {
                    id: 'rename',
                    label: t('actions.rename'),
                    icon: IconEdit,
                    separatorBefore: true,
                    onSelect: () => setRenaming(menuWorkspace),
                  },
                  {
                    id: 'delete',
                    label: t('actions.delete'),
                    icon: IconTrash,
                    danger: true,
                    onSelect: () => setDeleting(menuWorkspace),
                  },
                ]

          const commitTitle = () => {
            /* Escape sets the cancel flag first; the input then unmounts and its
             * onBlur fires, which must not turn the abandoned draft into a save. */
            if (cancelTitleRef.current) {
              cancelTitleRef.current = false
              setEditingTitle(false)
              return
            }
            const next = draftTitle.trim()
            store.update(current => ({ ...current, title: next === '' ? null : next }))
            setEditingTitle(false)
          }

          const heading = state.title === null ? t('heading.default') : state.title

          if (!wide) {
            return h(
              'div',
              { className: 'dnw-root dnw-rail' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dnw-railButton',
                  title: t('rail.search'),
                  'aria-label': t('rail.search'),
                  onClick: () => {
                    setSearchOpen(true)
                    expandSidebar()
                  },
                },
                h(IconSearch, null),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dnw-railButton',
                  title: t('actions.addWorkspace'),
                  'aria-label': t('actions.addWorkspace'),
                  onClick: () => addChildRequest.set({ parentId: null, parentPath: null, parentTitle: null }),
                },
                h(IconFolderPlus, null),
              ),
            )
          }

        /* --------------------------------------------------------- row components
         *
         * These are components rather than render helpers on purpose: each one calls
         * React hooks (useSessionAccess / useWorkspaceAccess), so it must own a stable
         * hook list. Calling them from Sidebar's body made the hook count depend on
         * collapse state and filters, which breaks the rules of hooks and blanks the
         * whole sidebar entry. Shared closures arrive in `env`, built once per render.
         */
        function SessionRow(props) {
          const { session, groupKey, index, bucket, env } = props
          const { view, statuses, t, uiWorkspace, useSessionAccess, openMenu, assignSession, dragIdRef, draggingId, dropTarget, setDropTarget, setDraggingId } = env
          const isArchived = view.archived.has(session.id)
          const label = session.blank ? (session.id === view.currentId ? t('session.new') : t('session.untitled')) : sessionTitle(session)
          const title = label === '' ? t('session.untitled') : label
          const status = statuses.get(session.id)
          const running = status !== undefined && status.running === true
          const selected = session.id === view.currentId
          const canUnarchive = useSessionAccess(session.id, 'workspace/unarchiveSession')
          const canMove = useSessionAccess(session.id, 'workspace/insertSessionBefore')
          const canDrag = !session.blank && !isArchived && canMove
          const rowDropPosition = dropTarget !== null && dropTarget.sessionId === session.id ? dropTarget.position : null
          const actions = []
          if (!session.blank && !isArchived) {
            actions.push(
              openMenu(
                { kind: 'session', value: { sessionId: session.id, displayTitle: title } },
                t('actions.menu') + ' ' + title,
              ),
            )
          }
          if (isArchived && canUnarchive) {
            actions.push(
              h(
                'button',
                {
                  type: 'button',
                  key: 'unarchive',
                  className: 'dnw-iconButton',
                  title: t('actions.unarchive'),
                  'aria-label': t('actions.unarchive') + ' ' + title,
                  onClick: event => {
                    event.stopPropagation()
                    uiWorkspace.unarchiveSession(session.id)
                  },
                },
                h(IconUnarchive, null),
              ),
            )
          }
          const activate = () => {
            if (isArchived) return
            uiWorkspace.openSession(session.id)
          }
          /* The next sibling in this bucket is the insertion anchor for an
           * "after" drop. It skips the row being dragged, otherwise dropping a
           * row right below the one above it would move it to the group end. */
          const dropAfter = (() => {
            if (!Array.isArray(bucket) || typeof index !== 'number') return undefined
            for (let cursor = index + 1; cursor < bucket.length; cursor += 1) {
              if (bucket[cursor].id !== draggingId) return bucket[cursor].id
            }
            return undefined
          })()
          return h(
            'div',
            {
              key: 's:' + session.id,
              className: cls(
                'dnw-row',
                'dnw-sessionRow',
                selected && 'dnw-rowSelected',
                isArchived && 'dnw-rowArchived',
                rowDropPosition === 'before' && 'dnw-dropBefore',
                rowDropPosition === 'after' && 'dnw-dropAfter',
                draggingId === session.id && 'dnw-rowDragging',
              ),
              role: 'treeitem',
              tabIndex: 0,
              'aria-selected': selected,
              'data-row-key': 'nested-session:' + session.id,
              draggable: canDrag,
              onKeyDown: event => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                activate()
              },
              onDragStart: event => {
                dragIdRef.current = session.id
                setDraggingId(session.id)
                try {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', session.id)
                } catch {
                  /* some browsers block custom payloads; the ref carries the id */
                }
              },
              onDragEnd: () => {
                dragIdRef.current = null
                setDraggingId(null)
                setDropTarget(null)
              },
              onDragOver: event => {
                const dragging = dragIdRef.current
                if (dragging === null || dragging === session.id) return
                event.preventDefault()
                event.stopPropagation()
                try {
                  event.dataTransfer.dropEffect = 'move'
                } catch {
                  /* ignore */
                }
                const box = event.currentTarget.getBoundingClientRect()
                const position = event.clientY < box.top + box.height / 2 ? 'before' : 'after'
                if (rowDropPosition !== position) setDropTarget({ workspaceId: groupKey, sessionId: session.id, position })
              },
              onDragLeave: event => {
                if (event.currentTarget.contains(event.relatedTarget)) return
                if (rowDropPosition !== null) setDropTarget(null)
              },
              onDrop: event => {
                const id = dragIdRef.current || event.dataTransfer.getData('text/plain')
                if (!id || id === session.id) return
                event.preventDefault()
                event.stopPropagation()
                const box = event.currentTarget.getBoundingClientRect()
                const after = event.clientY >= box.top + box.height / 2
                setDropTarget(null)
                dragIdRef.current = null
                setDraggingId(null)
                assignSession(id, groupKey, after ? dropAfter : session.id)
              },
              onClick: activate,
              onDoubleClick: activate,
            },
            h(
              'span',
              { className: 'dnw-slot' },
              running ? h('span', { className: 'dnw-dot' }) : h('span', { className: cls('dnw-dot', 'dnw-dotIdle') }),
            ),
            h('span', { className: cls('dnw-title', (session.blank || isArchived) && 'dnw-titleMuted') }, title),
            actions.length === 0 ? null : h('span', { className: 'dnw-actions' }, ...actions),
          )
        }

        function WorkspaceGroup(props) {
          const { workspace, depth, env } = props
          const { view, state, t, uiWorkspace, useWorkspaceAccess, openMenu, openWorkspaceMenu, assignSession, setExpanded, setRenaming, menu, dragIdRef, draggingId, dropTarget, setDropTarget, setDraggingId } = env
          const workspaceId = workspace.workspaceId
          const collapsed = state.collapsed[workspaceId] === true
          const members = view.members.get(workspaceId) || []
          const children = view.childrenOf.get(workspaceId) || []
          const hasSessions = members.length > 0
          const visible = !collapsed || view.filtering
          /* Only a header-level hover highlights the group; a hover over one
           * of its session rows carries a sessionId and must not repaint it. */
          const isDropTarget =
            dropTarget !== null && dropTarget.workspaceId === workspaceId && dropTarget.sessionId === undefined
          const indent = { '--dnw-indent': depth * INDENT_PX + 'px' }
          const canCreateSession = useWorkspaceAccess(workspaceId, 'session/create')
          const collapsible = children.length > 0 || hasSessions
          const row = h(
            'div',
            {
              key: 'w:' + workspaceId,
              className: cls('dnw-row', 'dnw-workspaceRow', isDropTarget && 'dnw-dropOn'),
              role: 'treeitem',
              tabIndex: 0,
              'aria-expanded': !collapsed,
              'aria-label': workspace.title + ' — ' + workspace.path,
              style: indent,
              onClick: () => setExpanded(workspaceId, collapsed),
              onKeyDown: event => {
                if (event.target !== event.currentTarget) return
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                setExpanded(workspaceId, collapsed)
              },
              onContextMenu: event => openWorkspaceMenu(event, workspace),
              onDragOver: event => {
                if (dragIdRef.current === null) return
                event.preventDefault()
                event.stopPropagation()
                try {
                  event.dataTransfer.dropEffect = 'move'
                } catch {
                  /* ignore */
                }
                if (!isDropTarget) setDropTarget({ workspaceId, mode: 'into' })
              },
              onDragLeave: () => {
                if (isDropTarget) setDropTarget(null)
              },
              onDrop: event => {
                const id = dragIdRef.current || event.dataTransfer.getData('text/plain')
                event.preventDefault()
                event.stopPropagation()
                setDropTarget(null)
                setDraggingId(null)
                dragIdRef.current = null
                if (id) assignSession(id, workspaceId, undefined)
              },
            },
            h(
              'span',
              { className: 'dnw-slot dnw-lead' },
              h(
                'button',
                {
                  type: 'button',
                  className: cls('dnw-chevron', !collapsed && 'dnw-chevronOpen'),
                  'aria-label': (collapsed ? t('expandGroup') : t('collapseGroup')) + ' ' + workspace.title,
                  'aria-hidden': !collapsible,
                  tabIndex: collapsible ? 0 : -1,
                  onClick: event => {
                    event.stopPropagation()
                    setExpanded(workspaceId, collapsed)
                  },
                },
                h('span', { className: 'dnw-arrowInner' }, h(IconChevron, null)),
              ),
              h('span', { className: cls('dnw-folderIcon', !collapsed && 'dnw-folderActive') }, h(IconFolder, null)),
            ),
            h(
              'span',
              {
                className: 'dnw-title',
                title: workspace.path,
                onDoubleClick: event => {
                  event.preventDefault()
                  event.stopPropagation()
                  setRenaming(workspace)
                },
              },
              workspace.title,
            ),
            h(
              'span',
              { className: cls('dnw-actions', menu !== null && menu.workspaceId === workspaceId && 'dnw-actionsOpen') },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dnw-iconButton',
                  title: t('actions.menu'),
                  'aria-label': t('actions.menu') + ' ' + workspace.title,
                  'aria-haspopup': 'menu',
                  'aria-expanded': menu !== null && menu.workspaceId === workspaceId,
                  onClick: event => openWorkspaceMenu(event, workspace),
                },
                h(IconDots, null),
              ),
              canCreateSession
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dnw-iconButton',
                      title: t('actions.newSession'),
                      'aria-label': t('actions.newSession') + ' ' + workspace.title,
                      onClick: event => {
                        event.stopPropagation()
                        uiWorkspace.startSession(workspaceId)
                      },
                    },
                    h(IconPlus, null),
                  )
                : null,
            ),
          )

          const body = []
          if (visible && hasSessions) body.push(h('div', { key: 'g:' + workspaceId, role: 'group' }, members.map((session, index) => h(SessionRow, { key: 's:' + session.id, session, groupKey: workspaceId, index, bucket: members, env }))))
          if (visible) {
            for (const child of children) body.push(h(WorkspaceGroup, { key: 'grp:' + child.workspaceId, workspace: child, depth: depth + 1, env }))
          }
          return h(Fragment, { key: 'grp:' + workspaceId }, row, ...body)
        }

          /* One bag of closures for the row components; rebuilt each render. */
          const env = {
            view, state, statuses, t, uiWorkspace,
            useSessionAccess, useWorkspaceAccess,
            openMenu, openWorkspaceMenu, assignSession, setExpanded, setRenaming,
            menu, draggingId, dropTarget, dragIdRef, setDraggingId, setDropTarget,
          }

          const tree = []
          for (const root of view.roots) tree.push(h(WorkspaceGroup, { key: 'grp:' + root.workspaceId, workspace: root, depth: 0, env }))

          const ungrouped = view.members.get(UNGROUPED) || []
          const ungroupedCollapsed = state.collapsed[UNGROUPED] === true
          const isUngroupedDrop =
            dropTarget !== null && dropTarget.workspaceId === UNGROUPED && dropTarget.sessionId === undefined
          if (ungrouped.length > 0) {
            tree.push(
              h(
                'div',
                {
                  key: 'w:ungrouped',
                  className: cls('dnw-row', 'dnw-workspaceRow'),
                  role: 'treeitem',
                  tabIndex: 0,
                  'aria-expanded': !ungroupedCollapsed,
                  style: { '--dnw-indent': '0px' },
                  onClick: () => setExpanded(UNGROUPED, ungroupedCollapsed),
                  onKeyDown: event => {
                    if (event.target !== event.currentTarget) return
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setExpanded(UNGROUPED, ungroupedCollapsed)
                  },
                  onDragOver: event => {
                    if (dragIdRef.current === null) return
                    event.preventDefault()
                    event.stopPropagation()
                    if (!isUngroupedDrop) setDropTarget({ workspaceId: UNGROUPED, mode: 'into' })
                  },
                  onDragLeave: () => {
                    if (isUngroupedDrop) setDropTarget(null)
                  },
                  onDrop: event => {
                    const id = dragIdRef.current || event.dataTransfer.getData('text/plain')
                    event.preventDefault()
                    event.stopPropagation()
                    setDropTarget(null)
                    setDraggingId(null)
                    dragIdRef.current = null
                    if (id) assignSession(id, UNGROUPED, undefined)
                  },
                },
                h(
                  'span',
                  { className: 'dnw-slot dnw-lead' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: cls('dnw-chevron', !ungroupedCollapsed && 'dnw-chevronOpen'),
                      'aria-label': (ungroupedCollapsed ? t('expandGroup') : t('collapseGroup')) + ' ' + t('ungrouped'),
                      onClick: event => {
                        event.stopPropagation()
                        setExpanded(UNGROUPED, ungroupedCollapsed)
                      },
                    },
                    h('span', { className: 'dnw-arrowInner' }, h(IconChevron, null)),
                  ),
                  h('span', { className: cls('dnw-folderIcon', !ungroupedCollapsed && 'dnw-folderActive') }, h(IconFolder, null)),
                ),
                h('span', { className: 'dnw-title dnw-titleMuted' }, t('ungrouped')),
              ),
              ungroupedCollapsed
                ? null
                : h('div', { key: 'g:ungrouped', role: 'group' }, ungrouped.map((session, index) => h(SessionRow, { key: 's:' + session.id, session, groupKey: UNGROUPED, index, bucket: ungrouped, env }))),
            )
          }

          const empty = view.roots.length === 0 && ungrouped.length === 0 && !view.filtering
          const noMatches = view.filtering && view.visibleCount === 0

          return h(
            'div',
            { className: 'dnw-root' },
            h(
              'div',
              { className: 'dnw-header' },
              editingTitle
                ? h('input', {
                    ref: titleInputRef,
                    className: 'dnw-headingInput',
                    value: draftTitle,
                    'aria-label': t('heading.default'),
                    spellCheck: false,
                    onChange: event => setDraftTitle(event.target.value),
                    onBlur: commitTitle,
                    onKeyDown: event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitTitle()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelTitleRef.current = true
                        setEditingTitle(false)
                      }
                    },
                  })
                : h(
                    'span',
                    {
                      className: 'dnw-label dnw-labelEditable',
                      role: 'button',
                      tabIndex: 0,
                      title: t('heading.hint'),
                      'aria-label': heading,
                      'aria-description': t('heading.hint'),
                      onDoubleClick: event => {
                        event.preventDefault()
                        cancelTitleRef.current = false
                        setDraftTitle(heading)
                        setEditingTitle(true)
                      },
                      onKeyDown: event => {
                        if (event.key === 'Enter' || event.key === 'F2') {
                          event.preventDefault()
                          cancelTitleRef.current = false
                          setDraftTitle(heading)
                          setEditingTitle(true)
                        }
                      },
                    },
                    heading,
                  ),
              h(
                'div',
                { className: 'dnw-headerActions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: cls('dnw-iconButton', showArchived && 'dnw-iconButtonOn'),
                    title: showArchived ? t('actions.hideArchived') : t('actions.showArchived'),
                    'aria-label': showArchived ? t('actions.hideArchived') : t('actions.showArchived'),
                    'aria-pressed': showArchived,
                    onClick: () => setShowArchived(current => !current),
                  },
                  h(IconArchive, null),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dnw-iconButton',
                    title: t('actions.search'),
                    'aria-label': t('actions.search'),
                    onClick: () => {
                      setSearchOpen(open => {
                        if (open) setQuery('')
                        return !open
                      })
                    },
                  },
                  h(IconSearch, null),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dnw-iconButton',
                    title: t('actions.addWorkspace'),
                    'aria-label': t('actions.addWorkspace'),
                    onClick: () => addChildRequest.set({ parentId: null, parentPath: null, parentTitle: null }),
                  },
                  h(IconFolderPlus, null),
                ),
              ),
            ),
            searchOpen
              ? h(
                  'div',
                  { className: 'dnw-searchRow' },
                  h('input', {
                    className: 'dnw-searchInput',
                    value: query,
                    placeholder: t('actions.search'),
                    'aria-label': t('actions.search'),
                    spellCheck: false,
                    autoFocus: true,
                    onChange: event => setQuery(event.target.value),
                    onKeyDown: event => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setQuery('')
                        setSearchOpen(false)
                      }
                    },
                  }),
                )
              : null,
            h(
              'div',
              { className: 'dnw-list', ref: bindScrollerRef, 'data-sidebar-list-area': '', role: 'tree', 'aria-label': heading },
              empty
                ? h('div', { className: 'dnw-empty' }, t('empty'))
                : noMatches
                  ? h('div', { className: 'dnw-empty' }, t('search.empty'))
                  : tree,
            ),
            request === null ? null : h(NewWorkspaceDialog, { request, onClose: () => addChildRequest.set(null) }),
            menuWorkspace === null
              ? null
              : h(MenuPopover, { anchor: menu.anchor, items: menuItems, onClose: closeMenu }),
            renaming === null ? null : h(WorkspaceRenameDialog, { workspace: renaming, onClose: () => setRenaming(null) }),
            deleting === null ? null : h(WorkspaceDeleteDialog, { workspace: deleting, onClose: () => setDeleting(null) }),
          )
        }

        ctx.slots.inject('sidebar.workspaces', () =>
          ctx.slots.register(
            {
              name: 'sidebar.workspaces',
              priority: -1,
              locale: NS,
            },
            Sidebar,
          ),
        )

        function sessionTitle(session) {
          if (session.blank) return ''
          const title = typeof session.title === 'string' ? session.title.trim() : ''
          return title !== '' ? title : session.displayTitle || ''
        }
      },
    }
  },
})
