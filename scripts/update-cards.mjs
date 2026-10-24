/**
 * 抓取个人统计卡片，把标签换成中文，写进 cards/。
 *
 * 数据源：github-profile-summary-cards（深色主题，跟组织页同一套）。
 * 那个托管接口不认中文（标签写死在卡片代码里），抓回来替换文字节点，
 * 外观一模一样，读起来是中文。
 *
 * 跑法：node scripts/update-cards.mjs（bun 也行）
 * 定时：.github/workflows/cards.yml，每天一次。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = 'lima-droid';
const BASE = 'https://github-profile-summary-cards.vercel.app/api/cards';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'cards');

// [卡片名, 额外参数]
const CARDS = [
  ['profile-details', ''],
  ['repos-per-language', ''],
  ['most-commit-language', ''],
  ['stats', ''],
  ['productive-time', '&utcOffset=8']
];

// 顺序有讲究：先整句、再单词。
const REPLACEMENTS = [
  [/(\d+) Contributions on GitHub/g, 'GitHub 贡献 $1 次'],
  [/(\d+) Public Repos/g, '$1 个公开仓库'],
  [/Joined GitHub (\d+) years? ago/g, '加入 GitHub $1 年'],
  [/Joined GitHub (\d+) days? ago/g, '加入 GitHub $1 天'],
  [/contributions in the last year/g, '最近一年贡献'],
  [/Top Languages by Repo/g, '语言分布 · 按仓库'],
  [/Top Languages by Commit/g, '语言分布 · 按提交'],
  [/Commits \(UTC \+8\.00\)/g, '提交时段（UTC+8）'],
  [/per day hour/g, '按小时统计'],
  [/>Stats</g, '>数据总览<'],
  [/Total Stars:/g, '总星标'],
  [/Total Commits:/g, '总提交'],
  [/Total PRs:/g, 'PR 总数'],
  [/Total Issues:/g, 'Issue 总数'],
  [/Contributed to:/g, '贡献仓库'],
  [/Total Repos:/g, '公开仓库'],
  [/Total Forks:/g, 'Fork 总数'],
  [/Open Issues:/g, '未解决议题'],
  [/No data/g, '暂无数据']
];

// 中文字形：卡片原来只写了西文字体，补上中文栈。
const FONT_FIXES = [
  [
    `'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif`,
    `'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', Ubuntu, "Helvetica Neue", Sans-Serif`
  ],
  [
    `'Segoe UI', Ubuntu, Sans-Serif`,
    `'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', Ubuntu, Sans-Serif`
  ]
];

async function grab(name, extra) {
  const url = `${BASE}/${name}?username=${USER}&theme=github_dark&animation=load&border_color=0d1116${extra}`;
  const res = await fetch(url, { headers: { 'user-agent': 'lima-droid-profile-cards' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  let svg = await res.text();
  if (!svg.includes('<svg')) throw new Error(`${name}: 不是 SVG`);

  for (const [from, to] of REPLACEMENTS) svg = svg.replace(from, to);
  for (const [from, to] of FONT_FIXES) svg = svg.split(from).join(to);

  // 接口哪天改了措辞，这里会提前发现（不至于悄悄退回英文）。
  const leftover = svg.match(/>[^<>]*(Total |Public Repos|Top Languages|Contributions on GitHub|Joined GitHub)[^<>]*</);
  if (leftover) console.warn(`⚠️ ${name}: 还有没翻到的英文 → ${leftover[0]}`);
  return svg;
}

await mkdir(OUT_DIR, { recursive: true });
for (const [name, extra] of CARDS) {
  const svg = await grab(name, extra);
  await writeFile(resolve(OUT_DIR, `${name}.svg`), svg, 'utf8');
  console.log(`✔ ${name}.svg`);
}
