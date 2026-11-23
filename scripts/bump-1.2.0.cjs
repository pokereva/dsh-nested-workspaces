'use strict'
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

const pkgFile = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
pkg.version = '1.2.0'
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n')
console.log('version', pkg.version)

const copy = {
  en: 'Nested child workspaces in the DeepSeek Harness sidebar. Create a child workspace inside its parent folder without the OS picker, drag workspaces to reorder siblings, drag sessions between workspaces, rename the section title by double-clicking, and see each session last-used time and pin marker.',
  zh: '在 DeepSeek Harness 侧边栏中创建子工作区：在父目录内直接新建（无需系统目录选择器）、拖动工作区调整同级顺序、把会话拖到其它工作区、双击改写分区标题，并显示每个会话的最近使用时间与置顶标记。',
  ja: 'DeepSeek Harness のサイドバーで子ワークスペースを扱います。OS のフォルダ選択なしで親フォルダ内に作成し、ワークスペースをドラッグして同階層の順序を変更し、セッションを別のワークスペースへ移動でき、見出しはダブルクリックで変更、各セッションの最終使用時刻とピン留めも表示します。',
}

for (const [locale, description] of Object.entries(copy)) {
  const file = path.join(root, 'locale', locale + '.json')
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  data.meta.description = description
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  console.log('locale', locale, 'updated')
}
