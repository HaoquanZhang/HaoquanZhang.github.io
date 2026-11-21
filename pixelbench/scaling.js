/* The timeline reveals independent saved generations, never interpolated images. */
window.initScalingSweep = async ({loadJSON,loadRaster,drawRaster,fillSelect,sourceURL}) => {
  const {t}=window.PB, $=s=>document.querySelector(s);
  const data=await loadJSON('assets/scaling/scaling.json');
  const figure=$('#scaling'), chart=$('#sweep-chart'), images=$('#sweep-images');
  const cases=$('#sweep-case'), play=$('#sweep-play');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const metrics={i2p:[['i2p','50-way Top-1','50 选一 Top-1',100],['dino','DINOv2 CLS cosine','DINOv2 CLS 余弦相似度',.4]],t2p:[['t2p','500-way Top-1','500 选一 Top-1',100],['judge','VLM judge (0–100)','VLM 评分（0–100）',100]]};
  let task='i2p',model='gpt6astra',version=0,frame=0,progress=1,running=false,started=0,ready=false,entered=false;
  let clips=[],points=[],tiles=[],currentCase;
  let hovered=null,focused=null,selectedPoint=null,tooltipOwner=null,tooltipPosition=null;
  const tooltip=document.createElement('div');
  tooltip.id='sweep-tooltip';tooltip.className='sweep-tooltip';tooltip.role='tooltip';tooltip.hidden=true;
  document.body.append(tooltip);
  const W=520,H=260,left=44,right=506,x=i=>left+i*(right-left)/9;
  const rowModels=['gpt6astra','gpt56sol','opus5','gemini36'].map(id=>data.models.find(m=>m.id===id));
  const rowRank=new Map(rowModels.map((m,index)=>[m.id,index]));
  const columnDelay=65, rowDelay=780, revealDuration=180;
  const columnSpan=columnDelay*(data.sizes.length-1);
  const duration=rowDelay*(rowModels.length-1)+columnSpan+revealDuration;
  figure.dataset.duration=String(duration);
  figure.dataset.columnDelay=String(columnDelay);
  figure.dataset.rowDelay=String(rowDelay);
  figure.dataset.revealDuration=String(revealDuration);
  const svgEl=(tag,attrs={},text)=>{
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
    if(text!==undefined)node.textContent=text;
    return node;
  };
  function buttonText(){play.textContent=running?t('Pause','暂停'):progress<1&&progress>0?t('Continue','继续'):t('Replay','重播');play.disabled=!ready||motion.matches;}
  function revealTile(tile,elapsed){
    const fraction=Math.max(0,Math.min(1,elapsed/revealDuration));
    tile.style.opacity=String(fraction*fraction*(3-2*fraction));
    tile.style.visibility=elapsed>=0?'visible':'hidden';
    tile.dataset.phase=elapsed<0?'waiting':fraction<1?'revealing':'visible';
  }

  function setProgress(value){
    progress=value;figure.dataset.progress=String(value);
    const elapsed=value*duration;
    clips.forEach(({node,rank})=>{
      const local=elapsed-rank*rowDelay;
      const scan=Math.max(0,Math.min(1,local/columnSpan));
      node.setAttribute('width',local<0?0:local>=columnSpan?W:x(0)+(x(9)-x(0))*scan+5);
    });
    tiles.forEach(tile=>{
      const local=elapsed-rowRank.get(tile.dataset.model)*rowDelay-Number(tile.dataset.index)*columnDelay;
      revealTile(tile,value===1?revealDuration:local);
      tile.tabIndex=local>=0&&!tile.classList.contains('is-missing')?0:-1;
    });
    points.forEach(({node,index,rank})=>node.setAttribute('tabindex',elapsed>=rank*rowDelay+index*columnDelay?'0':'-1'));
  }
  function halt(){cancelAnimationFrame(frame);running=false;buttonText();}
  function tick(now){
    setProgress(Math.min(1,(now-started)/duration));
    if(progress<1)frame=requestAnimationFrame(tick);else{running=false;buttonText();}
  }
  function start(restart=false){
    if(!ready)return;
    halt();
    if(motion.matches){setProgress(1);buttonText();return;}
    if(restart||progress>=1){clearInteraction();setProgress(0);}
    running=true;started=performance.now()-progress*duration;buttonText();frame=requestAnimationFrame(tick);
  }
  function options(){
    fillSelect(cases,data.cases[task].map(c=>({id:c.id,label:t(c.en,c.zh)})),cases.value);
    $('#sweep-task').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.task===task)));
  }
  function emphasize(){
    const active=hovered||focused||selectedPoint,activeModel=active?.model||model;
    chart.querySelectorAll('.sweep-line').forEach(line=>{
      const selected=line.dataset.model===activeModel;
      line.setAttribute('stroke-width',selected?(active?4:3):1.5);
      line.setAttribute('opacity',selected?1:.65);
    });
    points.forEach(({node,index})=>{
      const selected=node.dataset.model===activeModel;
      const current=!!active&&selected&&index===active.index;
      node.setAttribute('r',current?6.5:selected?5:3.5);
      node.setAttribute('opacity',selected?1:.75);
      node.classList.toggle('is-active',current);
    });
    tiles.forEach(tile=>tile.classList.toggle('is-selected',!!active&&Number(tile.dataset.index)===active.index&&tile.dataset.model===active.model));
    images.querySelectorAll('.sweep-row-label').forEach(label=>label.classList.toggle('is-active',label.dataset.model===activeModel));
  }
  function hideTooltip(){
    tooltip.hidden=true;
    tooltipOwner?.removeAttribute('aria-describedby');tooltipOwner=null;tooltipPosition=null;
  }
  function showTooltip(state,position,owner){
    const row=data.curves[state.model][state.index],info=data.models.find(m=>m.id===state.model);
    const [,en,zh]=metrics[task].find(m=>m[0]===state.metric);
    const value=state.metric==='dino'?row[state.metric].toFixed(3):row[state.metric].toFixed(1)+(state.metric==='judge'?'':'%');
    const text=`${info.label} · ${row.size}²\n${t(en,zh)}: ${value}`;
    if(tooltip.textContent!==text)tooltip.textContent=text;
    if(tooltipOwner!==owner){tooltipOwner?.removeAttribute('aria-describedby');tooltipOwner=owner;owner?.setAttribute('aria-describedby',tooltip.id);}
    tooltipPosition=position;
    tooltip.hidden=false;
    const {width,height}=tooltip.getBoundingClientRect(),gap=14,padding=8;
    let left=position.x+gap,top=position.y+gap;
    if(left+width>innerWidth-padding)left=position.x-width-gap;
    if(top+height>innerHeight-padding)top=position.y-height-gap;
    tooltip.style.left=`${Math.max(padding,Math.min(left,innerWidth-width-padding))}px`;
    tooltip.style.top=`${Math.max(padding,Math.min(top,innerHeight-height-padding))}px`;
  }
  function clearInteraction(){
    hovered=null;focused=null;selectedPoint=null;hideTooltip();emphasize();
  }
  function hover(state,event){
    if(event.pointerType==='touch')return;
    const changed=hovered?.model!==state.model||hovered?.index!==state.index;
    hovered=state;if(changed)emphasize();
    if(state.metric)showTooltip(state,{x:event.clientX,y:event.clientY},event.currentTarget);
    else hideTooltip();
  }
  function leave(){
    hovered=null;hideTooltip();emphasize();
  }
  function focusItem(state,event){
    focused=state;emphasize();
    if(state.metric&&event.currentTarget.matches(':focus-visible')){
      const rect=event.currentTarget.getBoundingClientRect();
      showTooltip(state,{x:rect.right,y:rect.bottom},event.currentTarget);
    }
  }
  function blurItem(){focused=null;hideTooltip();emphasize();}
  function nearestCurve(event,svg,metricId,y){
    if(event.target.classList.contains('sweep-point')){
      return {model:event.target.dataset.model,index:data.sizes.indexOf(Number(event.target.dataset.size)),metric:metricId};
    }
    const matrix=svg.getScreenCTM();
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    // Use screen pixels so the forgiving target feels the same at any width.
    let best=null,distanceSquared=(18/Math.hypot(matrix.a,matrix.b))**2;
    rowModels.forEach(m=>{
      const visible=Math.min(data.sizes.length-1,(progress*duration-rowRank.get(m.id)*rowDelay)/columnDelay);
      const values=data.curves[m.id];
      values.forEach((row,i)=>{
        if(i>visible)return;
        const next=Math.min(i+1,values.length-1),ax=x(i),ay=y(row[metricId]);
        const dx=x(next)-ax,dy=y(values[next][metricId])-ay,lengthSquared=dx*dx+dy*dy;
        const along=lengthSquared?Math.max(0,Math.min(1,visible-i,((local.x-ax)*dx+(local.y-ay)*dy)/lengthSquared)):0;
        const distance=(local.x-ax-along*dx)**2+(local.y-ay-along*dy)**2;
        if(distance<=distanceSquared){
          distanceSquared=distance;
          best={model:m.id,index:Math.min(Math.floor(visible),Math.round(i+along)),metric:metricId};
        }
      });
    });
    return best;
  }
  function drawChart(){
    chart.replaceChildren();clips=[];points=[];
    const section=document.createElement('section');section.className='sweep-chart-group';section.dataset.task=task;
    const taskTitle=task==='t2p'?'T to P':'I to P';section.setAttribute('aria-label',taskTitle);
    metrics[task].forEach(([metricId,en,zh,max])=>{
        const panel=document.createElement('div');panel.className='sweep-chart-panel';panel.dataset.metric=metricId;
        const title=document.createElement('h3');title.textContent=t(en,zh);panel.append(title);
        const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'group','aria-label':`${taskTitle} · ${t(en,zh)}`});
        const y=value=>222-value/max*196;
        svg.append(svgEl('rect',{width:W,height:H,fill:'transparent','aria-hidden':'true'}));
        svg.addEventListener('pointermove',event=>{
          if(event.pointerType==='touch')return;
          const state=nearestCurve(event,svg,metricId,y);
          svg.style.cursor=state?'crosshair':'';
          if(state)hover(state,event);else leave();
        });
        svg.addEventListener('pointerleave',()=>{svg.style.cursor='';leave();});
        svg.addEventListener('click',event=>{
          if(event.target.classList.contains('sweep-point'))return;
          const state=nearestCurve(event,svg,metricId,y);
          if(state)activatePoint(state.model,state.index,metricId);
        });
        for(let i=0;i<=4;i++){
          const v=max*i/4;
          svg.append(svgEl('line',{x1:left,x2:W,y1:y(v),y2:y(v),stroke:'#e5e9ec'}));
          svg.append(svgEl('text',{x:left-10,y:y(v)+4,'text-anchor':'end',class:'sweep-tick'},max===.4?v.toFixed(1):v));
        }
        data.sizes.forEach((size,i)=>svg.append(svgEl('text',{x:x(i),y:250,'text-anchor':'middle',class:'sweep-tick'},`${size}²`)));
        const defs=svgEl('defs');svg.append(defs);
        // Paint the selected model last in each metric panel.
        [...data.models].sort((a,b)=>Number(a.id===model)-Number(b.id===model)).forEach(m=>{
          const rank=rowRank.get(m.id),clipId=`sweep-reveal-${metricId}-${m.id}`;
          const path=svgEl('clipPath',{id:clipId}),clip=svgEl('rect',{x:0,y:0,width:W,height:H});
          path.append(clip);defs.append(path);clips.push({node:clip,rank});
          const group=svgEl('g',{'clip-path':`url(#${clipId})`});svg.append(group);
          const values=data.curves[m.id],selected=m.id===model;
          const curve=values.map((row,i)=>`${i?'L':'M'}${x(i)},${y(row[metricId])}`).join(' ');
          group.append(svgEl('path',{d:curve,fill:'none',stroke:m.color,'stroke-width':selected?3:1.5,opacity:selected?1:.65,'data-model':m.id,class:'sweep-line'}));
          values.forEach((row,i)=>{
            const point=svgEl('circle',{cx:x(i),cy:y(row[metricId]),r:selected?5:3.5,fill:m.color,opacity:selected?1:.75,tabindex:0,role:'button','data-model':m.id,'data-size':row.size,'data-value':row[metricId],'data-metric':metricId,'aria-label':`${taskTitle} · ${m.label} · ${row.size}² · ${t(en,zh)} ${row[metricId]} · ${t('Show matching image','查看对应图像')}`,class:'sweep-point'});
            const state={model:m.id,index:i,metric:metricId};
            point.addEventListener('focus',event=>focusItem(state,event));
            point.addEventListener('blur',blurItem);
            point.addEventListener('click',()=>activatePoint(m.id,i,metricId));
            point.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activatePoint(m.id,i,metricId);}});
            group.append(point);points.push({node:point,index:i,rank});
          });
        });
        panel.append(svg);section.append(panel);
    });
    chart.append(section);
  }
  function selectModel(id){
    clearInteraction();
    model=id;figure.dataset.model=model;
    images.querySelectorAll('button[data-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===model)));
    emphasize();
  }
  function activatePoint(id,index,metricId){
    selectModel(id);
    const size=data.sizes[index];
    chart.querySelector(`.sweep-point[data-metric="${metricId}"][data-model="${id}"][data-size="${size}"]`)?.focus({preventScroll:true});
    selectedPoint={model:id,index};emphasize();
    const tile=images.querySelector(`.sweep-tile[data-model="${id}"][data-index="${index}"]`);
    if(tile){
      const scroll=$('.sweep-scroll'),a=tile.getBoundingClientRect(),b=scroll.getBoundingClientRect();
      const labelWidth=images.querySelector('.sweep-row-label')?.getBoundingClientRect().width||0;
      const visibleWidth=scroll.clientWidth-labelWidth;
      scroll.scrollTo({left:scroll.scrollLeft+a.left-b.left-labelWidth-(visibleWidth-a.width)/2,behavior:'smooth'});
    }
  }
  async function render(animate=true){
    const current=++version;halt();clearInteraction();ready=false;buttonText();
    options();currentCase=data.cases[task].find(c=>c.id===cases.value);
    figure.dataset.task=task;figure.dataset.model=model;figure.dataset.case=currentCase.id;figure.setAttribute('aria-busy','true');
    $('#scale-status').textContent=t('Loading outputs…','正在加载输出…');
    drawChart();tiles=[];images.replaceChildren();
    const sizes=document.createElement('div');sizes.className='sweep-size-row';sizes.append(document.createElement('span'));
    data.sizes.forEach(size=>{const label=document.createElement('span');label.textContent=`${size}²`;sizes.append(label);});images.append(sizes);
    rowModels.forEach(m=>{
      const row=document.createElement('div');row.className='sweep-image-row';row.dataset.model=m.id;
      const button=document.createElement('button');button.type='button';button.dataset.model=m.id;button.className='sweep-row-label';button.style.setProperty('--model-color',m.color);button.setAttribute('aria-pressed',String(m.id===model));
      const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');button.append(dot,document.createTextNode(m.label));
      button.addEventListener('click',()=>selectModel(m.id));row.append(button);
      data.sizes.forEach((size,index)=>{
        const tile=document.createElement('div');tile.className='sweep-tile';tile.dataset.size=size;tile.dataset.index=index;tile.dataset.model=m.id;
        tile.setAttribute('aria-label',`${t(currentCase.en,currentCase.zh)} · ${m.label} · ${size}²`);
        const badge=document.createElement('span');badge.className='sweep-resolution';badge.textContent=`${size}²`;badge.setAttribute('aria-hidden','true');tile.append(badge);
        const state={model:m.id,index};
        tile.addEventListener('pointerenter',event=>hover(state,event));tile.addEventListener('pointerleave',leave);
        tile.addEventListener('focus',event=>focusItem(state,event));tile.addEventListener('blur',blurItem);
        tiles.push(tile);row.append(tile);
      });images.append(row);
    });setProgress(animate&&!motion.matches?0:1);
    const ref=$('#sweep-reference');ref.replaceChildren();
    if(currentCase.source){
      const img=document.createElement('img');img.src=sourceURL(currentCase.source);img.alt=t(`Source image: ${currentCase.en}`,`原图：${currentCase.zh}`);img.width=144;img.height=144;
      const caption=document.createElement('span');caption.textContent=t('Source image','原图');ref.append(img,caption);
    }
    const item=currentCase;
    const outcomes=await Promise.allSettled(tiles.map(async tile=>{
      const size=Number(tile.dataset.size),selected=tile.dataset.model;
      const path=item.outputs[selected][String(size)];if(!path)throw new Error('Missing output');
      const raster=await loadRaster(path);if(current!==version)return;
      if(raster.width!==size||raster.height!==size)throw new Error('Wrong grid size');
      const canvas=document.createElement('canvas');canvas.className='sweep-grid';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${t(item.en,item.zh)} · ${selected} · ${size}²`);canvas.dataset.path=path;
      drawRaster(canvas,raster);tile.append(canvas);
    }));
    if(current!==version)return;
    outcomes.forEach((result,i)=>{if(result.status==='rejected'){tiles[i].textContent=t('Unavailable','暂无输出');tiles[i].classList.add('is-missing');}});
    ready=true;figure.setAttribute('aria-busy','false');$('#scale-status').textContent='';
    if(animate&&entered)start(true);else{setProgress(entered||motion.matches?1:0);buttonText();}
  }
  function positionReference(){
    window.positionPixelSource(figure,images.querySelector('.sweep-tile'),$('#sweep-reference'));
  }
  new ResizeObserver(positionReference).observe(images);
  window.addEventListener('resize',positionReference);
  window.addEventListener('resize',hideTooltip);
  window.addEventListener('wheel',leave,{passive:true});
  window.addEventListener('scroll',()=>{
    // A delayed scroll event must not dismiss a tooltip just opened under
    // the pointer. Dismiss only after its target has actually moved away.
    if(tooltipPosition&&!tooltipOwner?.contains(document.elementFromPoint(tooltipPosition.x,tooltipPosition.y)))leave();
  },{capture:true,passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')clearInteraction();});
  $('#sweep-task').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{task=b.dataset.task;render();}));
  cases.addEventListener('change',()=>render());
  play.addEventListener('click',()=>{if(running)halt();else start();});
  document.addEventListener('languagechange',()=>render(false));
  motion.addEventListener('change',()=>{halt();setProgress(1);buttonText();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)halt();});
  window.addEventListener('pagehide',halt);
  window.addEventListener('beforeprint',()=>{halt();setProgress(1);});
  const observer=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)&&!entered){entered=true;if(ready)start(true);observer.disconnect();}
  },{threshold:.2});observer.observe(figure);
  await render();
};
