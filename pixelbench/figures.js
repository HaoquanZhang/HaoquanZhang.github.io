/* Aggregate scores and individual outputs remain separate views of the research. */
// Position sources using the room beside the actual figure, including Retina
// laptop viewports whose CSS width is much smaller than their physical pixels.
window.positionPixelSource = (container,anchor,reference) => {
  if(!container||!anchor||!reference)return;
  const bounds=container.getBoundingClientRect(),top=anchor.getBoundingClientRect().top;
  const available=document.documentElement.clientWidth-bounds.right-24-20;
  const aside=innerWidth>1100&&available>=112;
  container.style.setProperty('--pixel-source-top',`${top-bounds.top}px`);
  container.style.setProperty('--pixel-source-size',`${Math.min(144,Math.max(112,available))}px`);
  reference.classList.toggle('is-aside',aside);
};
window.initResearch = async (data, {loadJSON,loadRaster,drawRaster,fillSelect,sourceURL}) => {
  const {t,label,translate}=window.PB;
  const $=s=>document.querySelector(s);
  const table=await loadJSON('assets/benchmarks.json');
  const sizes = ['16','32','64'];
  const aliases = {'Nearest + median cut':'nearest_medcut','SSIM-opt. + median cut':'ssim_medcut','PIA (reduced)':'pia_reduced'};
  const columns = Object.fromEntries(['t2p','i2p'].map(task => [task, table[task].rows.map(row => ({
    id: data.models.find(m => m.label === row[0])?.id || aliases[row[0]],
    label:row[0], algorithm:row.at(-1)==='algorithm', scores:row
  }))]));
  const colors = ['#c8dce7','#91b6cb','#5686a2','#263f50'];
  const element = (tag, text, className) => {
    const el=document.createElement(tag); if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;
  };
  function tableHeader(task, caption) {
    const el=element('table',undefined,'resolution-matrix');el.style.setProperty('--columns',columns[task].length);
    const cap=element('caption',caption,'visually-hidden');el.append(cap);
    const head=element('thead'), row=element('tr');
    const corner=element('th','');corner.scope='col';corner.setAttribute('aria-label',t('Resolution','分辨率'));row.append(corner);
    for(const model of columns[task]){
      const th=element('th',model.label);th.scope='col';th.dataset.model=model.id;
      if(model.algorithm){th.classList.add('algorithm-column');th.append(element('small',t('Algorithm','算法')));}
      row.append(th);
    }
    head.append(row);el.append(head);return el;
  }
  function renderResolutionBoard(task) {
    const board=table[task],metric=$(`#${task}-metric`).value;
    const mi=Object.keys(board.metrics).indexOf(metric)+1;
    const [metricLabel,max,unit]=board.metrics[metric];
    const format=v=>unit==='cosine'?v.toFixed(3):v.toFixed(1)+(unit==='percent'?'%':'');
    const models=columns[task], W=64+models.length*112, H=204, top=18, bottom=198;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.classList.add('resolution-chart');
    svg.setAttribute('role','group');svg.setAttribute('aria-label',`${task.toUpperCase()} · ${metricLabel}`);
    function add(tag,attrs,text,parent=svg){
      const el=document.createElementNS(svg.namespaceURI,tag);
      for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
      if(text!==undefined)el.textContent=text;parent.append(el);return el;
    }
    for(let i=0;i<=4;i++){
      const value=max*i/4,y=bottom-(bottom-top)*i/4;
      add('line',{x1:64,x2:W,y1:y,y2:y,stroke:'#e5e9ec','stroke-width':1});
      add('text',{x:54,y:y+4,'text-anchor':'end',class:'score-tick'},unit==='cosine'?value.toFixed(2):String(value));
    }
    const tooltip=$(`#${task}-readout`);
    const hideTooltip=()=>{tooltip.hidden=true;tooltip.anchorBar=null;};
    hideTooltip();
    models.forEach((model,column)=>{
      const center=64+112*(column+.5);
      board.resolutions.forEach(([resolution],ri)=>{
        const value=model.scores[mi][ri],height=(bottom-top)*value/max;
        const x=center-33.5+ri*18;
        const resolutionLabel=resolution==='avg'?t('Average','平均'):`${resolution} × ${resolution}`;
        const description=`${model.label} · ${resolutionLabel} · ${format(value)}`;
        const bar=add('rect',{x,y:bottom-height,width:13,height:Math.max(.7,height),fill:colors[ri],tabindex:0,role:'img','aria-label':description,class:'resolution-bar','data-model':model.id,'data-resolution':resolution,'data-value':value});
        bar.setAttribute('aria-describedby',tooltip.id);
        const show=()=>{
          tooltip.textContent=description;tooltip.hidden=false;tooltip.anchorBar=bar;
          const rect=bar.getBoundingClientRect(),tip=tooltip.getBoundingClientRect();
          tooltip.style.left=`${Math.max(8,Math.min(innerWidth-tip.width-8,rect.left+rect.width/2-tip.width/2))}px`;
          tooltip.style.top=`${Math.max(8,Math.min(innerHeight-tip.height-8,rect.top-tip.height-8))}px`;
        };
        bar.addEventListener('pointerenter',show);bar.addEventListener('focus',show);bar.addEventListener('click',show);
        bar.addEventListener('scorepositionchange',show);
        bar.addEventListener('pointerleave',hideTooltip);bar.addEventListener('blur',hideTooltip);
        bar.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
        if(resolution==='avg')add('text',{x:x+6.5,y:bottom-height-7,'text-anchor':'middle',class:'average-label'},format(value));
      });

    });
    $(`#${task}-rows`).replaceChildren(svg);

  }
  function hideScoreTooltips(){document.querySelectorAll('.score-readout').forEach(el=>{el.hidden=true;el.anchorBar=null;});}
  window.addEventListener('scroll',()=>{
    document.querySelectorAll('.score-readout').forEach(el=>{
      if(!el.hidden && el.anchorBar===document.activeElement)el.anchorBar.dispatchEvent(new Event('scorepositionchange'));
      else {el.hidden=true;el.anchorBar=null;}
    });
  },{passive:true,capture:true});
  window.addEventListener('resize',hideScoreTooltips);
  const requests={t2p:0,i2p:0};
  function fillCases(task){
    const select=$(task==='t2p'?'#t2p-case':'#compare-case');
    fillSelect(select,data.gallery[task].map(c=>({id:c.id,label:label(c.id,c.label)})),select.value||(task==='t2p'?'turtle':'imagenet_0176'));
  }
  function positionSourceReferences(){
    const board=document.querySelector('.resolution-board[data-task="i2p"]');
    window.positionPixelSource(board,$('#i2p-gallery .matrix-stage'),board.querySelector('.source-references'));
  }
  function renderSourceReferences(item){
    const board=document.querySelector('.resolution-board[data-task="i2p"]');
    let refs=board.querySelector('.source-references');
    if(!refs){refs=element('div',undefined,'source-references');board.append(refs);}
    const img=element('img');img.src=sourceURL(item.source);
    img.id='compare-source';img.alt=t(`Source photograph: ${item.label}`,`原始照片：${label(item.id,item.label)}`);
    img.width=144;img.height=144;
    refs.replaceChildren(img,element('span',t('Source image','原图'),'source-label'));
  }
  new ResizeObserver(positionSourceReferences).observe($('#i2p-gallery'));
  window.addEventListener('resize',positionSourceReferences);
  document.fonts.ready.then(positionSourceReferences);
  async function renderGallery(task){
    const current=++requests[task];
    const select=$(task==='t2p'?'#t2p-case':'#compare-case');
    const item=data.gallery[task].find(c=>c.id===select.value);
    const container=$(`#${task}-gallery`),status=$(task==='t2p'?'#t2p-status':'#compare-status');
    container.setAttribute('aria-busy','true');container.dataset.case=item.id;
    status.textContent=t('Loading outputs…','正在加载输出…');
    const grid=tableHeader(task,`${label(item.id,item.label)} · 16 / 32 / 64`),body=element('tbody'),work=[];
    if(task==='i2p') renderSourceReferences(item);
    let missing=0;
    for(const size of sizes){
      const row=element('tr'),th=element('th',`${size}²`);th.scope='row';row.append(th);
      for(const model of columns[task]){
        const cell=element('td');cell.dataset.model=model.id;cell.dataset.size=size;
        if(model.algorithm)cell.classList.add('algorithm-column');
        const stage=element('div',undefined,'matrix-stage');cell.append(stage);row.append(cell);
        work.push((async()=>{
          try{
            const path=item.outputs[model.id]?.sizes[size];if(!path)throw new Error('Unavailable');
            const raster=await loadRaster(path);if(current!==requests[task])return;
            if(raster.width!==Number(size)||raster.height!==Number(size))throw new Error('Wrong size');
            const canvas=element('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${label(item.id,item.label)} · ${model.label} · ${size} × ${size}`);
            drawRaster(canvas,raster);stage.append(canvas);
            stage.tabIndex=0;stage.setAttribute('aria-label',canvas.getAttribute('aria-label'));
            const badge=element('span',`${size}²`,'pixel-resolution-badge');badge.setAttribute('aria-hidden','true');stage.append(badge);
          }catch{
            if(current===requests[task]){missing++;stage.textContent=t('Unavailable','暂无输出');stage.classList.add('case-missing');}
          }
        })());
      }
      body.append(row);
    }
    grid.append(body);container.replaceChildren(grid);
    await Promise.allSettled(work);
    if(current===requests[task]){
      container.setAttribute('aria-busy','false');
      status.textContent=missing?t(`${missing} outputs unavailable.`,`${missing} 个输出暂不可用。`):'';
    }
  }
  for(const task of ['t2p','i2p']){
    $(`#${task}-metric`).addEventListener('change',()=>renderResolutionBoard(task));
    $(task==='t2p'?'#t2p-case':'#compare-case').addEventListener('change',()=>renderGallery(task));
    renderResolutionBoard(task);fillCases(task);
  }

  const trainingTooltip=$('#training-readout');
  const hideTraining=()=>{trainingTooltip.hidden=true;trainingTooltip.anchorBar=null;};
  function showTraining(bar,event){
    const d=bar.dataset,value=Number(d.delta),delta=(value>0?'+':'')+value.toFixed(1);
    trainingTooltip.textContent=`${t(d.benchmark,d.zhName)} · OV-only ${Number(d.baseline).toFixed(1)} → OV + Pixel ${Number(d.pixel).toFixed(1)} · Δ ${delta} ${t('points','分')}`;
    trainingTooltip.hidden=false;trainingTooltip.anchorBar=bar;
    const rect=bar.getBoundingClientRect(),tip=trainingTooltip.getBoundingClientRect();
    const x=event?.clientX??rect.left+rect.width/2,y=event?.clientY??rect.top;
    trainingTooltip.style.left=`${Math.max(8,Math.min(innerWidth-tip.width-8,x+12))}px`;
    trainingTooltip.style.top=`${Math.max(8,Math.min(innerHeight-tip.height-8,y-tip.height-12))}px`;
  }
  document.querySelectorAll('.training-bar').forEach(bar=>{
    for(const type of ['pointerenter','pointermove','click'])bar.addEventListener(type,event=>showTraining(bar,event));
    for(const type of ['focus','scorepositionchange'])bar.addEventListener(type,()=>showTraining(bar));
    for(const type of ['pointerleave','blur'])bar.addEventListener(type,hideTraining);
    bar.addEventListener('keydown',event=>{if(event.key==='Escape')hideTraining();});
  });
  $('.training-chart-scroll').addEventListener('scroll',hideTraining);
  document.addEventListener('languagechange',()=>{
    for(const task of ['t2p','i2p']){renderResolutionBoard(task);fillCases(task);renderGallery(task);}
    hideTraining();
  });
  await Promise.all([renderGallery('t2p'),renderGallery('i2p')]);
};
