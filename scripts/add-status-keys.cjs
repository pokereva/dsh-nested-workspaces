/**
 * One-shot: insert the row-status locale keys into each dictionary.
 * Values mirror the shipped `workspace` namespace so the strings match the
 * built-in browser exactly.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'client.js');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

const OWNED = [
  'status.running',
  'status.subagentsRunning',
  'status.completed',
  'status.waitingApproval',
  'status.planReview',
  'status.waitingAnswer',
];

const EXTRAS = {
  zh: {
    'status.running': '正在工作',
    'status.subagentsRunning': '{n}个子代理正在运行',
    'status.completed': '已完成',
    'status.waitingApproval': '等待批准',
    'status.planReview': '等待确认计划',
    'status.waitingAnswer': '等待回答',
  },
  en: {
    'status.running': 'Working',
    'status.subagentsRunning': '{n} subagents running',
    'status.completed': 'Completed',
    'status.waitingApproval': 'Waiting for approval',
    'status.planReview': 'Waiting for plan review',
    'status.waitingAnswer': 'Waiting for an answer',
  },
  ja: {
    'status.running': '実行中',
    'status.subagentsRunning': '{n}件のサブエージェントが実行中',
    'status.completed': '完了',
    'status.waitingApproval': '承認待ち',
    'status.planReview': 'プラン確認待ち',
    'status.waitingAnswer': '回答待ち',
  },
};

const ANCHORS = { zh: "'errors.pinFailed':", en: "'errors.pinFailed':", ja: "'errors.pinFailed':" };

const out = [];
let current = null;
let inserted = 0;

for (const line of lines) {
  const zh = /^\s{6}zh: \{$/.test(line);
  const en = /^\s{6}en: \{$/.test(line);
  const ja = /^\s{6}ja: \{$/.test(line);
  if (zh) current = 'zh';
  else if (en) current = 'en';
  else if (ja) current = 'ja';

  // Drop any earlier copy of the keys this script owns.
  const owned = OWNED.some(key => line.includes("'" + key + "':"));
  if (owned) {
    continue;
  }

  out.push(line);

  if (current !== null && ANCHORS[current] !== undefined && line.includes(ANCHORS[current])) {
    for (const key of OWNED) {
      const value = EXTRAS[current][key].replace(/'/g, "\\'");
      out.push("        '" + key + "': '" + value + "',");
      inserted += 1;
    }
  }
}

fs.writeFileSync(FILE, out.join('\n'));
console.log('status keys written: ' + inserted);
