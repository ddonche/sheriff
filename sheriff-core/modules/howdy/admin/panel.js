// Module-owned Desk panel. Shared controls/styles come from Desk panel API v1.
export function mount({container,portal,signal,ui,services}) {
  const {node,button,field,icon,message}=ui;
  const box=node('section','','howdy-editing-access');
  box.append(node('h4','Portal editing access'),node('p','Allow an existing Sheriff account to edit page content in this portal. This does not grant theme, configuration, transfer or full-site build access. Permissions use permanent account IDs, so changing a username keeps the same access.','np-hint'),node('p','Selected portal: '+portal,'np-hint'));
  const policyLabel=node('label','Who can edit page content'),policy=node('select');
  policy.setAttribute('aria-label','Who can edit page content');
  for(const [value,label] of [['approved','Owner and approved editors'],['signed_in','Any signed-in Sheriff account']]){const option=node('option',label);option.value=value;policy.append(option);}
  policyLabel.append(policy);box.append(policyLabel,node('p','Choose signed-in accounts for an open community. You do not need to add each person individually. Page locks still apply.','np-hint'));
  policy.addEventListener('change',()=>void perform('policy',{policy:policy.value}));
  const form=node('form','','howdy-access-form'),account=field('Sheriff username',{placeholder:'Find an account by username'});
  account.input.required=true;account.input.maxLength=80;
  const add=button('',()=>{},'teal');add.type='submit';add.append(icon('user-round-plus'),node('span','Allow editing'));
  form.append(account.element,add);
  const list=node('div'),notice=message(),retry=button('Retry',()=>void perform('manage',{}));retry.hidden=true;
  box.append(form,list,notice,retry);container.append(box);
  let working=false,loaded=false;
  const active=()=>!signal.aborted&&box.isConnected;
  function controls(){account.input.disabled=false;add.disabled=working||!loaded;list.querySelectorAll('button').forEach(el=>el.disabled=working);retry.disabled=working;policy.disabled=working||!loaded;}
  function renderEditors(data){
    if(data.policy)policy.value=data.policy;list.replaceChildren();for(const [subject,label] of Object.entries(data.editors||{})){
      const row=node('div','','howdy-access-row'),revoke=button('',()=>void perform('revoke',{subject}));
      revoke.append(icon('user-round-minus'),node('span','Remove access'));row.append(node('span',label),revoke);list.append(row);
    }
    if(!list.children.length)list.append(node('p',policy.value==='signed_in'?'Any signed-in Sheriff account can edit unlocked pages.':'Only the site owner can edit this portal.','np-hint'));
  }
  async function request(verb,payload){
    const response=await services.backend.request('howdy.access.'+verb,{portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
    if(response.status===404||response.status===501)throw Error('This Sheriff installation does not have the editing-access API. Update Sheriff Core, then retry.');
    let data;try{data=await response.json();}catch{throw Error('Sheriff returned an unreadable editing-access response (HTTP '+response.status+').');}
    if(!response.ok||data.ok===false)throw Error(data.stderr||'Editing access could not be loaded.');return data;
  }
  async function perform(verb,payload){
    if(working||!active())return;working=true;notice.textContent='Loading editing access…';retry.hidden=true;controls();
    try{const data=await request(verb,payload);if(!active())return;loaded=true;renderEditors(data);if(verb==='grant'&&account.input.value.trim()===payload.username)account.input.value='';notice.textContent=verb==='manage'?'':'Editing access updated.';}
    catch(error){if(active()){notice.textContent=error instanceof TypeError?'Could not reach Sheriff’s editing-access service. Check that Desk is running, then retry.':error.message;retry.hidden=false;}}
    finally{working=false;if(active())controls();}
  }
  form.addEventListener('submit',event=>{event.preventDefault();if(!loaded||working)return;void perform('grant',{username:account.input.value.trim()});});
  void perform('manage',{});
}
