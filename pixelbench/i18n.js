/* One shared set of figures; switching language preserves their current state. */
(() => {
  'use strict';
  const labels = {
    mushroom:'蘑菇',cherry:'樱桃',turtle:'乌龟',camera:'相机',owl:'猫头鹰',moon:'月亮',rabbit:'兔子',train:'火车',apple:'苹果',cake:'蛋糕',cat:'猫',elephant:'大象',clock:'时钟',car:'汽车',bicycle:'自行车',lightning:'闪电',
    imagenet_0176:'萨路基猎犬',imagenet_0326:'灰蝶',imagenet_0190:'锡利哈姆梗',imagenet_0024:'乌林鸮',imagenet_0628:'远洋客轮',
    imagenet_0184:'爱尔兰梗',imagenet_0789:'障子门',imagenet_0226:'布里牧羊犬',imagenet_0142:'半蹼鹬',imagenet_0026:'普通蝾螈',imagenet_0462:'扫帚',imagenet_0586:'半履带车',imagenet_0485:'CD 播放器',imagenet_0569:'垃圾车',imagenet_0115:'海蛞蝓',imagenet_0343:'疣猪'
  };
  const root = document.documentElement;
  const switcher = document.querySelector('#language-switcher');
  const buttons = [...switcher.querySelectorAll('[data-language]')];
  let lang = 'en';
  try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('pixelbench-language') || 'en'; } catch {}
  const t = (en, zh) => root.lang === 'zh-CN' ? zh : en;
  function translate(scope=document) {
    scope.querySelectorAll('[data-en][data-zh]').forEach(el => { el.textContent=t(el.dataset.en,el.dataset.zh); });
    for (const attr of ['aria-label','alt','title']) scope.querySelectorAll(`[data-en-${attr}]`).forEach(el=>el.setAttribute(attr,t(el.getAttribute(`data-en-${attr}`),el.getAttribute(`data-zh-${attr}`))));
  }
  function setLanguage(next, preserve=false) {
    const anchors=[...document.querySelectorAll('.reading-block, figure, .hero')];
    const anchor=preserve ? anchors.find(el=>el.getBoundingClientRect().bottom>100) : null;
    const top=anchor?.getBoundingClientRect().top;
    root.lang=next==='zh'?'zh-CN':'en';
    translate();
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === next)));
    switcher.hidden = false;
    document.querySelector('meta[name="description"]').content=t('How language models generate, reconstruct, and recognize images as palettes and grids of numbers.','语言模型如何通过调色板和数字网格生成、重建和理解图像，以及像素重建训练如何帮助视觉理解。');
    document.dispatchEvent(new CustomEvent('languagechange'));
    if (preserve) {
      try {
        localStorage.setItem('pixelbench-language',next);
        const url=new URL(location.href);url.searchParams.set('lang',next);
        url.hash=url.hash.replace(/(fn(?:ref\d*)?:)(en|zh)-/,`$1${next}-`);
        history.replaceState(null,'',url);
      } catch {}
      requestAnimationFrame(()=>{ if(anchor)window.scrollBy({top:anchor.getBoundingClientRect().top-top,behavior:'instant'}); });
    }
  }
  window.PB={t,translate,label:(id,fallback,language=root.lang)=>language.startsWith('zh') ? labels[id]||fallback : fallback,setLanguage};
  buttons.forEach(button => button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') !== 'true') setLanguage(button.dataset.language, true);
  }));
  setLanguage(lang==='zh'?'zh':'en');
})();
