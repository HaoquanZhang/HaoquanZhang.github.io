'use strict';

const COLORS = { development: '#227763', validation: '#b96234', meta: '#8d79a8', control: '#a8b3ae' };
const METRICS = { effective_lines: '有效代码行', characters: '字符数', functions: '函数数', branch_nodes: '分支节点', loop_nodes: '循环节点' };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = value => finite(value) ? value.toLocaleString('zh-CN') : '—';
const percent = value => finite(value) ? (value * 100).toFixed(1) + '%' : '—';
const compact = value => !finite(value) ? '—' : value >= 1e6 ? (value / 1e6).toFixed(2) + 'M' : value >= 1e3 ? (value / 1e3).toFixed(1) + 'k' : count(value);
const minutes = value => !finite(value) ? '—' : (value / 60).toFixed(1) + ' 分钟';
const fullScore = score => score?.state === 'complete' && score.completed === score.total && finite(score.rate) ? score.rate : null;
const scoreText = score => finite(fullScore(score)) ? `${percent(score.rate)} <small>(${count(score.resolved)}/${count(score.total)})</small>` : '—';
const allGenerations = data => data.repeats.flatMap(r => r.generations);
const finalIsReleased = data => data.final_evaluation?.state === 'released' && data.final_evaluation?.lineages_frozen === true;
const tipAttributes = (title, value, lines = []) => `class="chart-point" tabindex="0" role="img" aria-label="${esc(title + '：' + value + '；' + lines.join('；'))}" data-chart-tip="${esc(JSON.stringify({ title, value, lines }))}"`;
function validateSnapshot(data) {
  if (data?.schema_version !== 'harness_research_public_v1' || !Array.isArray(data.repeats) || !data.final_evaluation || !Array.isArray(data.datasets)) throw new Error('快照格式暂不受支持');
  if (!Number.isFinite(Date.parse(data.generated_at))) throw new Error('快照缺少有效时间');
  for (const r of data.repeats) if (!Array.isArray(r.generations)) throw new Error('版本记录不完整');
  // Publication validates the complete allowlist too. UI never reveals sealed scores.
  if (!finalIsReleased(data) && (data.final_evaluation.id_score != null || data.final_evaluation.ood_score != null || data.final_evaluation.curves?.length)) throw new Error('快照包含尚未解锁的最终结果');
  return data;
}

function lineChart(series, { maxX = 6, maxY = 1, percentAxis = true, empty = '等待完整结果', future = true, yLabel = '通过率', pointLabels = false, width = null } = {}) {
  const usable = series.map(s => ({ ...s, points: s.points.filter(p => finite(p.x) && finite(p.y)) }));
  if (!usable.some(s => s.points.length)) return `<div class="chart-empty">${esc(empty)}<small>暂无可绘制的数据</small></div>`;
  const w = width || (typeof window !== 'undefined' && window.innerWidth < 700 ? 360 : 720), h = 246, left = 42, right = 20, top = 20, bottom = 33;
  const x = v => left + (w - left - right) * v / Math.max(1, maxX);
  const y = v => h - bottom - (h - top - bottom) * v / Math.max(maxY, 1e-9);
  const latest = Math.max(...usable.flatMap(s => s.points.map(p => p.x)));
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(yLabel)}随代数变化"><title>${esc(yLabel)}随代数变化</title>`;
  if (future && latest < maxX) svg += `<rect x="${x(latest) + 8}" y="${top}" width="${Math.max(0, x(maxX) - x(latest) - 8)}" height="${h - top - bottom}" fill="#f0f3ed" opacity=".65"/><text class="future" text-anchor="middle" x="${x(latest + (maxX - latest) / 2)}" y="${top + 27}">后续轮次</text>`;
  for (let i = 0; i <= 4; i++) { const val = maxY * i / 4; svg += `<line class="grid" x1="${left}" x2="${w - right}" y1="${y(val)}" y2="${y(val)}"/><text text-anchor="end" x="${left - 10}" y="${y(val) + 4}">${percentAxis ? (val * 100).toFixed(0) + '%' : Math.round(val)}</text>`; }
  svg += `<line class="axis" x1="${left}" x2="${w - right}" y1="${h - bottom}" y2="${h - bottom}"/>`;
  for (let i = 0; i <= maxX; i++) svg += `<text text-anchor="middle" x="${x(i)}" y="${h - 12}">${i === 0 ? 'H0' : 'G' + i}</text>`;
  for (const s of usable) {
    if (s.line !== false && s.points.length > 1) {
      // Break paths across missing generations; do not fabricate continuity.
      let d = ''; let previous = null;
      for (const p of s.points) { d += `${previous !== null && p.x === previous + 1 ? 'L' : 'M'}${x(p.x)},${y(p.y)} `; previous = p.x; }
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"${s.dashed ? ' stroke-dasharray="4 4"' : ''}/>`;
    }
    for (const p of s.points) {
      const title = `${p.x === 0 ? 'H0 · 基线' : 'G' + p.x} · ${s.label}`;
      const value = percentAxis ? percent(p.y) : count(p.y);
      svg += `<circle ${tipAttributes(title, value, p.details || [])} cx="${x(p.x)}" cy="${y(p.y)}" r="${s.hollow ? 6 : 4}" fill="${s.hollow ? '#fff' : s.color}" stroke="${s.color}" stroke-width="1.8"/>`;
      if (pointLabels) svg += `<text class="chart-value" text-anchor="${p.x === 0 ? 'start' : 'middle'}" x="${x(p.x) + (p.x === 0 ? 10 : 0)}" y="${y(p.y) - 12}">${percentAxis ? percent(p.y) : count(p.y)}</text>`;
    }
  }
  return svg + '</svg>';
}

function qualitySeries(generations) {
  const series = [];
  for (const split of ['development', 'validation']) {
    const label = split === 'development' ? '开发' : '验证';
    const point = (g, arm, candidate) => ({ x:g.generation, y:fullScore(arm?.[split]), details:[
      `${count(arm?.[split]?.resolved)} / ${count(arm?.[split]?.total)} 题通过`,
      candidate ? (g.accepted === true ? '本轮候选已采纳' : g.accepted === false ? '本轮候选未采纳' : '候选评测完成，等待决策') : '本轮结束后保留的版本',
      `版本 ${arm?.harness_id || '待记录'}`,
      `评测协议 ${arm?.protocol_version || '待记录'}`
    ] });
    series.push({ label: label + '候选', color: COLORS[split], hollow: true, line: false, points: generations.filter(g => g.candidate?.state === 'complete').map(g => point(g,g.candidate,true)) });
    series.push({ label: label + '保留版本', color: COLORS[split], points: generations.filter(g => g.state === 'complete' || g.state === 'failed').map(g => point(g,g.adopted,false)) });
  }
  return series;
}

function timingChart(generations, width = null) {
  const entries = generations.map(g => ({ g, parts: [
    { label: '提出改动', value: g.meta?.state === 'complete' ? g.meta.wall_seconds : null, color: COLORS.meta },
    { label: g.generation === 0 ? '基线评测' : '候选评测', value: (g.generation === 0 ? g.h0 : g.candidate)?.state === 'complete' ? (g.generation === 0 ? g.h0 : g.candidate).wall_seconds : null, color: COLORS.development },
    { label: 'H0 校准', value: g.generation > 0 && g.h0?.state === 'complete' ? g.h0.wall_seconds : null, color: COLORS.control }
  ] })).filter(e => e.parts.some(p => finite(p.value)));
  if (!entries.length) return '<div class="chart-empty">等待完整计时</div>';
  const w = width || (typeof window !== 'undefined' && window.innerWidth < 700 ? 360 : 600), h = Math.max(220, 54 * entries.length + 45), left = 35, right = 105, plot = w - left - right;
  const max = Math.max(1, ...entries.map(e => e.parts.reduce((sum, p) => sum + (finite(p.value) ? p.value : 0), 0)));
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="各轮已测量阶段的墙钟耗时"><title>各轮已测量阶段的墙钟耗时，分钟</title>`;
  for (let i = 0; i <= 4; i++) { const x = left + plot * i / 4; svg += `<line class="grid" x1="${x}" x2="${x}" y1="10" y2="${h - 30}"/><text text-anchor="middle" x="${x}" y="${h - 10}">${(max / 60 * i / 4).toFixed(1)}</text>`; }
  entries.forEach(({ g, parts }, index) => {
    const y = 20 + index * 48; let offset = left;
    svg += `<text x="0" y="${y + 17}">${g.generation === 0 ? 'H0' : 'G' + g.generation}</text>`;
    for (const p of parts) if (finite(p.value)) { const width = p.value / max * plot; svg += `<rect ${tipAttributes((g.generation === 0 ? 'H0' : 'G'+g.generation)+' · '+p.label,minutes(p.value),['实际测量的阶段墙钟时间',`${p.value.toFixed(1)} 秒`])} x="${offset}" y="${y}" width="${width}" height="25" fill="${p.color}" rx="1"/>`; offset += width; }
    const missing = g.generation > 0 && (!finite(g.candidate?.wall_seconds) || !finite(g.meta?.wall_seconds) || (g.h0 && !finite(g.h0.wall_seconds)));
    const sum = parts.reduce((a, p) => a + (finite(p.value) ? p.value : 0), 0);
    svg += `<text class="small" x="${offset + 9}" y="${y + 17}">${(sum / 60).toFixed(1)} 分${missing ? ' · 部分阶段' : ''}</text>`;
  });
  return svg + '</svg>';
}

let snapshot = null, activeRepeat = 0, metric = 'effective_lines', fetchRunning = false;
const $ = id => document.getElementById(id);
const chartWidth = id => Math.max(280, Math.round($(id).getBoundingClientRect().width));
function render() {
  hideTooltip();
  const data = snapshot;
  const repeat = data.repeats.find(r => r.repeat === activeRepeat) || data.repeats[0];
  activeRepeat = repeat.repeat;
  const generations = repeat.generations;
  const done = allGenerations(data).filter(g => g.generation > 0 && ['complete', 'failed'].includes(g.state));
  const latestAdopted = [...generations].reverse().find(g => g.adopted?.state === 'complete')?.adopted;
  const h0 = generations.find(g => g.generation === 0)?.h0;
  const best = fullScore(latestAdopted?.validation), base = fullScore(h0?.validation);
  $('stat-iterations').innerHTML = `${count(done.length)} <em>/ ${count(data.planned_repeats * data.planned_generations_per_repeat)}</em>`;
  $('stat-plan').textContent = `${count(data.planned_repeats)} 组实验 × 最多 ${count(data.planned_generations_per_repeat)} 轮`;
  $('stat-validation').textContent = percent(best);
  $('stat-validation-note').textContent = finite(best) ? `${count(latestAdopted.validation.resolved)}/${count(latestAdopted.validation.total)} 题 · ${finite(base) ? '较 H0 ' + ((best - base) * 100 >= 0 ? '+' : '') + ((best - base) * 100).toFixed(1) + ' 个百分点' : '等待基线'}` : '本组尚未开始评测';
  const accepted = done.filter(g => g.accepted === true).length;
  $('stat-accepted').innerHTML = `${count(accepted)} <em>/ ${count(done.length)}</em>`;
  $('stat-accepted-note').textContent = done.length ? '采纳 / 已完成决策' : '等待首个完整决策';
  $('stat-workers').innerHTML = `${count(data.workers)} <em>并发</em>`;
  $('stat-workers-note').textContent = finite(data.current?.peak_concurrent_episodes) ? `当前批次实测峰值 ${count(data.current.peak_concurrent_episodes)}` : '配置上限 · 本批峰值待记录';
  $('repeat-tabs').innerHTML = data.repeats.map(r => `<button type="button" data-repeat="${r.repeat}" aria-pressed="${r.repeat === activeRepeat}">实验 ${r.repeat + 1}</button>`).join('');
  $('repeat-condition').textContent = repeat.conditions === 'mixed_protocol_continuation' ? '实验 1：承接旧协议的基线与首轮提案；G1 候选开始使用 8 并发，G2 起启用精简反馈。' : '实验 2：从 H0 独立开始，全程使用新版协议；与实验 1 顺序执行。';
  $('quality-chart').innerHTML = lineChart(qualitySeries(generations), { maxX: data.planned_generations_per_repeat || 6, width:chartWidth('quality-chart') });
  const pending = generations.find(g => g.generation > 0 && g.state === 'incomplete');
  $('quality-note').textContent = pending ? `G${pending.generation} 候选${pending.candidate ? `已完成 ${count(pending.candidate.completed)}/${count(pending.candidate.total)} 题` : '正在提出改动'}，整批完成后加入曲线。实心点与连线表示每轮保留的版本。` : '实心点与连线表示保留版本；空心点表示每轮候选。不同独立实验分别查看。';
  renderFinal(data);
  $('timing-chart').innerHTML = timingChart(generations,chartWidth('timing-chart'));
  const measured = [...generations].reverse().find(g => (g.candidate?.state === 'complete' && finite(g.candidate.episode_work_seconds)) || (g.generation === 0 && finite(g.h0?.episode_work_seconds)));
  const work = measured?.candidate?.state === 'complete' ? measured.candidate : measured?.h0;
  $('work-generation').textContent = measured ? measured.generation === 0 ? 'H0 · 累计工作时间' : `G${measured.generation} · 候选累计工作时间` : '等待计时';
  const categories = [ ['API 等待', work?.api_wait_work_seconds], ['工具执行', work?.tool_work_seconds], [finite(work?.judge_total_work_seconds) ? '判题全流程' : '判题命令', work?.judge_total_work_seconds ?? work?.judge_command_work_seconds], ['环境准备', work?.environment_prepare_work_seconds] ];
  const known = categories.filter(([,value]) => finite(value));
  const residual = finite(work?.episode_work_seconds) ? work.episode_work_seconds - known.reduce((s,[,v]) => s + v, 0) : null;
  if (finite(residual) && residual >= 0) categories.push(['其他 / 未拆分', residual]);
  $('work-breakdown').innerHTML = work ? categories.map(([label,value]) => `<div class="work-row"><span>${label}</span><span class="track"><i style="width:${finite(value) && work.episode_work_seconds > 0 ? Math.min(100, value / work.episode_work_seconds * 100) : 0}%"></i></span><span class="work-number">${finite(value) ? (value / 60).toFixed(1) + ' 分' : '未记录'}</span></div>`).join('') : '<div class="chart-empty">等待评测计时</div>';
  const t = data.totals || {};
  $('cost-metrics').innerHTML = [
    ['Luna 输出 Token', compact(t.solver_output_tokens), `输入 ${compact(t.solver_input_tokens)} · 完成的评测调用`],
    ['Astra 输出 Token', compact(t.meta_output_tokens), `输入 ${compact(t.meta_input_tokens)} · ${count(t.meta_model_calls)} 次调用`],
    ['执行异常率', percent(t.episode_error_rate), `${count(t.episode_errors)}/${count(t.evaluated_episodes)} 次已完成评测`],
    ['货币成本', t.monetary_cost == null ? '未计价' : esc(t.monetary_cost), 'Token 与耗时分别保留']
  ].map(([label,value,note]) => `<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  renderComplexity(generations, data);
  renderJournal(generations);
  $('protocol-version').textContent = data.protocol_version === 'performance_v2' ? '协议 v2 · 8 并发' : '协议 ' + (data.protocol_version || '待确认');
  $('control-schedule').textContent = `H0 在第 ${(data.control_schedule || []).join('、')} 代校准；旧协议的额外校准保留在记录中`;
  const roles = { development: '开发', validation: '验证', final_id: '最终 ID', ood: '最终 OOD' };
  $('datasets').innerHTML = data.datasets.map(d => `<div class="dataset-row"><span>${esc(roles[d.role] || d.role)}</span><span>${esc(d.benchmark)}${d.state === 'sealed' ? `<small>候选 ${count(d.selected_candidates)} 题 · 环境就绪 ${count(d.runtime_qualified_candidates)} 题</small>` : ''}</span><span>${d.frozen_tasks == null ? '待冻结' : count(d.frozen_tasks) + ' 题'}</span></div>`).join('');
  updateFreshness();
}

function renderComplexity(generations, data) {
  const points = generations.map(g => ({ x: g.generation, y: g.code?.[metric], details:[g.generation === 0 ? '初始固定 Harness' : '当轮候选 Harness',`版本 ${g.harness_id || '待记录'}`,finite(g.code?.added_lines) ? `相对父版本 +${g.code.added_lines} / −${g.code.deleted_lines} 行` : '无父版本差分'] }));
  const max = Math.max(1, ...points.map(p => finite(p.y) ? p.y : 0));
  $('complexity-chart').innerHTML = lineChart([{ label: METRICS[metric], color: COLORS.development, points }], { maxX: data.planned_generations_per_repeat || 6, maxY: Math.ceil(max * 1.2 / 4) * 4, percentAxis: false, yLabel: METRICS[metric], pointLabels: true, width:chartWidth('complexity-chart') });
  const latest = [...generations].reverse().find(g => g.code);
  const code = latest?.code || {};
  $('code-metrics').innerHTML = [['有效代码行','effective_lines'],['字符数','characters'],['函数','functions'],['分支节点','branch_nodes'],['循环节点','loop_nodes'],['UTF-8 字节','bytes']].map(([label,key]) => `<div><span>${label}</span><strong>${count(code[key])}</strong></div>`).join('');
  $('code-change').textContent = latest ? `${latest.generation === 0 ? 'H0' : 'G' + latest.generation} · ${latest.harness_id || '待冻结'}${finite(code.added_lines) ? ` · 相对父版本 +${code.added_lines} / −${code.deleted_lines} 行` : ''}` : '本组暂无 Harness 记录';
}

function renderJournal(generations) {
  const opened = new Set([...document.querySelectorAll('.generation-entry[open]')].map(d => d.dataset.key));
  $('generation-log').innerHTML = [...generations].reverse().map(g => {
    const baseline = g.generation === 0;
    const arm = baseline ? g.h0 : g.candidate;
    const status = baseline ? '基线' : g.state === 'failed' ? '提案失败' : g.state === 'incomplete' ? '进行中' : g.accepted ? '已采纳' : '保留原版';
    const shortSummary = baseline ? '初始固定 Harness' : g.public_change_summary || '改动摘要待整理';
    const key = `${activeRepeat}-${g.generation}`;
    const completeArm = arm?.state === 'complete';
    let result = baseline ? '已完成基线评测，作为后续迭代的参照。' : g.state === 'incomplete' ? `本轮尚未完成决策${arm ? `；评测完成 ${count(arm.completed)}/${count(arm.total)} 题` : ''}。` : g.accepted ? '候选被采纳，成为下一轮的父版本。' : '本轮候选未被采纳，下一轮沿用之前保留的版本。';
    if (completeArm) result += ` 开发 ${count(arm.development?.resolved)}/${count(arm.development?.total)}，验证 ${count(arm.validation?.resolved)}/${count(arm.validation?.total)}。`;
    return `<details class="generation-entry" data-key="${key}"${opened.has(key) ? ' open' : ''}><summary class="generation-row"><span class="version-cell"><strong>${baseline ? 'H0' : 'G' + g.generation}</strong><span class="state ${g.accepted ? 'accepted' : g.state === 'incomplete' ? 'pending' : ''}">${status}</span></span><span>${completeArm ? percent(fullScore(arm?.development)) : '—'}</span><span>${completeArm ? percent(fullScore(arm?.validation)) : '—'}</span><span>${count(g.code?.effective_lines)}</span><span class="row-summary">${esc(shortSummary)}</span></summary><div class="log-body"><div class="log-meta">${esc(g.harness_id || '待生成版本')}<br>${g.parent_id ? '← ' + esc(g.parent_id) : '初始版本'}<br>${esc(g.protocol_version || '待记录')}</div><div class="log-copy"><p><b>依据与改动</b>${esc(baseline ? '使用最初的固定执行流程，建立质量、耗时和代码结构基线。' : g.public_change_summary || '等待审核后的方法摘要。')}</p><p><b>实际结果</b>${esc(result)}</p><p><b>耗时</b>${baseline ? '基线评测 ' + minutes(arm?.wall_seconds) : '提出改动 ' + minutes(g.meta?.wall_seconds) + '；候选评测 ' + minutes(arm?.wall_seconds)}${finite(arm?.elapsed_observed_seconds) ? '；截至快照已运行 ' + minutes(arm.elapsed_observed_seconds) : ''}。</p></div></div></details>`;
  }).join('') || '<div class="chart-empty">本组尚未开始</div>';
}

function renderFinal(data) {
  const released = finalIsReleased(data);
  $('final-badge').textContent = released ? '已解锁' : '待解锁';
  if (released && Array.isArray(data.final_evaluation.curves)) {
    const curves = data.final_evaluation.curves.filter(c => c.repeat === activeRepeat);
    $('final-chart').innerHTML = lineChart(['id','ood'].map((key,i) => ({ label: key.toUpperCase(), color: i ? COLORS.validation : COLORS.development, points: curves.map(c => ({ x: c.generation, y: c[key + '_score'],details:['冻结版本的最终评测'] })) })), { maxX: data.planned_generations_per_repeat || 6, future: false,width:chartWidth('final-chart') });
    $('final-note').textContent = '版本序列已冻结。绿色为最终 ID，橙色为 OOD，按冻结版本统一评测。';
  } else {
    $('final-chart').innerHTML = [['最终 ID','SWE-bench Pro v2'],['最终 OOD','Terminal-Bench v4.1.0']].map(([name,bench]) => `<div class="final-item"><h4>${name}</h4><strong>— —</strong><p>${bench}</p></div>`).join('');
    $('final-note').textContent = data.final_evaluation.lineages_frozen ? '版本序列已冻结，等待最终结果审核发布。' : '整条版本序列冻结后，统一评测 ID / OOD 并补全逐代曲线。';
  }
}

function formatDate(iso) { const date = new Date(iso); return Number.isNaN(date.valueOf()) ? '未知' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(date); }
function updateFreshness() {
  if (!snapshot) return;
  const data = snapshot, cur = data.current || {};
  const sourceAge = (Date.now() - Date.parse(data.source_heartbeat_at)) / 60000;
  const fresh = Number.isFinite(sourceAge) && sourceAge <= 45 && sourceAge >= -5;
  const stopped = data.phase === 'campaign_stopped_with_recorded_error';
  $('status-dot').className = 'dot ' + (fresh && !stopped ? 'fresh' : 'stale');
  $('connection-label').textContent = stopped ? '研究已停止 · 已记录异常' : fresh ? '研究快照 · 已同步' : '快照较旧 · 状态待核验';
  const stage = { solver_evaluation:'正在评测候选', meta_proposal:'正在提出改动', resuming:'正在恢复', capacity_and_targeted_tests:'正在检查运行环境' }[cur.stage] || '等待阶段信息';
  const phase = data.phase === 'all_lineages_frozen_final_evaluation_pending' ? '版本序列已冻结 · 最终评测准备中' : stopped ? '研究已停止，等待处理已记录的异常' : `${finite(cur.repeat) ? '实验 ' + (cur.repeat + 1) + ' · ' : ''}${finite(cur.generation) ? '第 ' + cur.generation + ' 轮 · ' : ''}${stage}${finite(cur.completed) && finite(cur.total) ? ` ${cur.completed}/${cur.total}` : ''}`;
  $('run-status').innerHTML = `<b>${esc(phase)}</b>${fresh ? '' : ' · 以上为最近一次记录'}`;
  $('freshness').textContent = `源状态 ${formatDate(data.source_heartbeat_at)} · 快照 ${formatDate(data.generated_at)}（北京时间）`;
  $('publish-note').textContent = '约每 30 分钟同步 · 网页每 60 秒检查更新';
}

async function refresh() {
  if (fetchRunning) return;
  fetchRunning = true; $('refresh').disabled = true;
  try {
    const response = await fetch('data/latest.json?t=' + Date.now(), { cache:'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`数据请求失败（${response.status}）`);
    const next = validateSnapshot(await response.json());
    if (snapshot && Date.parse(next.generated_at) < Date.parse(snapshot.generated_at)) throw new Error('返回了更早的快照，继续保留当前数据');
    snapshot = next; $('load-error').hidden = true; render();
  } catch (error) {
    $('load-error').textContent = `${snapshot ? '更新暂未成功，保留上一份快照。' : '暂时无法读取研究数据。'}${error.name === 'TimeoutError' ? '请求超时。' : error.message} 可点击“刷新数据”重试。`;
    $('load-error').hidden = false; $('connection-label').textContent = '数据连接待恢复'; $('status-dot').className = 'dot stale';
  } finally { fetchRunning = false; $('refresh').disabled = false; }
}

let tooltipTarget = null;
function hideTooltip() {
  if (typeof document === 'undefined') return;
  if (tooltipTarget) tooltipTarget.removeAttribute('aria-describedby');
  tooltipTarget = null;
  const tip = $('chart-tooltip'); if (tip) tip.hidden = true;
}
function showTooltip(target, clientX, clientY) {
  const data = JSON.parse(target.dataset.chartTip);
  const tip = $('chart-tooltip');
  if (tooltipTarget && tooltipTarget !== target) tooltipTarget.removeAttribute('aria-describedby');
  tooltipTarget = target;
  target.setAttribute('aria-describedby','chart-tooltip');
  tip.innerHTML = `<strong>${esc(data.title)}</strong><div class="tip-value">${esc(data.value)}</div>${data.lines.map(line=>`<p>${esc(line)}</p>`).join('')}`;
  tip.hidden = false;
  const box = target.getBoundingClientRect();
  const x = finite(clientX) ? clientX : box.left + box.width / 2;
  const y = finite(clientY) ? clientY : box.top;
  const bounds = tip.getBoundingClientRect();
  tip.style.left = Math.max(12,Math.min(x + 14,window.innerWidth - bounds.width - 12)) + 'px';
  tip.style.top = Math.max(12,y + bounds.height + 24 > window.innerHeight ? y - bounds.height - 14 : y + 14) + 'px';
}

function selectSection(id) {
  document.querySelectorAll('.section-nav a').forEach(link=>{
    if (link.dataset.section === id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('.margin-note').forEach(note=>note.classList.toggle('is-active',note.dataset.note === id));
}

if (typeof document !== 'undefined') {
  $('refresh').addEventListener('click', refresh);
  $('repeat-tabs').addEventListener('click', e => { const button = e.target.closest('button[data-repeat]'); if (button) { activeRepeat = Number(button.dataset.repeat); render(); } });
  $('complexity-metric').addEventListener('change', e => { metric = e.target.value; if (snapshot) renderComplexity(snapshot.repeats.find(r => r.repeat === activeRepeat).generations, snapshot); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  document.addEventListener('pointerover',event=>{const point=event.target.closest?.('[data-chart-tip]');if(point)showTooltip(point,event.clientX,event.clientY);});
  document.addEventListener('pointermove',event=>{if(tooltipTarget && event.target.closest?.('[data-chart-tip]') === tooltipTarget)showTooltip(tooltipTarget,event.clientX,event.clientY);});
  document.addEventListener('pointerout',event=>{if(event.target.closest?.('[data-chart-tip]') && !event.relatedTarget?.closest?.('[data-chart-tip]'))hideTooltip();});
  document.addEventListener('focusin',event=>{const point=event.target.closest?.('[data-chart-tip]');if(point)showTooltip(point);});
  document.addEventListener('focusout',event=>{if(event.target.closest?.('[data-chart-tip]'))hideTooltip();});
  document.addEventListener('click',event=>{const point=event.target.closest?.('[data-chart-tip]');if(point)showTooltip(point);else hideTooltip();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
  window.addEventListener('scroll',hideTooltip,{passive:true});
  document.querySelector('.section-nav').addEventListener('click',event=>{const link=event.target.closest('a[data-section]');if(link)selectSection(link.dataset.section);});
  const sections = [...document.querySelectorAll('main > .section')];
  const observer = new IntersectionObserver(entries=>{
    const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
    if(visible[0])selectSection(visible[0].target.id);
  },{rootMargin:'-8% 0px -65% 0px',threshold:0});
  sections.forEach(section=>observer.observe(section));
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (snapshot) render(); }, 150); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  refresh();
}
if (typeof module !== 'undefined') module.exports = { validateSnapshot, fullScore, qualitySeries, lineChart, timingChart, finalIsReleased, esc };
