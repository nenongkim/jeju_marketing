#!/usr/bin/env node
'use strict';

// Rebuild the submission PDF from editable storyboard data and captured screens.
// No network requests or extra packages are required at build time.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_PLAYWRIGHT = 'playwright';
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function parseArgs(argv) {
  const options = {
    input: path.join(__dirname, 'storyboards.json'),
    output: path.join(ROOT, '00_제출/Red_SCREEN.pdf'),
    html: path.join(ROOT, '.omx/screen-design/pdf-build/screen-design.html'),
    report: path.join(ROOT, '.omx/screen-design/pdf-build/build-report.json'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index].replace(/^--/, '');
    if (key === 'help') {
      console.log('Usage: node 02_제품/화면설계/build-pdf.cjs [--input JSON] [--output PDF] [--html HTML] [--report JSON]');
      process.exit(0);
    }
    if (!Object.hasOwn(options, key) || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
    }
    options[key] = path.resolve(ROOT, argv[++index]);
  }
  return options;
}

function escape(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function list(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function join(value, separator = ' · ') {
  return list(value).map(escape).join(separator);
}

function chunks(values, length) {
  return Array.from({ length: Math.ceil(values.length / length) }, (_, index) => values.slice(index * length, (index + 1) * length));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function flowStep(step) {
  const match = String(step).match(/^(SCR-[A-Z]-\d{3}(?:-P\d{2})?)\s+([\s\S]+)$/);
  return match ? `<span class="flow-id">${escape(match[1])}</span><span>${escape(match[2])}</span>` : escape(step);
}

function imagePath(image) {
  if (typeof image !== 'string' || !image) throw new Error('Every storyboard needs a local captured image');
  const resolved = path.resolve(ROOT, image);
  if (!fs.existsSync(resolved)) throw new Error(`Missing captured image: ${resolved}`);
  return resolved;
}

function validate(data) {
  for (const key of ['inventory', 'coverage', 'boards', 'checklist', 'flows']) {
    if (!Array.isArray(data[key])) throw new Error(`${key} must be an array`);
  }
  if (!data.meta || !data.meta.title || !data.boards.length) throw new Error('A title and at least one storyboard are required');
  const ids = data.inventory.map(row => row.id);
  if (new Set(ids).size !== ids.length) throw new Error('Screen inventory contains duplicate IDs');
  for (const board of data.boards) {
    if (!ids.some(id => board.screenId === id || board.screenId.startsWith(`${id}-P`))) throw new Error(`Storyboard is missing from the screen inventory: ${board.screenId}`);
    if (!Array.isArray(board.items) || !board.items.length) throw new Error(`Storyboard has no behavior descriptions: ${board.screenId}`);
    if (new Set(board.items.map(item => item.n)).size !== board.items.length) throw new Error(`Duplicate annotation numbers: ${board.screenId}`);
    if (data.meta.captureSource === 'Figma' && (!board.figma?.url || board.annotated || board.items.some(item => !Number.isFinite(item.x) || !Number.isFinite(item.y)))) {
      throw new Error(`Figma capture requires its original frame link and separate callout positions: ${board.key}`);
    }
    for (const item of board.items) {
      for (const key of ['n', 'title', 'action', 'process', 'result']) {
        if (item[key] == null || item[key] === '') throw new Error(`Missing ${key} in ${board.screenId} annotation ${item.n}`);
      }
      if (item.x != null || item.y != null) {
        if (![item.x, item.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
          throw new Error(`Annotation x/y must be image percentages from 0 to 100: ${board.screenId} #${item.n}`);
        }
      }
    }
    imagePath(board.image);
  }
}

const CSS = `
@font-face{font-family:Pretendard;src:url('__FONT_URL__') format('woff2');font-style:normal;font-weight:100 900;font-display:block}
@page{size:20in 11.25in;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#eef2ed;color:#20352d;font-family:Pretendard,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-size:22px;line-height:1.45}
a{color:#236447;text-decoration:underline;text-underline-offset:5px;overflow-wrap:anywhere}
.page{width:1920px;height:1080px;padding:54px 64px 64px;position:relative;overflow:hidden;background:#fff;break-after:page}
.page:last-child{break-after:auto}
.page::before{content:'';position:absolute;left:0;top:0;width:100%;height:8px;background:#236447}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:28px}
.eyebrow{color:#236447;font-size:18px;font-weight:750;letter-spacing:.08em;margin:0 0 9px}
h1,h2,h3,p{margin:0}
h1{font-size:70px;font-weight:780;line-height:1.16;letter-spacing:-.045em}
h2{font-size:40px;font-weight:760;line-height:1.2;letter-spacing:-.035em}
h3{font-size:25px;line-height:1.25;font-weight:740;letter-spacing:-.02em}
.muted{color:#617067}
.page-footer{position:absolute;bottom:24px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #dce4de;padding-top:13px;font-size:15px;color:#637169;gap:20px}
.page-footer span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}
.status{display:inline-flex;align-items:center;justify-content:center;border-radius:6px;padding:9px 14px;background:#eaf3ec;color:#236447;font-weight:720;font-size:18px;line-height:1.3;text-align:center;max-width:610px}
.status.pending{background:#fff2dc;color:#88591c}
.status.compact{padding:6px 10px;font-size:16px;max-width:240px}
.cover{padding-top:82px}
.cover .page-header{margin-bottom:84px}
.cover-title{max-width:1420px}
.cover-subtitle{font-size:28px;color:#617067;margin-top:24px;max-width:1390px;line-height:1.6}
.cover-meta{display:flex;gap:48px;margin-top:48px;font-size:21px}
.cover-meta label{display:block;font-size:16px;color:#657369;margin-bottom:5px}
.cover-stats{display:grid;grid-template-columns:repeat(3,1fr);max-width:950px;margin-top:54px;border-top:1px solid #dce4de;border-bottom:1px solid #dce4de;padding:21px 0}
.cover-stats strong{display:block;font-size:38px;color:#236447;line-height:1.2}
.cover-stats span{font-size:17px;color:#637169}
.figma-block{margin-top:40px;background:#f3f6f2;border:1px solid #dce4de;padding:22px 27px;max-width:1580px;border-radius:10px;font-size:20px}
.figma-block h3{font-size:22px;margin-bottom:8px}
.figma-block p+p{margin-top:6px}
.figma-block .muted{font-size:18px}
.section-lead{font-size:22px;color:#627067;margin-bottom:24px;max-width:1640px}
.table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:20px}
.table th{background:#eef4ee;color:#355345;font-size:17px;font-weight:740;text-align:left;padding:16px 15px;border-top:2px solid #236447;border-bottom:1px solid #cad7cd}
.table td{padding:19px 15px;border-bottom:1px solid #dce4de;vertical-align:top;overflow-wrap:anywhere}
.table td:first-child{font-weight:700;color:#236447;font-size:19px}
.table .scope-cell{font-size:17px;line-height:1.5}
.table .sub{display:block;font-size:16px;color:#657369;margin-top:4px}
.table.compact{font-size:18px}
.table.compact th{padding:13px 13px}
.table.compact td{padding:12px 13px}
.table.compact td:first-child{font-size:17px}
.note-box{background:#f6f8f5;border:1px solid #e0e6de;border-radius:8px;padding:20px 24px;margin-top:25px;font-size:19px;color:#516459}
.flow-lane{border:1px solid #dce4de;border-left:5px solid #236447;border-radius:9px;padding:25px 28px;margin-bottom:24px}
.flow-lane h3{margin-bottom:17px}
.flow-route{display:flex;flex-wrap:wrap;align-items:stretch;gap:11px}
.flow-step{display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;text-align:center;min-height:73px;flex:1 1 145px;max-width:360px;background:#f0f5ef;border:1px solid #d7e3d6;border-radius:8px;padding:13px 14px;font-size:18px;font-weight:650;white-space:pre-line;word-break:keep-all;overflow-wrap:break-word}
.flow-id{font-size:15px;line-height:1.3;white-space:nowrap;color:#49634f}
.flow-arrow{display:flex;align-items:center;color:#8da292;font-size:27px;flex:0 0 20px}
.flow-note{font-size:18px;color:#637369;margin-top:15px}
.scope-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:19px;margin-top:28px}
.scope-card{background:#f7f9f5;border:1px solid #e0e7dd;border-radius:8px;padding:19px 22px}
.scope-card h3{font-size:20px;margin-bottom:8px}
.scope-card p{font-size:18px;color:#596d5d;line-height:1.6}
.metadata{display:grid;grid-template-columns:1.05fr 1.35fr 2.4fr;gap:18px;padding:16px 20px;border:1px solid #dce4de;border-radius:8px;background:#f8faf7;margin-bottom:25px}
.metadata div{font-size:18px;line-height:1.45;overflow-wrap:anywhere}
.metadata label{font-size:14px;font-weight:700;color:#6d7b71;display:block;letter-spacing:.04em;margin-bottom:4px}
.board .page-header{margin-bottom:17px}
.board-layout{height:725px;display:grid;grid-template-columns:minmax(0,1.98fr) minmax(0,1fr);gap:29px}
.capture-panel{min-width:0;min-height:0;display:flex;flex-direction:column}
.capture-top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:11px;font-size:16px;color:#627469}
.capture-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#f2f5f0;border:1px solid #d9e1d7;border-radius:9px;padding:12px;overflow:hidden}
.shot-wrap{position:relative;flex:none;max-width:100%;max-height:100%;box-shadow:0 3px 18px #263f2a13}
.shot-wrap img{display:block;width:100%;height:100%;border-radius:3px}
.marker{position:absolute;width:34px;height:34px;transform:translate(-50%,-50%);border-radius:50%;border:3px solid white;box-shadow:0 1px 4px #17332380;background:#236447;color:white;display:flex;justify-content:center;align-items:center;font-size:18px;font-weight:800;line-height:1;z-index:1}
.capture-caption{font-size:16px;color:#607067;line-height:1.5;margin-top:10px;min-height:24px}
.state-block{margin-top:14px;border-left:3px solid #96b597;background:#f5f8f2;padding:12px 16px}
.state-block h3{font-size:17px;margin-bottom:6px;color:#385f45}
.state-block ul{display:grid;gap:4px;margin:0;padding-left:19px;font-size:16px;line-height:1.45;color:#576b5c}
.description{display:flex;flex-direction:column;min-height:0;border:1px solid #dce4de;border-radius:9px;overflow:hidden}
.description-heading{padding:17px 22px;background:#edf3ec;border-bottom:1px solid #dce4de;display:flex;justify-content:space-between;gap:15px;align-items:baseline}
.description-heading h3{font-size:23px}
.description-heading span{font-size:14px;color:#637769}
.description-items{padding:6px 21px 8px;flex:1;min-height:0}
.description-item{padding:12px 0;border-bottom:1px solid #dfe6dc;font-size:18px;line-height:1.44}
.description-item:last-child{border-bottom:0}
.item-title{display:flex;align-items:center;gap:10px;font-weight:740;font-size:20px;line-height:1.3;margin-bottom:6px}
.number{flex:none;display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;background:#236447;color:#fff;border-radius:50%;font-size:16px;font-weight:750}
.behavior{padding-left:38px;color:#56685b}
.behavior strong{color:#273d30;font-weight:640}
.behavior .arrow{color:#739580;padding:0 4px;font-weight:700}
.target{display:block;font-size:15px;color:#236447;margin-top:5px;font-weight:650}
.description.dense .description-item{font-size:16.5px;padding:9px 0;line-height:1.42}
.description.dense .item-title{font-size:18px;margin-bottom:5px}
.description.dense .behavior{padding-left:34px}
.description.dense .number{width:25px;height:25px;font-size:15px}
.description.tight .description-item{font-size:16px;padding:7px 0;line-height:1.36}
.description.tight .item-title{font-size:17px}
.checklist-table td{padding:17px 14px;font-size:19px}
.checklist-table td:first-child{font-size:19px;color:#20352d;font-weight:650}
.checklist-table .evidence{font-size:18px;color:#586d5d}
.closing-note{font-size:18px;color:#607266;margin-top:15px}
@media screen{.page{margin:25px auto;box-shadow:0 4px 28px #20352d19}}
@media print{html,body{background:#fff}.page{margin:0;box-shadow:none}}
`;

function figmaContent(meta) {
  const figma = meta.figma || {};
  if (figma.url) {
    const url = new URL(figma.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Figma URL must use HTTP or HTTPS');
    return `<h3>팀 Figma 공유 링크</h3><p><a href="${escape(figma.url)}">${escape(figma.url)}</a></p><p class="muted">${escape(figma.status || '공유 권한 확인 기록을 확인해 주세요')}</p>`;
  }
  return '<h3>Figma 연결 · 캡처 · 공유 권한 확인 대기</h3><p>현재 문서는 검토본입니다. 팀 Figma 공유 링크와 Figma 캡처를 반영한 뒤 제출본으로 확정합니다.</p><p class="muted">아래 화면은 로컬 웹 시안을 캡처한 자료이며, Figma에서 캡처한 자료로 표시하지 않습니다.</p>';
}

function header(section, title, badge = '') {
  return `<header class="page-header"><div><p class="eyebrow">${escape(section)}</p><h2>${escape(title)}</h2></div>${badge}</header>`;
}

function status(value, compact = false) {
  const pending = /대기|미완|미확인|미검증|보완|예정|검토|진행|실패|차단/.test(String(value));
  return `<span class="status${pending ? ' pending' : ''}${compact ? ' compact' : ''}">${escape(value)}</span>`;
}

function makePages(data) {
  const pages = [];
  const { meta } = data;
  const isPending = !meta.figma?.url || meta.captureSource !== 'Figma' || meta.figma.sharedAccessVerified !== true;
  const screenCount = data.inventory.length;
  const ucCount = new Set(data.coverage.map(row => row.uc)).size;
  const actors = [...new Set(data.inventory.flatMap(row => list(row.actors)))];
  pages.push({ key: 'cover', className: 'cover', html: `
    <header class="page-header"><p class="eyebrow">SCREEN DESIGN DOCUMENT</p>${status(meta.figma?.status || (isPending ? 'Figma 확인 대기 / 검토본' : '화면설계서'))}</header>
    <h1 class="cover-title">${escape(meta.title)}<br>화면설계서</h1>
    <p class="cover-subtitle">${escape(meta.subtitle || 'PROJECT.md와 Use Case를 화면 구조, 사용자 동작, 시스템 처리 및 결과로 연결')}</p>
    <div class="cover-meta"><div><label>팀</label>${escape(meta.team)}</div><div><label>작성 기준일</label>${escape(meta.date)}</div><div><label>버전</label>${escape(meta.version)}</div><div><label>Actor</label>${join(actors)}</div></div>
    <div class="cover-stats"><div><strong>${screenCount}</strong><span>주요 Screen ID</span></div><div><strong>${ucCount}</strong><span>연결된 Use Case</span></div><div><strong>${data.boards.length}</strong><span>주요 화면 · 상태 스토리보드</span></div></div>
    <section class="figma-block">${figmaContent(meta)}</section>` });

  const flowGroups = chunks(data.flows, 2);
  if (!flowGroups.length) flowGroups.push([]);
  flowGroups.forEach((flows, index) => {
    pages.push({ key: `flows-${index + 1}`, html: `${header('01 / SERVICE STRUCTURE', `Actor별 화면구성도${flowGroups.length > 1 ? ` (${index + 1}/${flowGroups.length})` : ''}`)}
      <p class="section-lead">메뉴와 버튼 선택에 따른 전체 흐름 · 세부 분기와 예외 동작은 각 Screen ID의 스토리보드에 표시</p>
      ${flows.map(flow => `<section class="flow-lane"><h3>${escape(flow.actor)}</h3><div class="flow-route">${list(flow.steps).map((step, stepIndex) => `${stepIndex ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}<div class="flow-step">${flowStep(step)}</div>`).join('')}</div>${flow.note ? `<p class="flow-note">${escape(flow.note)}</p>` : ''}</section>`).join('')}
      ${index === flowGroups.length - 1 ? `<div class="scope-summary"><section class="scope-card"><h3>구현 범위</h3><p>필수 · 선택 · 공통 기능의 구분은 화면 목록과 Use Case 연결표의 범위를 따름</p></section><section class="scope-card"><h3>화면 수 기준</h3><p>같은 작업 흐름의 탭, 팝업, 오류 상태는 하나의 주요 화면에 포함하며 필요한 상태만 별도로 설명</p></section><section class="scope-card"><h3>캡처 출처</h3><p>${escape(meta.captureSource || '로컬 웹 시안')}${meta.captureSource !== 'Figma' ? ' · Figma 캡처 반영 대기' : ' · 설명 번호는 PDF에서 표시'}</p></section></div>` : ''}` });
  });

  chunks(data.inventory, 4).forEach((rows, index, groups) => {
    pages.push({ key: `inventory-${index + 1}`, html: `${header('02 / SCREEN INVENTORY', `화면 목록 (${index + 1}/${groups.length})`, status(`${screenCount}개 주요 Screen ID`, true))}
      <p class="section-lead">화면 경로와 Actor를 고정하고, 관련 Use Case를 통해 요구사항을 추적</p>
      <table class="table"><colgroup><col style="width:12%"><col style="width:12%"><col style="width:14%"><col style="width:20%"><col style="width:21%"><col style="width:21%"></colgroup><thead><tr><th>Screen ID</th><th>Actor</th><th>화면명</th><th>관련 Use Case</th><th>화면 경로</th><th>범위</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.id)}</td><td>${join(row.actors, '<br>')}</td><td>${escape(row.name)}</td><td>${join(row.ucs, ', ') || '별도 UC ID 없음'}</td><td>${escape(row.path)}</td><td class="scope-cell">${escape(row.scope)}</td></tr>`).join('')}</tbody></table>` });
  });

  chunks(data.coverage, 12).forEach((rows, index, groups) => {
    pages.push({ key: `coverage-${index + 1}`, html: `${header('03 / REQUIREMENT TRACEABILITY', `Use Case와 화면 연결 (${index + 1}/${groups.length})`)}
      <p class="section-lead">Use Case마다 하나 이상의 화면 또는 화면 내 동작을 연결 · 선택 기능의 실제 구현 여부는 범위에 표시</p>
      <table class="table compact"><colgroup><col style="width:12%"><col style="width:28%"><col style="width:16%"><col style="width:24%"><col style="width:20%"></colgroup><thead><tr><th>Use Case</th><th>Use Case명</th><th>기능 ID</th><th>화면 / 화면 내 기능</th><th>구현 범위</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.uc)}</td><td>${escape(row.name)}</td><td>${escape(row.feature)}</td><td>${join(row.screen, '<br>')}</td><td>${escape(row.scope)}</td></tr>`).join('')}</tbody></table>` });
  });

  data.boards.forEach(board => {
    const markers = board.items.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)).map(item => `<span class="marker" style="left:${item.x}%;top:${item.y}%" title="${escape(item.title)}">${escape(item.n)}</span>`).join('');
    pages.push({ key: board.key || board.screenId, className: 'board', html: `${header(board.screenId, board.name, status(board.scope || '주요 화면', true))}
      <section class="metadata"><div><label>ACTOR</label>${join(board.actors)}</div><div><label>RELATED USE CASE</label>${join(board.ucs) || '별도 UC ID 없음'}</div><div><label>PATH</label>${escape(board.path)}</div></section>
      <div class="board-layout"><section class="capture-panel"><div class="capture-top"><span>${board.figma?.url ? `<a href="${escape(board.figma.url)}">Figma 원본 프레임</a>` : escape(meta.captureSource || '로컬 웹 시안')}</span><span>번호 ↔ 우측 동작 설명</span></div><div class="capture-stage"><div class="shot-wrap"><img src="${escape(pathToFileURL(imagePath(board.image)).href)}" alt="${escape(`${board.screenId} ${board.name}`)}">${markers}</div></div><p class="capture-caption">${escape(board.caption)}</p>${list(board.states).length ? `<section class="state-block"><h3>주요 상태와 예외 처리</h3><ul>${list(board.states).map(state => `<li>${escape(state)}</li>`).join('')}</ul></section>` : ''}</section>
      <section class="description${board.items.length >= 5 ? ' dense' : ''}${board.items.length >= 6 ? ' tight' : ''}"><div class="description-heading"><h3>Description</h3><span>행위 → 처리 → 결과</span></div><div class="description-items">${board.items.map(item => `<article class="description-item"><h3 class="item-title"><span class="number">${escape(item.n)}</span>${escape(item.title)}</h3><p class="behavior"><strong>${escape(item.action)}</strong><span class="arrow">→</span>${escape(item.process)}<span class="arrow">→</span>${escape(item.result)}${item.target ? `<span class="target">이동 / 연결: ${escape(item.target)}</span>` : ''}</p></article>`).join('')}</div></section></div>` });
  });

  chunks(data.checklist, 5).forEach((rows, index, groups) => {
    pages.push({ key: `checklist-${index + 1}`, html: `${header('05 / SUBMISSION CHECK', `제출 전 일관성 확인 (${index + 1}/${groups.length})`, status(isPending ? '검토본 · Figma 확인 대기' : '검증 기록', true))}
      <p class="section-lead">PROJECT.md → Use Case Diagram → 화면설계서 → Figma의 기능명, Actor, 범위 및 이동 흐름 확인</p>
      <table class="table checklist-table"><colgroup><col style="width:31%"><col style="width:17%"><col style="width:52%"></colgroup><thead><tr><th>확인 항목</th><th>현재 상태</th><th>증거 / 남은 확인</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.requirement)}</td><td>${status(row.status, true)}</td><td class="evidence">${escape(row.evidence)}</td></tr>`).join('')}</tbody></table>
      ${index === groups.length - 1 ? `<section class="figma-block">${figmaContent(meta)}</section>` : ''}` });
  });
  return pages;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(options.input, 'utf8'));
  validate(data);
  const fontPath = path.join(ROOT, '02_제품/화면시안/assets/PretendardVariable.woff2');
  if (!fs.existsSync(fontPath)) throw new Error(`Missing local Pretendard font: ${fontPath}`);
  const pages = makePages(data);
  const css = CSS.replace('__FONT_URL__', pathToFileURL(fontPath).href);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>${escape(data.meta.title)} 화면설계서</title><style>${css}</style></head><body>${pages.map((page, index) => `<section class="page ${page.className || ''}" data-page="${index + 1}" data-key="${escape(page.key)}">${page.html}<footer class="page-footer"><span>${escape(data.meta.team)} · ${escape(data.meta.title)} · ${escape(data.meta.version)}</span><span>${String(index + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}</span></footer></section>`).join('')}</body></html>`;
  for (const output of [options.html, options.output, options.report]) fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(options.html, html);
  const playwright = require(process.env.PLAYWRIGHT_MODULE || DEFAULT_PLAYWRIGHT);
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || DEFAULT_CHROME, headless: true });
  let report;
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const requests = [];
    page.on('request', request => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await page.goto(pathToFileURL(options.html).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
      for (const layout of document.querySelectorAll('.board-layout')) {
        const footerTop = layout.closest('.page').querySelector('.page-footer').getBoundingClientRect().top;
        layout.style.height = `${footerTop - layout.getBoundingClientRect().top - 20}px`;
      }
      for (const image of document.images) {
        const stage = image.closest('.capture-stage');
        if (!stage) continue;
        const available = stage.getBoundingClientRect();
        const scale = Math.min((available.width - 26) / image.naturalWidth, (available.height - 26) / image.naturalHeight);
        const wrap = image.parentElement;
        wrap.style.width = `${image.naturalWidth * scale}px`;
        wrap.style.height = `${image.naturalHeight * scale}px`;
      }
    });
    report = await page.evaluate(() => {
      const violations = [];
      for (const page of document.querySelectorAll('.page')) {
        const bounds = page.getBoundingClientRect();
        const footer = page.querySelector('.page-footer').getBoundingClientRect();
        for (const element of page.children) {
          if (element.classList.contains('page-footer')) continue;
          const box = element.getBoundingClientRect();
          if (box.bottom > footer.top - 8 || box.right > bounds.right - 56 || box.left < bounds.left + 56) {
            violations.push({ page: page.dataset.page, key: page.dataset.key, element: element.className || element.tagName, reason: 'outside page content bounds', box: { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height } });
          }
        }
        for (const element of page.querySelectorAll('.description-items,.flow-step,.table td,.figma-block')) {
          if (element.scrollHeight > element.clientHeight + 2 || element.scrollWidth > element.clientWidth + 2) {
            violations.push({ page: page.dataset.page, key: page.dataset.key, element: element.className || element.tagName, reason: 'content overflow' });
          }
        }
      }
      return { pageCount: document.querySelectorAll('.page').length, fontLoaded: document.fonts.check('20px Pretendard'), images: [...document.images].map(image => ({ source: image.src, width: image.naturalWidth, height: image.naturalHeight, loaded: image.complete && image.naturalWidth > 0 })), violations };
    });
    report.generatedAt = new Date().toISOString();
    report.input = path.relative(ROOT, options.input);
    report.inputSha256 = sha256(options.input);
    report.html = path.relative(ROOT, options.html);
    report.pdf = path.relative(ROOT, options.output);
    report.pageKeys = pages.map(page => page.key);
    report.figma = data.meta.figma || { url: null, status: '미확인' };
    report.captureSource = data.meta.captureSource || '로컬 웹 시안';
    report.networkRequests = requests;
    report.annotationGaps = data.boards.filter(board => !board.annotated && board.items.some(item => item.x == null || item.y == null)).map(board => board.key || board.screenId);
    if (!report.fontLoaded || report.images.some(image => !image.loaded) || report.violations.length || requests.length || report.annotationGaps.length) {
      fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
      throw new Error(`PDF validation failed: ${report.violations.length} overflow violations, font=${report.fontLoaded}, remoteRequests=${requests.length}, annotationGaps=${report.annotationGaps.length}; see ${options.report}`);
    }
    fs.writeFileSync(options.html, await page.content());
    await page.pdf({ path: options.output, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    report.pdfSha256 = sha256(options.output);
    report.pdfBytes = fs.statSync(options.output).size;
    fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ pdf: options.output, html: options.html, report: options.report, pages: report.pageCount, bytes: report.pdfBytes, annotationGaps: report.annotationGaps, figmaStatus: report.figma.status }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
