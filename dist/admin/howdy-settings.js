// This switch edits the same configuration buffer as the source editor.
(() => {
  const text=document.getElementById('cf-text'),toggle=document.getElementById('cf-howdy-enabled'),note=document.getElementById('cf-howdy-note'),status=document.getElementById('cf-howdy-status');
  let serial=0,busy=false,timer,scope='portal',grouped=false;
  const explanation='Adds Log in / Sign up and the shared account menu beside the theme toggle. Save and rebuild to update your website.';
  async function request(enabled) {
    const payload={text:text.value};if(typeof enabled==='boolean')payload.enabled=enabled;
    const response=await window.SheriffDeskBackend.request('howdy.settings',{portal:window.SheriffPortalContext.current},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const raw=await response.text();let data;
    try {data=JSON.parse(raw);}catch {throw Error(raw.trim()||'Could not read Howdy settings (HTTP '+response.status+').');}
    if(!response.ok||!data||data.ok===false)throw Error(data?.stderr||'Could not read Howdy settings.');return data;
  }
  async function inspect(ticket) {
    if(ticket!==serial || text.disabled || grouped&&scope!=='site')return;
    const source=text.value;
    try {const data=await request();if(ticket!==serial||text.value!==source)return;toggle.checked=data.enabled;toggle.disabled=busy;status.textContent='';}
    catch(error){if(ticket===serial){toggle.disabled=true;status.textContent=error.message;}}
  }
  window.SheriffHowdySettings={refresh(_,nextScope,isGrouped){scope=nextScope;grouped=isGrouped;const ticket=++serial;clearTimeout(timer);toggle.disabled=true;note.textContent=grouped&&scope!=='site'?'Howdy is a site-wide setting. Open Site config above to enable the shared account menu for every portal.':explanation;timer=setTimeout(()=>void inspect(ticket),120);}};
  toggle.addEventListener('change',async()=>{
    if(busy||text.disabled||grouped&&scope!=='site')return;
    const source=text.value,choice=toggle.checked;busy=true;toggle.disabled=true;const ticket=++serial;status.textContent='';
    try {const data=await request(choice);if(ticket!==serial||text.value!==source||text.disabled)return;text.value=data.content;text.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Unsaved — Save keeps this setting; rebuild updates the website.';}
    catch(error){if(ticket===serial){toggle.checked=!choice;status.textContent=error.message;}}
    finally {busy=false;if(ticket===serial)toggle.disabled=false;}
  });
})();
