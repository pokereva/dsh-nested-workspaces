/**
 * Replaces the CSS template literal inside client.js with the
 * design-system-aligned sheet. Run from the plugin root:
 *
 *   node scripts/apply-css.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client.js');

const CSS_LINES = [
  '.dnw-root{display:flex;flex-direction:column;min-height:0;height:100%;color:var(--dsw-alias-label-primary)}',
  '.dnw-header{flex:none;display:flex;align-items:center;gap:4px;height:36px;padding-left:var(--dsh-sidebar-row-padding,12px);box-sizing:border-box;border-radius:var(--dsw-radius-md);overflow:hidden;color:var(--dsw-alias-label-tertiary)}',
  '.dnw-label{position:relative;left:-1px;flex:none;max-width:45%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px;font-size:14px;color:var(--dsw-alias-label-tertiary);user-select:none}',
  '.dnw-labelEditable{cursor:text;border-radius:var(--dsw-radius-xs);padding:0 2px;margin:0 -2px}',
  '.dnw-labelEditable:hover{color:var(--dsw-alias-label-secondary)}',
  '.dnw-headingInput{flex:1;min-width:0;margin:0;padding:0 2px;font:inherit;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);outline:none}',
  '.dnw-headerActions{display:flex;align-items:center;gap:4px;flex:none;margin-left:auto}',
  '.dnw-iconButton{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
  '.dnw-iconButton:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
  '.dnw-iconButtonOn{background-color:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}',
  '.dnw-rowDragging{opacity:0.5}',
  '.dnw-iconButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}',
  '.dnw-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:8px;scrollbar-width:thin}',
  '.dnw-searchRow{padding:0 8px 4px;padding-left:var(--dsh-sidebar-row-padding,12px)}',
  '.dnw-searchInput{width:100%;box-sizing:border-box;height:32px;padding:0 4px 0 0;font:inherit;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);outline:none}',
  '.dnw-searchInput:focus{border-color:var(--dsw-alias-state-business-primary)}',
  '.dnw-row{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,6px);height:32px;padding:0 8px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) - var(--dsh-sidebar-paint-inset,3px) + var(--dnw-indent,0px));border-inline:var(--dsh-sidebar-paint-inset,3px) solid transparent;background-clip:padding-box;border-radius:var(--dsw-radius-md);cursor:pointer;user-select:none;position:relative;color:var(--dsw-alias-label-primary)}',
  '@media (hover:hover){.dnw-row:hover{background-color:var(--dsw-alias-interactive-bg-hover)}}',
  '.dnw-rowSelected{background-color:var(--dsw-alias-interactive-bg-hover)}',
  '.dnw-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}',
  '.dnw-slot{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}',
  '.dnw-lead{position:relative}',
  '.dnw-folderIcon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}',
  '.dnw-folderActive{color:var(--dsw-alias-state-business-primary)}',
  '.dnw-chevron{flex:none;display:none;align-items:center;justify-content:center;width:16px;height:20px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer}',
  '.dnw-workspaceRow:hover .dnw-folderIcon,.dnw-workspaceRow:focus-within .dnw-folderIcon{display:none}',
  '.dnw-workspaceRow:hover .dnw-chevron,.dnw-workspaceRow:focus-within .dnw-chevron,.dnw-workspaceRow:has(.dnw-chevronOpen) .dnw-chevron{display:inline-flex}',
  '.dnw-workspaceRow:has(.dnw-chevronOpen) .dnw-folderIcon{display:none}',
  '@media (hover:none){.dnw-chevron{display:inline-flex}.dnw-folderIcon{display:none}}',
  '.dnw-arrowInner{display:inline-flex;transition:transform 150ms var(--ds-ease-in-out,ease)}',
  '.dnw-chevronOpen .dnw-arrowInner{transform:rotate(90deg)}',
  '.dnw-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}',
  '.dnw-titleMuted{color:var(--dsw-alias-label-caption)}',
  '.dnw-rowArchived .dnw-title{color:var(--dsw-alias-label-caption)}',
  '.dnw-actions{flex:none;display:none;align-items:center;gap:13px}',
  '.dnw-row:hover .dnw-actions,.dnw-actionsOpen{display:flex}',
  '@media (hover:none){.dnw-actions{display:flex}}',
  '.dnw-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary);flex:none}',
  '.dnw-dotIdle{background:var(--dsw-alias-label-caption);opacity:.5}',
  '.dnw-empty{padding:2px 8px 4px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) + 22px + var(--dnw-indent,0px));font-size:13px;line-height:20px;color:var(--dsw-alias-label-caption)}',
  '.dnw-dropBefore::before,.dnw-dropAfter::after{content:"";position:absolute;left:calc(-1 * var(--dsh-sidebar-paint-inset,3px));right:calc(4px - var(--dsh-sidebar-paint-inset,3px));height:2px;border-radius:1px;background:var(--dsw-alias-state-business-primary)}',
  '.dnw-dropBefore::before{top:-8px}',
  '.dnw-dropAfter::after{bottom:-8px}',
  '.dnw-dropOn{background-color:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}',
  '.dnw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}',
  '.dnw-railButton{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
  '.dnw-railButton:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
  '.dnw-scrim{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.32)}',
  '.dnw-dialog{width:min(420px,100%);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-elevated,#fff);color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px rgba(0,0,0,.28);font-size:14px;line-height:20px}',
  '.dnw-dialogTitle{font-size:15px;font-weight:600;line-height:22px}',
  '.dnw-dialogText{font-size:13px;line-height:19px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
  '.dnw-dialogInput{width:100%;box-sizing:border-box;height:44px;padding:0 10px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);outline:none}',
  '.dnw-dialogInput:focus{border-color:var(--dsw-alias-state-business-primary)}',
  '.dnw-dialogError{font-size:13px;line-height:19px;color:var(--dsw-alias-state-error-primary,#d33)}',
  '.dnw-dialogFooter{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}',
  '.dnw-button{height:32px;padding:0 14px;font:inherit;font-size:13px;line-height:30px;border-radius:var(--dsw-radius-md,8px);border:0.5px solid var(--dsw-alias-border-l4);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}',
  '.dnw-button:hover{background-color:var(--dsw-alias-interactive-bg-hover)}',
  '.dnw-buttonPrimary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:#fff}',
  '.dnw-buttonDanger{background:var(--dsw-alias-state-error-primary,#d33)}',
  '.dnw-button:disabled{opacity:.5;cursor:default}',
  '.dnw-menu{position:fixed;z-index:2147483001;min-width:184px;padding:4px;display:flex;flex-direction:column;gap:1px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-elevated,#fff);box-shadow:0 10px 30px rgba(0,0,0,.22),0 0 0 0.5px var(--dsw-alias-border-l4,rgba(0,0,0,.08));font-size:13px;line-height:18px}',
  '.dnw-menuItem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:var(--dsw-radius-xs);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:start;cursor:pointer}',
  '.dnw-menuItem:hover,.dnw-menuItem:focus-visible,.dnw-menuItemActive{background-color:var(--dsw-alias-interactive-bg-hover);outline:none}',
  '.dnw-menuItemDanger{color:var(--dsw-alias-state-error-primary,#d33)}',
  '.dnw-menuIcon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}',
  '.dnw-menuItemDanger .dnw-menuIcon{color:inherit}',
  '.dnw-menuSeparator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l4,rgba(0,0,0,.08))}',
  '@media (prefers-reduced-motion: reduce){.dnw-arrowInner{transition:none}}',
  '@media (pointer:coarse){.dnw-searchInput,.dnw-headingInput,.dnw-dialogInput{font-size:16px}}',
];

const source = fs.readFileSync(CLIENT, 'utf8');
const lines = source.split('\n');

const startIndex = lines.findIndex((line) => /^\s*const CSS = `?\s*$/.test(line));
if (startIndex < 0) throw new Error('CSS template literal start not found');

let endIndex = -1;
for (let index = startIndex + 1; index < lines.length; index += 1) {
  if (lines[index].trim() === '`') {
    endIndex = index;
    break;
  }
  if (/^\s*function ensureStyles\(\) \{/.test(lines[index])) {
    /* An earlier repair attempt dropped the body and the closing fence. */
    endIndex = index - 1;
    break;
  }
}
if (endIndex < 0) throw new Error('CSS template literal end not found');

const rebuilt = [
  ...lines.slice(0, startIndex),
  '    const CSS = `',
  ...CSS_LINES,
  '`',
  ...lines.slice(endIndex + 1),
];

fs.writeFileSync(CLIENT, rebuilt.join('\n'));
console.log('written: ' + CSS_LINES.length + ' css rules');
