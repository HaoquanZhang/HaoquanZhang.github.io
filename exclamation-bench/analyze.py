#!/usr/bin/env python3
"""Compute transparent text-level punctuation metrics; no LLM judge required."""
import collections, csv, hashlib, json, math, pathlib, random, re

ROOT=pathlib.Path(__file__).resolve().parent
GROUPS={
 'exclamation':'!！', 'question':'?？', 'comma':',，、',
 'period':'.。', 'colon':':：', 'semicolon':';；',
 'quotes':'\"“”‘’「」『』', 'parentheses':'()（）[]【】',
 'em_dash':'—', 'ellipsis':'…', 'tilde':'~～',
 'exclamation_emoji':'❗❕‼⁉',
}

def prose(text):
    # Drop fenced code, including a fence left open by truncation.
    text=re.sub(r'(?ms)^\s*(`{3,}|~{3,})[^\n]*\n.*?(?:^\s*\1\s*$|\Z)','',text)
    text=re.sub(r'`+[^`\n]*`+','',text)
    # Image introducer ! and URL punctuation are not prose punctuation.
    text=re.sub(r'!\[([^\]]*)\]\([^)]*\)',r'\1',text)
    text=re.sub(r'\[([^\]]*)\]\([^)]*\)',r'\1',text)
    text=re.sub(r'https?://[^\s<>]+','',text)
    # Unordered-list and heading markup; leave ordinary quoted/generated messages.
    text=re.sub(r'(?m)^\s*(?:#{1,6}\s+|[-*+]\s+|>\s*)','',text)
    text=text.replace('**','').replace('__','')
    return text

def score(text):
    visible=prose(text)
    chars=len(re.sub(r'\s','',visible))
    runs=re.findall(r'[!！]+',visible)
    counts={k:sum(visible.count(c) for c in symbols) for k,symbols in GROUPS.items()}
    return {'chars':chars,'counts':counts,'has_exclamation':bool(runs),
            'exclamation_ascii':visible.count('!'),'exclamation_fullwidth':visible.count('！'),
            'exclamation_runs':len(runs),'max_exclamation_run':max(map(len,runs),default=0),
            'multi_exclamation_runs':sum(len(run)>=2 for run in runs),
            'raw_exclamation':text.count('!')+text.count('！'),
            'density':counts['exclamation']*1000/chars if chars else None}

def wilson(k,n):
    if not n:return [None,None]
    z=1.959963984540054; p=k/n; d=1+z*z/n
    center=(p+z*z/(2*n))/d
    half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [max(0,center-half)*100,min(1,center+half)*100]

def aggregate(rows):
    n=len(rows);k=sum(r['metrics']['has_exclamation'] for r in rows)
    chars=sum(r['metrics']['chars'] for r in rows)
    count=sum(r['metrics']['counts']['exclamation'] for r in rows)
    totals={key:sum(r['metrics']['counts'][key] for r in rows) for key in GROUPS}
    return {'n':n,'with_exclamation':k,'incidence_pct':k*100/n if n else None,
            'incidence_ci95':wilson(k,n),'exclamation_count':count,'chars':chars,
            'mean_exclamation_per_response':count/n if n else None,
            'exclamation_ascii':sum(r['metrics']['exclamation_ascii'] for r in rows),
            'exclamation_fullwidth':sum(r['metrics']['exclamation_fullwidth'] for r in rows),
            'mean_chars':chars/n if n else None,'per_1000_chars':count*1000/chars if chars else None,
            'macro_density':sum(r['metrics']['density'] for r in rows)/n if n else None,
            'double_or_more':sum(r['metrics']['max_exclamation_run']>=2 for r in rows),
            'multi_exclamation_runs':sum(r['metrics']['multi_exclamation_runs'] for r in rows),
            'counts':totals,'punctuation_per_1000_chars':{k:v*1000/chars if chars else None for k,v in totals.items()}}

def bootstrap_pair(a,b,prompts,iterations=10000):
    rng=random.Random(20261118)
    strata=collections.defaultdict(list)
    for pid in a.keys()&b.keys():strata[prompts[pid]['language']].append(pid)
    for ids in strata.values():ids.sort()
    values=[]
    for _ in range(iterations):
        ids=[rng.choice(group) for group in strata.values() for _ in group]
        values.append(100*sum(a[p]['metrics']['has_exclamation']-b[p]['metrics']['has_exclamation'] for p in ids)/len(ids))
    values.sort()
    ids=sorted(a.keys()&b.keys())
    return {'n':len(ids),'difference_pp':100*sum(a[p]['metrics']['has_exclamation']-b[p]['metrics']['has_exclamation'] for p in ids)/len(ids),
            'ci95_pp':[values[int(.025*iterations)],values[int(.975*iterations)]],
            'method':'10000 prompt-paired bootstrap resamples, stratified by input language; no multiplicity correction; exploratory'}

def main():
    cfg=json.loads((ROOT/'config.json').read_text())
    if cfg.get('repeats',1)!=1:
        raise ValueError('v0.1 analysis requires repeats=1; repeated sampling needs prompt-clustered analysis.')
    prompts={q['id']:q for q in map(json.loads,(ROOT/'prompts.jsonl').read_text().splitlines())}
    attempts=[json.loads(x) for x in (ROOT/'responses.jsonl').read_text().splitlines()]
    attempts=[r for r in attempts if r['model'] in cfg['models']]
    # Latest successful complete response; retries are selected solely by completeness.
    selected={}
    for r in attempts:
        key=(r['model'],r['prompt_id'],r['repeat'])
        if key not in selected or selected[key]['status']!='ok':selected[key]=r
    scored=[]
    for r in selected.values():
        if r['status']!='ok':continue
        s={'model':r['model'],'prompt_id':r['prompt_id'],'repeat':r['repeat'],
           'dataset':prompts[r['prompt_id']]['dataset'],'language':prompts[r['prompt_id']]['language'],
           'category':prompts[r['prompt_id']]['category'],'text':r['text'],'metrics':score(r['text']),
           'finish_reason':r['finish_reason'],'max_tokens':r['request']['max_tokens'],
           'returned_model':r['response'].get('model'),'elapsed_s':r['elapsed_s']}
        if s['metrics']['chars']>0:scored.append(s)
    bymodel={m:[r for r in scored if r['model']==m] for m in cfg['models']}
    scored_keys={(r['model'],r['prompt_id'],r['repeat']) for r in scored}
    latest={(r['model'],r['prompt_id'],r['repeat']):r for r in attempts}
    tries=collections.Counter((r['model'],r['prompt_id'],r['repeat']) for r in attempts)
    unresolved=[]
    for m in cfg['models']:
        for p in prompts:
            key=(m,p,0)
            if key in scored_keys:continue
            r=latest.get(key,{})
            error=r.get('error','')
            reason=r.get('finish_reason') or (error.split(':')[0] if error.startswith('HTTP ') else error) or 'not_attempted_or_no_prose'
            unresolved.append({'model':m,'prompt_id':p,'attempts':tries[key],'status':r.get('status','not_attempted'),'reason':reason})
    common=set.intersection(*(set(r['prompt_id'] for r in rs) for rs in bymodel.values()))
    summary={}
    for m,rows in bymodel.items():
        summary[m]={'all':aggregate(rows),'en':aggregate([r for r in rows if r['language']=='en']),
                    'zh':aggregate([r for r in rows if r['language']=='zh']),
                    'common':aggregate([r for r in rows if r['prompt_id'] in common]),
                    'matched_en':aggregate([r for r in rows if r['prompt_id'] in common and r['language']=='en']),
                    'matched_zh':aggregate([r for r in rows if r['prompt_id'] in common and r['language']=='zh']),
                    'categories':{cat:aggregate([r for r in rows if r['category']==cat]) for cat in sorted(set(r['category'] for r in rows))},
                    'failed_or_missing':len(prompts)-len(rows),
                    'returned_models':sorted(set(str(r['returned_model']) for r in rows))}
    ranking=sorted(cfg['models'],key=lambda m:-(summary[m]['common']['incidence_pct'] or 0))
    pairs=[]
    if len(common)>0:
        leader=ranking[0]
        aa={r['prompt_id']:r for r in bymodel[leader] if r['prompt_id'] in common}
        for m in ranking[1:]:
            bb={r['prompt_id']:r for r in bymodel[m] if r['prompt_id'] in common}
            pairs.append({'a':leader,'b':m,**bootstrap_pair(aa,bb,prompts)})
    usages=[json.loads(x) for x in (ROOT/'usage_snapshots.jsonl').read_text().splitlines()]
    spent=usages[-1]['usage']['data']['total_used']-usages[0]['usage']['data']['total_used']
    result={'config':cfg,'summary':summary,'ranking':ranking,'common_prompt_ids':sorted(common),
            'common_language_counts':dict(collections.Counter(prompts[p]['language'] for p in common)),
            'attempt_count':len(attempts),'successful_responses':len(scored),
            'requested_responses':len(prompts)*len(cfg['models']),'gateway_usage_delta_usd':spent,
            'gateway_usage_as_of_utc':usages[-1]['time'],
            'gateway_usage_reconciled':usages[-1]['time']>=max(r['completed_at'] for r in attempts),
            'pairwise_vs_observed_leader':pairs,'sources':[
             'https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge',
             'https://arxiv.org/abs/2306.05685'],
            'date':'2026-11-18','start_utc':min(r['started_at'] for r in attempts),
            'end_utc':max(r['completed_at'] for r in attempts)}
    result['unresolved']=unresolved
    (ROOT/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    (ROOT/'scored_responses.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in scored))
    with (ROOT/'leaderboard.csv').open('w') as f:
        fields=['model','track','n','with_exclamation','incidence_pct','exclamation_count','exclamation_ascii','exclamation_fullwidth','mean_exclamation_per_response','chars','per_1000_chars','macro_density','double_or_more','multi_exclamation_runs']
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for m in ranking:
            for track in ['all','en','zh','common','matched_en','matched_zh']:
                w.writerow({'model':m,'track':track,**{k:summary[m][track][k] for k in fields[2:]}})
    print(json.dumps({'valid':len(scored),'common':len(common),'usage_delta_usd':spent,'ranking':[(m,summary[m]['all']['with_exclamation'],summary[m]['all']['n'],round(summary[m]['all']['per_1000_chars'] or 0,3)) for m in ranking]},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
