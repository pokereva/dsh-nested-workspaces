/* One-shot patcher: rewrite the add-child dialog copy for virtual groups and
 * add the `virtual.hint` key used by the row's aria-label. Run with
 *   node scripts/patch-virtual-locale.cjs
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'client.js');
let source = fs.readFileSync(FILE, 'utf8');

const replacements = [
  {
    from: "'dialog.addChild.description': '将在 {parent} 下创建新的子工作区目录。',",
    to: "'dialog.addChild.description': '会在 {parent} 下新建一个子工作区分组；只在侧栏里记录，不会在磁盘上创建文件夹。',",
  },
  {
    from: "'dialog.addChild.description': 'A new child workspace directory will be created under {parent}.',",
    to: "'dialog.addChild.description': 'Adds a child workspace group under {parent}. It is only recorded in the sidebar — no folder is created on disk.',",
  },
  {
    from: "'dialog.addChild.description': '{parent} の下に子ワークスペースを作成します。',",
    to: "'dialog.addChild.description': '{parent} の下に子ワークスペースのグループを追加します。サイドバーに記録するだけで、ディスク上にフォルダーは作成しません。',",
  },
];

for (const { from, to } of replacements) {
  if (source.indexOf(from) === -1) throw new Error('missing: ' + from.slice(0, 48));
  if (source.split(from).length - 1 !== 1) throw new Error('duplicated: ' + from.slice(0, 48));
  source = source.split(from).join(to);
}

/* `virtual.hint` labels a group that has no directory of its own. */
const hints = [
  ["        'createdChild': '已创建子工作区',", "        'virtual.hint': '分组，会话在',"],
  ["        'createdChild': 'Child workspace created',", "        'virtual.hint': 'group, sessions run in',"],
  ["        'createdChild': '子ワークスペースを作成しました',", "        'virtual.hint': 'グループ、セッションの実行先は',"],
];

for (const [anchor, addition] of hints) {
  if (source.indexOf(anchor) === -1) throw new Error('missing anchor: ' + anchor);
  if (source.indexOf(addition) !== -1) continue;
  source = source.replace(anchor, anchor + '\n' + addition);
}

fs.writeFileSync(FILE, source);
console.log('virtual locale copy written');
