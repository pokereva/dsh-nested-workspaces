/**
 * Adds the relative-time, pin and move-related locale keys to client.js.
 * Idempotent: existing keys are replaced in place.
 *
 *   node scripts/add-locale-keys.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CLIENT = path.join(path.resolve(__dirname, '..'), 'client.js');

/** Keys added after `session.untitled` in every locale, in this order. */
const EXTRA = {
  zh: {
    'time.now': '刚刚',
    'time.minutes': '{n}分钟',
    'time.hours': '{n}小时',
    'time.days': '{n}天',
    'time.months': '{n}个月',
    'time.years': '{n}年',
    'time.ago': '{t}前',
    'actions.pin': '置顶',
    'actions.unpin': '取消置顶',
    'row.pinned': '已置顶',
    'errors.pinFailed': '置顶状态更新失败',
  },
  en: {
    'time.now': 'now',
    'time.minutes': '{n}min',
    'time.hours': '{n}h',
    'time.days': '{n}d',
    'time.months': '{n}mo',
    'time.years': '{n}y',
    'time.ago': '{t} ago',
    'actions.pin': 'Pin',
    'actions.unpin': 'Unpin',
    'row.pinned': 'Pinned',
    'errors.pinFailed': 'Could not update the pin',
  },
  ja: {
    'time.now': '今',
    'time.minutes': '{n}分',
    'time.hours': '{n}時間',
    'time.days': '{n}日',
    'time.months': '{n}か月',
    'time.years': '{n}年',
    'time.ago': '{t}前',
    'actions.pin': 'ピン留め',
    'actions.unpin': 'ピン留めを解除',
    'row.pinned': 'ピン留め済み',
    'errors.pinFailed': 'ピン留めを更新できませんでした',
  },
};

const source = fs.readFileSync(CLIENT, 'utf8');
const lines = source.split('\n');

/** Locate the three locale blocks by their opening line. */
const ORDER = ['zh', 'en', 'ja'];
const starts = [];
for (let index = 0; index < lines.length; index += 1) {
  const match = /^(\s+)(zh|en|ja): \{$/.exec(lines[index]);
  if (match !== null) starts.push({ locale: match[2], index, indent: match[1] });
}
const seen = starts.map(entry => entry.locale);
if (seen.join(',') !== ORDER.join(',')) throw new Error('unexpected locale block order: ' + seen.join(','));

/* Insert from the bottom up so earlier indices stay valid. */
for (let position = starts.length - 1; position >= 0; position -= 1) {
  const { locale, index, indent } = starts[position];
  const extra = EXTRA[locale];
  if (extra === undefined) throw new Error('no extra keys for ' + locale);

  /* The block ends at the first line that is exactly the block indent + `},`. */
  let end = -1;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor] === indent + '},') { end = cursor; break; }
  }
  if (end < 0) throw new Error('locale block ' + locale + ' has no closing brace');

  /* Drop any previous copy of these keys, then append them fresh. */
  const wanted = new Set(Object.keys(extra));
  const body = lines.slice(index + 1, end).filter(line => {
    const match = /^\s+'([^']+)':/.exec(line);
    return match === null || !wanted.has(match[1]);
  });
  /* Keep a trailing blank separator line out of the insertion point. */
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
  const rendered = Object.entries(extra).map(([key, value]) => `${indent}  '${key}': '${value}',`);
  const blank = lines[end - 1] !== undefined && lines[end - 1].trim() === '' ? [''] : [];
  lines.splice(index + 1, end - index - 1, ...body, ...blank, ...rendered);
}

fs.writeFileSync(CLIENT, lines.join('\n'));
console.log('locale keys written: ' + Object.values(EXTRA).reduce((total, dict) => total + Object.keys(dict).length, 0));
