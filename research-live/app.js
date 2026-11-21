'use strict';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = n => `${(n * 100).toFixed(2)}%`;
const gain = n => `${n > 0 ? '+' : ''}${n.toFixed(2)} pp`;
const exact = (x, keys) => x && !Array.isArray(x) && typeof x === 'object' && Object.keys(x).sort().join() === keys.split(' ').sort().join();
function validateSnapshot(d) {
  const need = (ok) => { if (!ok) throw Error('公开快照校验失败，保留最近有效数据'); };
  const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  const phase = (p, total) => p === null || (exact(p, 'completed total complete') && integer(p.completed, total) && p.total === total && typeof p.complete === 'boolean' && (!p.complete || p.completed === total));
  need(exact(d, 'schema_version campaign experiment protocol generated_at source_observed_at source_state_sha256 models settings execution baseline rounds history_frozen final_results_sealed'));
  need(d.schema_version === 'harness_luna56_public_v1' && d.campaign === 'astra_luna_codecontests_v1' && d.experiment === 'luna56_single_history_v1');
  need(d.protocol === '03fcecb1df3560d54754019881e93e9811442d0ed0d622bfd7b906af35a29a86');
  need(exact(d.models, 'optimizer optimizer_reasoning solver solver_reasoning') && d.models.optimizer === 'gpt-6-astra' && d.models.optimizer_reasoning === 'high' && d.models.solver === 'gpt-5.6-luna' && d.models.solver_reasoning === 'medium');
  need(exact(d.settings, 'histories proposal_limit development_tasks validation_tasks validation_repeats validation_attempts final_tasks calibration_indices adoption_threshold_pp'));
  for (const [k, v] of Object.entries({histories:1,proposal_limit:10,development_tasks:256,validation_tasks:64,validation_repeats:3,validation_attempts:384,final_tasks:144,adoption_threshold_pp:1})) need(d.settings[k] === v);
  need(JSON.stringify(d.settings.calibration_indices) === '[0,3,6]');
  need(typeof d.history_frozen === 'boolean' && d.final_results_sealed === true && /^[0-9a-f]{64}$/.test(d.source_state_sha256));
  need(typeof d.source_observed_at === 'string' && typeof d.generated_at === 'string');
  const observed = Date.parse(d.source_observed_at), generated = Date.parse(d.generated_at);
  need(Number.isFinite(observed) && Number.isFinite(generated) && generated >= observed && generated - observed <= 120000 && generated <= Date.now() + 300000);
  need(exact(d.execution, 'state controller_alive workers') && ['running','halted','paused','stopped','finished'].includes(d.execution.state) && typeof d.execution.controller_alive === 'boolean' && integer(d.execution.workers,16));
  need(d.execution.state !== 'running' || d.execution.controller_alive);
  need(exact(d.baseline, 'development final_tests') && phase(d.baseline.development,256) && phase(d.baseline.final_tests,144));
  need(Array.isArray(d.rounds) && d.rounds.length <= 10);
  if(d.rounds.length) need(d.baseline.development?.complete && d.baseline.final_tests?.complete);
  let retained = 0;
  for (const [i,r] of d.rounds.entries()) {
    need(exact(r, 'round proposal_status complete adopted parent_round retained_round development validation final_tests calibration result'));
    need(r.round === i + 1 && r.parent_round === retained && typeof r.complete === 'boolean' && [true,false,null].includes(r.adopted));
    need(['meta_running','executable_candidate','invalid_proposal','technical_interruption','blocked'].includes(r.proposal_status));
    for (const [k,n] of Object.entries({development:256,validation:384,final_tests:144,calibration:192})) need(phase(r[k],n));
    need([3,6].includes(r.round) || r.calibration === null);
    if (i < d.rounds.length-1) need(r.complete);
    if (r.result !== null) {
      const v = r.result;
      need(exact(v,'parent_solved candidate_solved parent_mean candidate_mean gain_pp interval_pp parent_sd candidate_sd'));
      need(r.proposal_status === 'executable_candidate' && r.validation?.complete);
      for (const arm of ['parent','candidate']) {
        const a = v[arm+'_solved'];
        need(Array.isArray(a) && a.length === 3 && a.every(n => integer(n,64)));
        const mean = a.reduce((s,n) => s+n,0)/192;
        need(typeof v[arm+'_mean'] === 'number' && Math.abs(mean-v[arm+'_mean']) < 1e-12);
        const sd = Math.sqrt(a.reduce((s,n) => s+(n/64-mean)**2,0)/2);
        need(typeof v[arm+'_sd'] === 'number' && Math.abs(sd-v[arm+'_sd']) < 1e-12);
      }
      const net = v.candidate_solved.reduce((s,n)=>s+n,0)-v.parent_solved.reduce((s,n)=>s+n,0);
      need(typeof v.gain_pp === 'number' && Math.abs(v.gain_pp-net*100/192)<1e-10 && r.adopted === (net*100>192));
      need(Array.isArray(v.interval_pp) && v.interval_pp.length===2 && v.interval_pp.every(n=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=100) && v.interval_pp[0]<=v.gain_pp && v.gain_pp<=v.interval_pp[1]);
    } else need(r.adopted !== true);
    if (r.adopted) retained = r.round;
    need(r.retained_round === retained);
    if (r.complete) {
      need(r.adopted !== null);
      if (r.proposal_status === 'executable_candidate') need(r.result && r.development?.complete && r.validation?.complete && r.final_tests?.complete);
      else need(['invalid_proposal','technical_interruption'].includes(r.proposal_status) && r.adopted === false);
      if ([3,6].includes(r.round)) need(r.calibration?.complete);
    }
  }
  need(!d.history_frozen || (d.rounds.length===10 && d.rounds.every(r=>r.complete)));
  need(d.execution.state!=='finished' || d.history_frozen);
  return d;
}
function decision(r) {
  if (!r) return '尚未开始';
  if (r.adopted === true) return r.complete ? '已采用' : '已采用 · 收尾中';
  if (r.adopted === false) return r.complete ? '未采用' : '未采用 · 收尾中';
  return r.proposal_status === 'blocked' ? '已停发' : r.proposal_status === 'meta_running' ? '正在提案' : '评测中';
}
function currentPhase(d) {
  const r = d.rounds.at(-1);
  if (!r) return {round:0, phases:d.baseline, label:'原版基线'};
  return {round:r.round, phases:r, label:`第 ${r.round} 轮`};
}
function roundRows(d) {
  return Array.from({length:10},(_,i)=> {
    const r=d.rounds[i], v=r?.result;
    const stage=r && !r.complete ? ['development','validation','final_tests','calibration'].find(k=>r[k] && !r[k].complete) : null;
    const labels={development:'开发',validation:'验证',final_tests:'终测',calibration:'校准'};
    return `<tr><td><b>第 ${i+1} 轮</b><small>${r ? '父版 '+(r.parent_round ? '第 '+r.parent_round+' 轮' : '原版') : '—'}</small></td><td>${v ? v.parent_solved.join(' / ') : '—'}</td><td>${v ? v.candidate_solved.join(' / ') : '—'}</td><td>${v ? pct(v.parent_mean)+' → '+pct(v.candidate_mean) : '等待完整验证'}</td><td>${v ? gain(v.gain_pp) : '—'}</td><td class="${r?.adopted ? 'accepted' : ''}">${decision(r)}${stage ? `<small>${labels[stage]} ${r[stage].completed}/${r[stage].total}</small>` : ''}</td></tr>`;
  }).join('');
}
function chart(d, mode='gain') {
  const rows=d.rounds.filter(r=>r.result);
  if (!rows.length) return '<div class="chart-empty">等待首轮完整三次验证</div>';
  const w=740,left=66,right=70,top=40,h=top+rows.length*43+42;
  const vals=rows.flatMap(r=>r.result.interval_pp);
  const lo=mode==='gain' ? Math.min(-1,Math.floor(Math.min(...vals)-1)) : 0;
  const hi=mode==='gain' ? Math.max(2,Math.ceil(Math.max(...vals)+1)) : 100;
  const x=n=>left+(n-lo)/(hi-lo)*(w-left-right);
  let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${mode==='gain'?'每轮平均改善及95%区间':'每轮父版与候选正确率'}"><title>只显示完整三次验证；每轮与当前父版独立比较</title>`;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;s+=`<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="26" y2="${h-35}"/><text text-anchor="middle" x="${x(v)}" y="${h-10}">${v.toFixed(1)}${mode==='gain'?' pp':'%'}</text>`;}
  if(mode==='gain') s+=`<line class="axis" x1="${x(0)}" x2="${x(0)}" y1="26" y2="${h-35}"/><line class="threshold" x1="${x(1)}" x2="${x(1)}" y1="26" y2="${h-35}"/><text x="${x(1)+5}" y="15">采用须 &gt; +1 pp</text>`;
  rows.forEach((r,i)=>{const v=r.result,y=top+i*43+10,c=r.adopted?'#497965':'#7e8d9e';s+=`<text x="0" y="${y+4}">第 ${r.round} 轮</text>`;
    const title=`第 ${r.round} 轮：父版 ${pct(v.parent_mean)}，候选 ${pct(v.candidate_mean)}；改善 ${gain(v.gain_pp)}；父版/候选重复标准差 ${(v.parent_sd*100).toFixed(2)}/${(v.candidate_sd*100).toFixed(2)} pp；95%区间 [${v.interval_pp.map(n=>n.toFixed(2)).join(', ')}] pp；${decision(r)}`;
    if(mode==='gain')s+=`<line x1="${x(v.interval_pp[0])}" x2="${x(v.interval_pp[1])}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="2"/><circle tabindex="0" cx="${x(v.gain_pp)}" cy="${y}" r="5" fill="${c}" aria-label="${esc(title)}"><title>${esc(title)}</title></circle><text class="chart-value" x="${w-right+12}" y="${y+4}">${gain(v.gain_pp)}</text>`;
    else s+=`<line x1="${x(v.parent_mean*100)}" x2="${x(v.candidate_mean*100)}" y1="${y}" y2="${y}" stroke="#aab5c1" stroke-width="2"/><circle cx="${x(v.parent_mean*100)}" cy="${y}" r="5" fill="#aab5c1"><title>父版 ${pct(v.parent_mean)}</title></circle><circle tabindex="0" cx="${x(v.candidate_mean*100)}" cy="${y}" r="4" fill="#497965" aria-label="${esc(title)}"><title>${esc(title)}</title></circle><text class="chart-value" x="${w-right+12}" y="${y+4}">${pct(v.candidate_mean)}</text>`;
  });return s+'</svg>';
}
let snapshot=null,fetching=false;
const $=id=>document.getElementById(id);
function render(){
 const d=snapshot,c=currentPhase(d),last=[...d.rounds].reverse().find(r=>r.result),decided=d.rounds.filter(r=>r.adopted!==null);
 $('stat-iterations').textContent=`${d.rounds.filter(r=>r.complete).length} / 10`;
 $('stat-accepted').textContent=d.rounds.filter(r=>r.adopted).length;
 $('stat-accepted-note').textContent=`${decided.length} 次已完成验证决策`;
 $('stat-validation').textContent=last?pct(last.result.candidate_mean):'—';
 $('stat-validation-note').textContent=last?`第 ${last.round} 轮候选 · ${decision(last)}`:'等待首轮完整验证';
 $('stat-workers').textContent=d.execution.workers;
 $('current-round').textContent=c.label;
 const names={development:'开发评测',validation:'三次父子验证',final_tests:'独立终测',calibration:'原版校准'};
 const keys=c.round?['development','validation','final_tests',...([3,6].includes(c.round)?['calibration']:[])]:['development','final_tests'];
 $('phase-progress').innerHTML=keys.map(k=>{const p=c.phases[k];return `<div class="phase-card"><h3>${names[k]}</h3><strong>${p ? p.completed+' / '+p.total : '尚未开始'}</strong><small>${p?.complete?'已完成':p?(d.execution.state==='running'?'正在保存评测结果':'未完成 · 当前未继续派发'):'等待前序阶段'}</small><progress value="${p?.completed||0}" max="${p?.total||1}" aria-label="${names[k]}完成数"></progress></div>`;}).join('');
 $('progress-note').textContent=c.round?`本轮${decision(d.rounds.at(-1))}；当前保留${d.rounds.at(-1).retained_round?'第 '+d.rounds.at(-1).retained_round+' 轮版本':'原版 Harness'}。`:'原版重新测量，不引用旧模型成绩。';
 $('quality-chart').innerHTML=chart(d,$('chart-mode').value);
 $('round-rows').innerHTML=roundRows(d);
 const done=(d.baseline.final_tests?.completed||0)+d.rounds.reduce((s,r)=>s+(r.final_tests?.completed||0),0);
 $('sealed-progress').textContent=`已保存 ${done} 次独立终测结果，分数继续封存。${d.history_frozen?'10 轮历史已冻结，等待最终审核。':'10 轮历史尚未全部冻结。'}`;
 updateFreshness();
}
function updateFreshness(){
 if(!snapshot)return;
 const d=snapshot,age=(Date.now()-Date.parse(d.source_observed_at))/60000,fresh=age>=-5&&age<=45;
 const states={running:d.execution.workers?'模型评测运行中':d.rounds.at(-1)?.proposal_status==='meta_running'?'实验运行中 · Astra 正在提出改动':'实验运行中 · 正在切换阶段',halted:'已停发，正在核对故障',paused:'已按计划暂停',stopped:'当前未发现运行进程',finished:'10 轮已完成，等待最终审核'};
 $('connection-label').textContent=fresh?'已同步真实快照':'快照较旧 · 状态待核验';
 $('status-dot').className='dot '+(fresh&&['running','finished'].includes(d.execution.state)?'fresh':'stale');
 $('run-status').textContent=states[d.execution.state]+(fresh?'':' · 以下为最近记录');
 $('freshness').textContent='源状态 / 快照：'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d.source_observed_at))+'（北京时间）';
}
async function refresh(){
 if(fetching)return;fetching=true;$('refresh').disabled=true;
 try{const r=await fetch('data/latest.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('快照读取失败');const d=validateSnapshot(await r.json());if(snapshot&&Date.parse(d.source_observed_at)<Date.parse(snapshot.source_observed_at))throw Error('收到较旧快照，继续显示最近数据');snapshot=d;$('load-error').hidden=true;render();}
 catch(e){$('load-error').textContent='暂时无法获取新的有效快照；已有数据保持不变。'+e.message;$('load-error').hidden=false;}
 finally{fetching=false;$('refresh').disabled=false;}
}
if(typeof document!=='undefined'){$('refresh').addEventListener('click',refresh);$('chart-mode').addEventListener('change',()=>{if(snapshot)render();});refresh();setInterval(refresh,60000);setInterval(updateFreshness,15000);}
if(typeof module!=='undefined')module.exports={validateSnapshot,chart,roundRows,decision,currentPhase,esc};
