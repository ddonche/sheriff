/* Progressive navigation enhancements; all portal links also work without JS. */
(()=>{'use strict';const root=document.documentElement;let theme='dark';try{theme=localStorage.getItem('brindle-theme')||theme;}catch{}root.dataset.theme=theme;
 document.querySelector('[data-site-theme]')?.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;try{localStorage.setItem('brindle-theme',next);}catch{}});
})();
