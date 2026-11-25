/* One-shot patcher: a child group has no directory, so its delete dialog needs
 * its own copy. Adds `dialog.deleteGroup.description` to all three locales and
 * uses it when the deleted node is virtual.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'client.js');
let source = fs.readFileSync(FILE, 'utf8');

const keys = [
  ["        'dialog.delete.description': '将把「{name}」从侧边栏移除，磁盘上的文件不会被删除。',",
    "        'dialog.deleteGroup.description': '将把子工作区分组「{name}」及其下级分组从侧边栏删除；其中的会话会回到它们真正所属的工作区。',"],
  ["        'dialog.delete.description': 'This removes \"{name}\" from the sidebar. Files on disk are kept.',",
    "        'dialog.deleteGroup.description': 'This removes the child workspace group \"{name}\" and its nested groups from the sidebar. Sessions it showed return to the workspace that owns them.',"],
  ["        'dialog.delete.description': '「{name}」をサイドバーから削除します。ディスク上のファイルは残ります。',",
    "        'dialog.deleteGroup.description': '子ワークスペースのグループ「{name}」とその下位グループをサイドバーから削除します。そこに表示されていたセッションは本来のワークスペースに戻ります。',"],
];

for (const [anchor, addition] of keys) {
  if (source.indexOf(anchor) === -1) throw new Error('missing anchor: ' + anchor.slice(0, 46));
  if (source.indexOf(addition) !== -1) continue;
  source = source.replace(anchor, anchor + '\n' + addition);
}

const before = "            description: t('dialog.delete.description', { name: workspace.title }),";
const after = "            description: workspace.virtual === true\n              ? t('dialog.deleteGroup.description', { name: workspace.title })\n              : t('dialog.delete.description', { name: workspace.title }),";
if (source.indexOf(before) === -1) throw new Error('missing description call site');
if (source.indexOf(after) === -1) source = source.replace(before, after);

fs.writeFileSync(FILE, source);
console.log('group delete copy written');
