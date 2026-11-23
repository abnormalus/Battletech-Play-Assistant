
'use strict';
const fields = {
 force: [['name','Force name'],['commander','Commanding officer'],['scale','Scale','number'],['bv','Available BV','number'],['bsp','Battlefield Support Points','number'],['skill','Force skill'],['advances','Advances','number']],
 contract: [['name','Contract name'],['employer','Employer'],['location','Contract location'],['action','Type of action'],['scale','Scale','number'],['base','Base pay %','number'],['baseSP','Base pay SP','number'],['support','Support %','number'],['supportMode','Support type'],['supportSP','Support SP','number'],['transport','Transportation %','number'],['transportSP','Transportation SP','number'],['salvage','Salvage %','number'],['salvageMode','Salvage type'],['salvageSP','Salvage SP','number'],['command','Command terms'],['months','Length in months','number'],['starting','Starting warchest SP','number'],['reputation','Starting reputation','number'],['brief','Mission briefing','textarea']],
 employment: [['employer','Employer'],['unit','Unit'],['assignment','Assignment'],['forces','Forces committed'],['from','Start date','date'],['until','End date','date'],['location','Reporting location'],['transport','Transportation coverage %','number'],['pay','Monthly remuneration SP','number'],['support','Support and repairs'],['salvage','Salvage terms'],['command','Command rights'],['terms','Additional terms','textarea'],['employerSignature','Employer signatory'],['unitSignature','Unit signatory']],
 roster: [['formation','Formation'],['unit','Unit / variant'],['bv','Battle Value','number'],['scrap','Scrap value SP','number'],['abilities','Unit abilities'],['pilot','MechWarrior'],['gunnery','Gunnery','number'],['piloting','Piloting','number'],['advance','Advances','number'],['special','Special pilot abilities'],['notes','In-play notes','textarea']],
 ledger: [['month','Month'],['event','Event'],['cost','Cost SP','number'],['cover','Coverage SP','number'],['paid','Paid SP','number'],['rep','Rep change','number']]
};

const negotiationTerms = {
 pay: {label:'Base pay',values:[null,50,55,60,70,80,90,100,110,120,130,150,175,200],format:v=>v+'%'},
 support: {label:'Support',values:[null,'None','Straight / 20%','Straight / 40%','Straight / 60%','Straight / 80%','Straight / 100%','Battle / 10%','Battle / 20%','Battle / 30%','Battle / 40%','Battle / 50%','Battle / 75%','Battle / 100%']},
 salvage: {label:'Salvage',values:[null,'None',null,'Exchange','10%','20%','30%','40%','50%','60%','70%','80%','90%','100%']},
 transport: {label:'Transportation',values:[null,null,null,null,null,0,25,50,75,100],format:v=>v+'%'},
 command: {label:'Command rights',values:[null,null,null,'Integrated',null,null,null,'House','Liaison',null,null,'Independent']}
};
function validSteps(raw) {
 const steps={};
 for(const [key,term] of Object.entries(negotiationTerms)){
   const step=raw?.[key];
   if(!Number.isInteger(step)||term.values[step]==null)return null;
   steps[key]=step;
 }
 return steps;
}
function reputation() {
 return numeric(state.contract.reputation)+state.ledger.reduce((sum,row)=>sum+numeric(row.rep),0);
}
function negotiate(base,steps,rep,scale) {
 const distance=Object.keys(negotiationTerms).map(key=>steps[key]-base[key]);
 const credits=distance.reduce((sum,n)=>sum+Math.floor(Math.max(0,-n)/2),0);
 const upgrades=distance.reduce((sum,n)=>sum+Math.max(0,n),0);
 const available=Math.max(0,Math.min(Math.floor(rep),2*scale));
 const used=Math.max(0,upgrades-credits);
 return {credits,upgrades,available,used,valid:credits<=2&&used<=available};
}
function currentNegotiation(draft=state.draft) {
 return draft?negotiate(draft.base,draft.steps,reputation(),draft.scale):null;
}
function termLabel(term,step) {
 const value=term.values[step];
 return term.format?term.format(value):value;
}
function negotiationPanel() {
 const draft=state.draft;
 if(!draft)return '';
 const budget=currentNegotiation();
 const controls=Object.entries(negotiationTerms).filter(([key])=>key!=='transport'||draft.travels).map(([key,term])=>{
   const options=term.values.map((value,i)=>value==null?'':'<option value="'+i+'"'+(i===draft.steps[key]?' selected':'')+'>Step '+i+' · '+esc(termLabel(term,i))+'</option>').join('');
   return '<label>'+term.label+'<select data-negotiation="'+key+'">'+options+'</select><small>Offered step '+draft.base[key]+' · '+esc(termLabel(term,draft.base[key]))+'</small></label>';
 }).join('');
 return '<section class="sheet"><h2>Negotiate terms</h2><p>Reputation steps used <strong>'+budget.used+' / '+budget.available+'</strong> · Concession credits <strong>'+budget.credits+' / 2</strong> · Upgrade steps <strong>'+budget.upgrades+'</strong></p>'+
 '<p>Lower a different term by two steps to earn one upgrade step. You can make up to two exchanges. Gaps in the table still count toward the distance between steps.</p>'+
 '<div class="fields">'+controls+'</div><div class="actions board-actions"><button data-action="reset-negotiation">Reset terms</button><button data-action="manual-terms">Edit terms manually</button></div>'+
 (!budget.valid?'<p role="alert">Adjust concessions or upgrades before signing. The current terms exceed the negotiation limits.</p>':'')+'</section>';
}
function applyNegotiatedTerms(contract,draft) {
 if(!draft)return {...contract};
 const s=draft.steps;
 const base=negotiationTerms.pay.values[s.pay];
 const support=s.support===1?0:Number(negotiationTerms.support.values[s.support].match(/\d+/)[0]);
 const transport=draft.travels?negotiationTerms.transport.values[s.transport]:0;
 const salvage=s.salvage>=4?(s.salvage-3)*10:0;
 return {...contract,scale:String(draft.scale),base:String(base),baseSP:String(Math.floor(500*draft.scale*base/100)),
  support:String(support),supportMode:s.support===1?'None':s.support<=6?'Straight':'Battle',
  transport:String(transport),transportSP:String(Math.floor(draft.grossTravel*transport/100)),
  salvage:s.salvage===3?'':String(salvage),salvageMode:s.salvage===1?'None':s.salvage===3?'Exchange':'Share',
  command:negotiationTerms.command.values[s.command]};
}
function contractKey(contract) {
 return JSON.stringify(['name','employer','location','action','months','base','supportMode','support','transport','salvageMode','salvage','command']
  .map(key=>contract[key]||''));
}
function activeContract(){return state.history.findLast(entry=>!entry.resolution);}
function signContract() {
 if(activeContract()){notify('Resolve the active contract before signing another.');return;}
 if(!state.contract.name?.trim()||!state.contract.employer?.trim()){
   notify('Enter a contract name and employer before signing.');return;
 }
 const budget=currentNegotiation();
 if(budget&&!budget.valid){notify('Adjust the negotiation steps before signing.');return;}
 const contract=applyNegotiatedTerms(state.contract,state.draft);
 const offerId=state.draft?.id;
 const key=contractKey(contract);
 if(offerId ? state.history.some(entry=>entry.offerId===offerId) : state.history.at(-1)?.key===key){
   notify('This contract is already in MSRB History.');return;
 }
 if(!confirm('Sign this contract and add its terms to MSRB History?'))return;
 const signedAt=new Date().toISOString();
 const agreement={...state.employment,employer:contract.employer,unit:state.force.name||state.employment.unit||'',
  assignment:contract.action||'',location:contract.location||'',transport:contract.transport||'',pay:contract.baseSP||'',
  support:[contract.supportMode,contract.support&&contract.support+'%'].filter(Boolean).join(' '),
  salvage:[contract.salvageMode,contract.salvage&&contract.salvage+'%'].filter(Boolean).join(' '),command:contract.command||''};
 state.contract=contract;
 state.history.push({signedAt,startMonth:state.month,offerId,key,contract:{...contract},agreement,company:state.force.name||'',reputationUsed:budget?.used||0,
  exchanges:budget?.credits||0,steps:state.draft?{...state.draft.steps}:undefined,
  offeredSteps:state.draft?{...state.draft.base}:undefined});
 active='history';save();render();
 notify('Contract signed and added to MSRB History.');
}
function renderHistory() {
 const money=(v,suffix)=>v==null||v===''?'':fmt.format(numeric(v))+suffix;
 const list=state.history.slice().reverse().map(entry=>{
   const c=entry.contract;
   const facts=[['Location',c.location],['Assignment',c.action],['Term',money(c.months,' months')],
    ['Base pay',money(c.baseSP,' SP/month')],['Support',[c.supportMode,money(c.support,'%')].filter(Boolean).join(' ')],
    ['Transportation',money(c.transport,'%')],['Salvage',[c.salvageMode,money(c.salvage,'%')].filter(Boolean).join(' ')],
    ['Command',c.command],['Reputation steps',String(entry.reputationUsed)],['Concession credits',String(entry.exchanges)]];
   return '<article class="sheet"><div class="section-head"><div><h3>'+esc(c.name)+'</h3><p>'+esc(c.employer)+(entry.company?' · '+esc(entry.company):'')+'</p></div>'+
    '<time datetime="'+esc(entry.signedAt)+'">'+new Date(entry.signedAt).toLocaleDateString()+'</time></div><dl class="history-facts">'+
    facts.filter(([,v])=>v).map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+
    (entry.resolution?'<p>'+esc(entry.resolution.outcome)+' · Month '+entry.resolution.month+' · Settlement '+fmt.format(entry.resolution.paid)+' SP · Scrap proceeds '+fmt.format(entry.resolution.scrap)+' SP · Reputation '+fmt.format(entry.resolution.rep)+'</p><p>'+esc(entry.resolution.notes)+'</p>':'')+
    (c.brief?'<details><summary>Original mission briefing</summary><pre>'+esc(c.brief)+'</pre></details>':'')+'</article>';
 }).join('');
 return '<section class="sheet"><h2>MSRB History</h2><p>'+(state.history.length===1?'1 signed contract':state.history.length+' signed contracts')+'</p></section>'+
  campaignTimePanel()+(list||'<p>Sign a contract from the Contract sheet to start the company’s history.</p>');
}

const outcomes=['Completed','Failed','Terminated'];
function cleanResolution(value) {
 if(!outcomes.includes(value?.outcome)||!Number.isSafeInteger(value.month)||value.month<1)return undefined;
 return {outcome:value.outcome,month:value.month,paid:Math.max(0,numeric(value.paid)),
  scrap:Math.max(0,numeric(value.scrap)),rep:numeric(value.rep),notes:String(value.notes??'').slice(0,12000)};
}
function monthlyTransaction(month,entry,forceScale) {
 const scale=Math.max(1,Math.floor(numeric(forceScale)||numeric(entry?.contract.scale)||1));
 const paid=entry?numeric(entry.contract.baseSP||entry.agreement.pay):0;
 return {month:String(month),event:entry?'On contract · '+entry.contract.name:'Between contracts',
  cost:String(500*scale),paid:String(Math.max(0,paid))};
}
function campaignTimePanel() {
 const entry=activeContract();
 const row=monthlyTransaction(state.month,entry,state.force.scale);
 const term=entry?numeric(entry.contract.months):0;
 return '<section class="sheet"><div class="section-head"><h2>Campaign month '+state.month+'</h2><div class="actions"><button data-action="advance-month">Advance one month</button>'+
  (entry?'<button data-action="resolve-contract">Resolve contract</button>':'')+'</div></div><p>'+
  (entry?'On contract · '+esc(entry.contract.name)+' · '+Math.max(0,state.month-entry.startMonth)+(term?' of '+term:'')+' months recorded':'Between contracts')+
  '</p><p>Next ledger entry: '+fmt.format(numeric(row.cost))+' SP upkeep'+(entry?' · '+fmt.format(numeric(row.paid))+' SP contract pay':'')+'.</p></section>';
}
function advanceMonth() {
 if(state.ledger.length>=1000){notify('The ledger has reached 1,000 rows.');return;}
 const row=monthlyTransaction(state.month,activeContract(),state.force.scale);
 if(!confirm('Record month '+state.month+' with '+fmt.format(numeric(row.cost))+' SP upkeep and '+fmt.format(numeric(row.paid))+' SP pay?'))return;
 state.ledger.push(row);
 state.month++;
 save();render();notify('Month '+row.month+' recorded in the warchest ledger.');
}
let resolvingContract;
function openResolution() {
 resolvingContract=activeContract();
 if(!resolvingContract)return;
 const dialog=$('#resolveContract');
 dialog.querySelector('form[data-resolution]').reset();
 dialog.querySelector('[data-contract-name]').textContent=resolvingContract.contract.name+' · Month '+state.month;
 dialog.showModal();
}
function resolveContract(event) {
 event.preventDefault();
 const entry=resolvingContract;
 if(!entry||entry!==activeContract()){$('#resolveContract').close();notify('The active contract changed.');return;}
 if(state.ledger.length>=1000){notify('The ledger has reached 1,000 rows.');$('#resolveContract').close();return;}
 const result=cleanResolution({...Object.fromEntries(new FormData(event.target)),month:state.month});
 if(!result)return;
 state.ledger.push({month:String(state.month),event:'Contract resolved · '+entry.contract.name,
  paid:String(result.paid+result.scrap),rep:String(result.rep)});
 entry.resolution=result;resolvingContract=undefined;
 $('#resolveContract').close();
 save();render();notify('Contract resolved and settlement recorded.');
}
const storageKey = 'mercenaries-campaign-v1';
const fresh = () => ({version:1,month:1,force:{},contract:{},employment:{},roster:[],ledger:[],board:{options:{traveling:6,model:'standard'}},history:[],draft:null});
const numeric = v => Number.isFinite(Number(v)) ? Number(v) : 0;
function validated(source) {
 if (source?.version !== 1) throw Error('Choose a version 1 campaign backup.');
 const cleaned = fresh();
 cleaned.month=Number.isSafeInteger(source.month)&&source.month>0?source.month:1;
 function values(value, group) {
   if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('The backup contains an invalid sheet.');
   return Object.fromEntries(fields[group].filter(([key]) => ['string','number'].includes(typeof value[key])).map(([key]) => [key,String(value[key]).slice(0,12000)]));
 }
 for (const group of ['force','contract','employment']) cleaned[group]=values(source[group],group);
 for (const group of ['roster','ledger']) {
   if (!Array.isArray(source[group]) || source[group].length>1000) throw Error('The backup contains an invalid row list.');
   cleaned[group]=source[group].map(row=>{
      const clean=values(row,group);
      if(group==='roster'&&typeof row.sheet?.path==='string'&&row.sheet.path.length<=1024&&/\.(ssw|saw)$/i.test(row.sheet.path)){
        clean.sheet={path:row.sheet.path,repoId:Number.isSafeInteger(row.sheet.repoId)?row.sheet.repoId:null};
      }
      return clean;
    });
 }
 if(source.board?.options) cleaned.board.options=ContractBoard.settings(source.board.options);
 const published=source.board?.published;
 if(Number.isInteger(published?.seed)&&published.seed>=0&&published.seed<=4294967295&&published.options){
   cleaned.board.published={options:ContractBoard.settings(published.options),seed:published.seed};
 }
 const draft=source.draft;
 const base=validSteps(draft?.base),steps=validSteps(draft?.steps);
 if(base&&steps&&typeof draft.id==='string'&&draft.id.length<=60){
   const travels=draft.travels===true;
   cleaned.draft={id:draft.id,base,steps,scale:Math.max(1,Math.min(100,Math.floor(numeric(draft.scale)))),
     grossTravel:travels?Math.max(0,Math.min(45000,numeric(draft.grossTravel))):0,travels};
   if(!travels)cleaned.draft.steps.transport=base.transport;
 }
 if(Array.isArray(source.history)){
   cleaned.history=source.history.filter(entry=>entry&&typeof entry.signedAt==='string'&&Number.isFinite(Date.parse(entry.signedAt))).map(entry=>{
     const contract=values(entry.contract,'contract');
     return {signedAt:new Date(entry.signedAt).toISOString(),offerId:typeof entry.offerId==='string'?entry.offerId.slice(0,60):undefined,
       contract,agreement:values(entry.agreement??{},'employment'),company:String(entry.company||'').slice(0,12000),
       startMonth:Number.isSafeInteger(entry.startMonth)&&entry.startMonth>0?entry.startMonth:1,
        resolution:cleanResolution(entry.resolution),key:contractKey(contract),reputationUsed:Math.max(0,Math.min(200,Math.floor(numeric(entry.reputationUsed)))),
       exchanges:Math.max(0,Math.min(2,Math.floor(numeric(entry.exchanges)))),
       steps:validSteps(entry.steps)||undefined,offeredSteps:validSteps(entry.offeredSteps)||undefined};
   });
 }
 return cleaned;
}
const $ = selector => document.querySelector(selector);
const notify = message => { $('#status').textContent = message; };
let state = fresh();
try {const saved=localStorage.getItem(storageKey); if(saved) state=validated(JSON.parse(saved));}
catch {notify('Saved campaign could not be loaded. You can import a backup.');}
let active='force';
let pdfURL;
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = new Intl.NumberFormat();
function save(queueSync=true) {
 try {localStorage.setItem(storageKey,JSON.stringify(state));notify('Saved on this device.');if(queueSync)scheduleCompanySync();}
 catch {notify('Local storage is unavailable. Export a backup to keep your changes.');}
}
function control(group, [key,label,type='text'], index) {
 const row = index===undefined ? state[group] : state[group][index];
 const data = 'data-group="'+group+'" data-key="'+key+'"'+(index===undefined?'':' data-index="'+index+'"');
 const value=esc(row[key]);
 const locked=group==='contract'&&state.draft&&['scale','base','baseSP','support','supportMode','transport','transportSP','salvage','salvageMode','command'].includes(key);
 const input=type==='textarea'?'<textarea '+data+' maxlength="12000">'+value+'</textarea>':'<input '+data+' type="'+type+'"'+(type==='number'?' step="any"':'')+' value="'+value+'"'+(locked?' readonly':'')+'>';
 const field='<label>'+label+input+'</label>';
 return group==='roster'&&key==='unit'?'<div>'+field+'<div class="roster-unit-matches" aria-live="polite"></div></div>':field;
}
const inputs = (group,index) => fields[group].map(field=>control(group,field,index)).join('');
function totals() {
 let balance=numeric(state.contract.starting);
 let rep=numeric(state.contract.reputation);
 state.ledger.forEach((row,index)=>{
   balance += numeric(row.cover)+numeric(row.paid)-numeric(row.cost);
   rep += numeric(row.rep);
   const cell=$('[data-balance="'+index+'"]');
   if(cell) cell.textContent=fmt.format(balance);
 });
 const bv=state.roster.reduce((sum,row)=>sum+numeric(row.bv),0);
 $('#balance').textContent=fmt.format(balance)+' SP';
 $('#rep').textContent=fmt.format(rep);
 $('#bv').textContent=fmt.format(bv)+(state.force.bv ? ' / '+fmt.format(numeric(state.force.bv)) : '');
 $('#rosterCount').textContent=fmt.format(state.roster.length);
 $('#campaignName').textContent=state.force.name || 'Campaign sheets';
}
function formationName(row) {return row.formation?.trim()||'';}
function unitLabel(row,index){return row.unit||'Unit '+(index+1);}
function unitLink(row,index) {
 const label=esc(unitLabel(row,index));
 return row.sheet?'<a href="#mechSheet" data-action="view-unit-sheet" data-index="'+index+'">'+label+'</a>':label;
}
function renderFormations() {
 const panel=$('#formationList');
 if(!panel)return;
 const formations=new Map();
 state.roster.forEach((row,index)=>{
  const name=formationName(row);
  if(!formations.has(name))formations.set(name,[]);
  formations.get(name).push({row,index});
 });
 panel.innerHTML=Array.from(formations,([name,members])=>'<section class="sheet"><div class="section-head"><h3>'+
  esc(name||'Unassigned')+'</h3><button data-action="formation-sheets" data-formation="'+esc(name)+'"'+
  (members.some(({row})=>row.sheet)?'':' disabled')+'>View formation sheets</button></div><ul>'+
  members.map(({row,index})=>'<li>'+unitLink(row,index)+'</li>').join('')+'</ul></section>').join('');
}
function render() {
 $('#tabs').querySelectorAll('button').forEach(button=>button.setAttribute('aria-current',button.dataset.tab===active));
 const panel=$('#panel');
 if(active==='board'){
   panel.innerHTML=renderBoard();
 } else if(active==='history'){
   panel.innerHTML=renderHistory();
 } else if(active==='reference'){
   panel.replaceChildren($('#reference').content.cloneNode(true));
   showPDF();
 } else if(active==='force'){
   panel.innerHTML='<section class="sheet"><h2>Mercenary force record</h2><div class="fields">'+inputs('force')+'</div></section><section class="sheet"><div class="section-head"><h2>Force roster</h2><button class="primary" data-action="add" data-group="roster">Add unit</button></div>'+(
     state.roster.length ? state.roster.map((row,index)=>'<div class="row"><div class="section-head"><h3>'+unitLink(row,index)+'</h3><div class="actions"><button data-action="link-unit" data-index="'+index+'">'+(row.sheet?'Change linked sheet':'Link unit sheet')+'</button>'+
      (row.sheet?'<button data-action="unlink-unit" data-index="'+index+'">Unlink sheet</button>':'')+
      '<button data-action="remove" data-group="roster" data-index="'+index+'">Remove unit</button></div></div><div class="fields">'+inputs('roster',index)+'</div></div>').join('') :
      '<p>Add units with their formation, pilot, and battle value.</p>')+'</section><div id="formationList"></div>';
   renderFormations();
 } else if(active==='contract'){
   panel.innerHTML=campaignTimePanel()+'<section class="sheet"><div class="section-head"><h2>Mercenary contract record</h2><button class="primary" data-action="sign-contract">Sign contract</button></div><div class="fields">'+inputs('contract')+'</div></section>'+negotiationPanel()+'<section class="sheet"><div class="section-head"><h2>Warchest ledger</h2><button class="primary" data-action="add" data-group="ledger">Add transaction</button></div><p>Coverage and payments add to the balance. Enter costs as positive amounts to subtract them.</p>'+
     (state.ledger.length?'<div class="ledger"><table><thead><tr>'+fields.ledger.map(([,label])=>'<th scope="col">'+label+'</th>').join('')+'<th scope="col">Balance</th><th scope="col">Actions</th></tr></thead><tbody>'+
       state.ledger.map((row,index)=>'<tr>'+fields.ledger.map(field=>'<td>'+control('ledger',field,index)+'</td>').join('')+'<td data-balance="'+index+'"></td><td><button data-action="remove" data-group="ledger" data-index="'+index+'">Remove</button></td></tr>').join('')+'</tbody></table></div>':'<p>No transactions recorded.</p>')+'</section>';
 } else {
   panel.innerHTML='<section class="sheet"><h2>Employment agreement</h2><p>Record negotiated terms and signatories. The original agreement is available under Rulebook &amp; backups.</p><div class="actions"><button data-action="copy-terms">Copy from force and contract</button></div><div class="fields">'+inputs('employment')+'</div></section>';
 }
 totals();
}
function pdfStore(mode, operation) {
 return new Promise((resolve,reject)=>{
   if (!window.indexedDB) {reject(Error('Local attachment storage unavailable'));return;}
   const open=indexedDB.open('mercenaries-reference',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('files');
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
     const db=open.result;
     const tx=db.transaction('files',mode);
     const request=operation(tx.objectStore('files'));
     tx.oncomplete=()=>{db.close();resolve(request.result);};
     tx.onabort=()=>{db.close();reject(tx.error);};
   };
 });
}
function showPDF() {
 const links=$('#pdfLinks');
 if(!links) return;
 links.replaceChildren();
 if(!pdfURL) return;
 for(const [label,page] of [['Rulebook',1],['Battlefield Support',6],['Chaos Campaign',19],['Contract record',35],['Force record',36],['Employment agreement',37]]){
   const a=document.createElement('a');
   a.href=pdfURL+'#page='+page;
   a.target='_blank';
   a.rel='noopener';
   a.textContent=label;
   links.append(a);
 }
}
function attachPDF(blob) {
 if(pdfURL) URL.revokeObjectURL(pdfURL);
 pdfURL=URL.createObjectURL(blob);
 showPDF();
}
pdfStore('readonly', store=>store.get('rulebook')).then(blob=>{if(blob && !pdfURL) attachPDF(blob);}).catch(()=>{});
function exportBackup() {
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 a.href=url;a.download='mercenaries-campaign.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('#tabs').addEventListener('click', event=>{
 const tab=event.target.closest('[data-tab]');
 if(tab){active=tab.dataset.tab;render();}
});
const rosterSearches=new WeakMap();
function rosterNameInput(input) {
 return input.matches('input[data-group="roster"][data-key="unit"]');
}
function saveRosterLink(row,ref,title,bv,input) {
 if(!state.roster.includes(row))return;
 const restoreFocus=document.activeElement===input;
 row.sheet=ref;row.unit=title;
 if(bv!=='')row.bv=bv;
 save();render();
 if(restoreFocus)$('[data-group="roster"][data-key="unit"][data-index="'+state.roster.indexOf(row)+'"]')?.focus();
}
function queueRosterSearch(input,autoLink=false) {
 const row=state.roster[Number(input.dataset.index)];
 const list=input.parentElement.nextElementSibling;
 const name=input.value.trim();
 const previous=rosterSearches.get(input);
 if(autoLink&&previous?.name===name){
  previous.autoLink=true;
  if(previous.exact)previous.choose(previous.exact);
  return;
 }
 clearTimeout(previous?.timer);
 const search={name,autoLink};
 rosterSearches.set(input,search);
 const current=()=>input.isConnected&&rosterSearches.get(input)===search&&state.roster.includes(row)&&input.value.trim()===name&&!row.sheet;
 list.replaceChildren();
 if(!name||row.sheet)return;
 async function choose(entry) {
  if(!current()||search.selecting)return;
  search.selecting=true;
  try {
   const {ref,title,bv}=await MechLibrary.readRosterEntry(entry);
   if(current())saveRosterLink(row,ref,title,bv,input);
  } catch(error) {
   if(current())list.textContent=error.message;
  } finally {search.selecting=false;}
 }
 search.choose=choose;
 search.timer=setTimeout(async ()=>{
  try {
   const {exact,matches,total,ready}=await MechLibrary.searchRoster(name);
   if(!current())return;
   search.exact=exact;
   if(search.autoLink&&exact){await choose(exact);return;}
   if(!ready){
    list.textContent='Connect GitHub or load a local ZIP in Mech lookup to search.';
    return;
   }
   if(!matches.length){list.textContent='No matching unit sheets.';return;}
   const picker=document.createElement('div');
   picker.className='actions';
   for(const entry of matches){
    const button=document.createElement('button');
    button.type='button';
    const duplicated=matches.some(other=>other!==entry&&other.label===entry.label);
    button.textContent=duplicated?entry.label+' · '+entry.path.split('/').slice(0,-1).join('/'):entry.label;
    button.title=entry.path;
    button.addEventListener('click',()=>choose(entry));
    picker.append(button);
   }
   list.append(picker);
   if(total>matches.length){
    const hint=document.createElement('small');
    hint.textContent=total+' matches. Keep typing or open the full picker.';
    list.append(hint);
   }
  } catch(error) {
   if(current())list.textContent=error.message;
  }
 },autoLink?0:180);
}
$('#panel').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&rosterNameInput(event.target)){
  event.preventDefault();queueRosterSearch(event.target,true);
 }
});
$('#panel').addEventListener('input',event=>{
 const {group,key,index}=event.target.dataset;
 if(!group || !key) return;
 const row=index===undefined?state[group]:state[group][Number(index)];
 const previousValue=row[key];
 row[key]=event.target.value;
 if(group==='roster'&&key==='unit'){
  const container=event.target.closest('.row');
  if(row.sheet&&row.unit.trim()!==(previousValue||'').trim()){
   delete row.sheet;
   row.bv='';
   container.querySelector('input[data-key="bv"]').value='';
   container.querySelector('[data-action="unlink-unit"]')?.remove();
   container.querySelector('[data-action="link-unit"]').textContent='Link unit sheet';
  }
  container.querySelector('h3').innerHTML=unitLink(row,Number(index));
  queueRosterSearch(event.target);
 }
 if(group==='roster'&&['formation','unit'].includes(key))renderFormations();
 save();totals();
});
$('#resolveContract form[data-resolution]').addEventListener('submit',resolveContract);
$('#panel').addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');
 if(!button) return;
 const {action,group,index}=button.dataset;
 const row=state.roster[Number(index)];
 if(action==='link-unit'){
  const roster=state.roster;
  MechLibrary.pick(row.unit,(ref,title,bv)=>{
   if(state.roster!==roster||!roster.includes(row))return;
   saveRosterLink(row,ref,title,bv);
  });return;
 }
 if(action==='unlink-unit'){delete row.sheet;save();render();return;}
 if(action==='view-unit-sheet'){event.preventDefault();MechLibrary.view(row.sheet);return;}
 if(action==='formation-sheets'){
  const formation=button.dataset.formation;
  MechLibrary.formation(formation||'Unassigned',state.roster.filter(unit=>formationName(unit)===formation));return;
 }
 if(action==='export'){exportBackup();return;}
 if(action==='advance-month'){advanceMonth();return;}
 if(action==='resolve-contract'){openResolution();return;}
 if(action==='sign-contract'){signContract();return;}
 if(action==='manual-terms'){
   if(confirm('Edit this contract as a manual entry? The offer’s negotiation limits will no longer apply.')){
     state.draft=null;save();render();
   }
   return;
 }
 if(action==='reset-negotiation'){
   state.draft.steps={...state.draft.base};state.contract=applyNegotiatedTerms(state.contract,state.draft);
   save();render();return;
 }
 if(action==='export-board'){exportBoard();return;}
 if(action==='load-offer'){loadOffer(Number(index));return;}
 if(action==='add'){
   if(state[group].length>=1000){notify('This sheet has reached 1,000 rows.');return;}
   state[group].push({});
 } else if(action==='remove'){
   if(!confirm('Remove this row from the campaign?')) return;
   state[group].splice(Number(index),1);
 } else if(action==='copy-terms'){
   const proposed={employer:state.contract.employer,unit:state.force.name,assignment:state.contract.action,location:state.contract.location,transport:state.contract.transport,pay:state.contract.baseSP,support:[state.contract.supportMode,state.contract.support && state.contract.support+'%'].filter(Boolean).join(' '),salvage:state.contract.salvageMode==='Exchange'?'Exchange':[state.contract.salvageMode,state.contract.salvage && state.contract.salvage+'%'].filter(Boolean).join(' '),command:state.contract.command};
   for(const [key,value] of Object.entries(proposed)) if(value&&!state.employment[key]) state.employment[key]=value;
 }
 save();render();
 if(action==='add') $('[data-group="'+group+'"][data-index="'+(state[group].length-1)+'"]')?.focus();
});
$('#panel').addEventListener('change',async event=>{
 if(rosterNameInput(event.target))queueRosterSearch(event.target,true);
 const term=event.target.dataset.negotiation;
 if(term&&state.draft){
   const steps=validSteps({...state.draft.steps,[term]:Number(event.target.value)});
   if(!steps)return;
   state.draft.steps=steps;state.contract=applyNegotiatedTerms(state.contract,state.draft);
   save();render();$('[data-negotiation="'+term+'"]')?.focus();return;
 }
 const file=event.target.files?.[0];
 if(!file) return;
 try{
   if(event.target.id==='attach'){
     if(!(await file.slice(0,1024).text()).includes('%PDF-')) throw Error('Choose a PDF rulebook.');
     attachPDF(file);
     try {await pdfStore('readwrite',store=>store.put(file,'rulebook'));notify('Rulebook attached and saved on this device.');}
     catch {notify('Rulebook attached for this session. Device storage is unavailable.');}
   } else if(event.target.id==='restore'){
     if(file.size>25_000_000) throw Error('The backup file is too large.');
     const restored=validated(JSON.parse(await file.text()));
     if(!confirm('Replace this device’s campaign with the backup?')) return;
     keepPreviousCompany();detachCompany();delete syncConfig.pendingPath;storeSyncConfig();
     state=restored;save(false);render();
   }
 } catch(error){notify(error.message);}
 finally{event.target.value='';}
});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').hidden=false;});
$('#install').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;}});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>notify('Offline installation is unavailable on this connection.'));

function boardOffers() {
 const published=state.board.published;
 return published?ContractBoard.fromSeed(published.options,missionCatalog,published.seed):[];
}
function offerCard(o) {
 const e=esc;
 const facts=[
  ['Base pay',fmt.format(o.monthly)+' SP/mo · '+o.base+'%'],
  ['Paid term',o.months+' months · '+o.deployedMonths+' on assignment'],
  ['Employer covers',fmt.format(o.coveredTravel)+' / '+fmt.format(o.grossTravel)+' SP travel'],
  ['Projected base net',fmt.format(o.projectedNet)+' SP'],
  ['Support',ContractBoard.supportText(o)],
  ['Salvage',ContractBoard.salvageText(o)],
  ['Command rights',o.command],
  ['Intensity',o.tracks+' track'+(o.tracks===1?'':'s')]
 ];
 return '<article class="offer"><div class="section-head"><span class="offer-route '+(o.travels?'travel':'')+'">'+(o.travels?'Travel required':'On-world')+'</span><span class="offer-risk">'+o.risk+' risk</span></div>'+
 '<h3>'+e(o.type)+'</h3><p class="offer-employer">'+e(o.employer)+' · '+e(o.destination)+'</p><p>'+e(ContractBoard.routeText(o))+'</p>'+
 '<div class="offer-track"><strong>'+e(o.mission)+'</strong><p>'+e(o.track)+' · '+e(o.terrain)+' · '+e(o.opponent)+'</p><p>'+e(o.objective)+'</p><p>'+e(o.condition)+'</p></div>'+
 '<dl>'+facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+e(value)+'</dd></div>').join('')+'</dl>'+
 '<button data-action="load-offer" data-index="'+o.index+'">Load into contract sheet</button></article>';
}
function renderBoard() {
 const config=state.board.options;
 const offers=boardOffers();
 const published=state.board.published;
 const travel=p=>'<option value="'+p+'"'+(config.traveling===p?' selected':'')+'>'+p+' travel / '+(10-p)+' on-world</option>';
 const scale=config.scale ?? Math.min(100,Math.max(1,Math.trunc(numeric(state.force.scale))||1));
 const stamp=published?'Published board · '+published.options.traveling+' travel / '+(10-published.options.traveling)+' on-world · Scale '+published.options.scale:'No contracts published yet';
 return '<section class="sheet"><div class="section-head"><div><h2>Contract Board</h2><p>Generate ten mercenary offers for a Clan Invasion campaign.</p></div></div>'+
 '<form id="boardForm"><div class="fields"><label>Current system<input name="system" maxlength="80" value="'+esc(config.system||'')+'" placeholder="Current system"></label>'+
 '<label>Force Scale<input name="scale" type="number" min="1" max="100" step="1" required value="'+scale+'"></label>'+
 '<label>Travel mix<select name="traveling">'+Array.from({length:9},(_,i)=>travel(i+1)).join('')+'</select></label>'+
 '<label>Travel costs<select name="model"><option value="standard">Standard transit</option><option value="jumps"'+(config.model==='jumps'?' selected':'')+'>Estimate by jumps</option></select></label></div>'+
 '<div class="actions board-actions"><button class="primary" type="submit">Publish 10 contracts</button>'+(offers.length?'<button type="button" data-action="export-board">Download board</button>':'')+'</div></form>'+
 '<p class="board-note">Terms use the Mercenaries Contract Steps Table. The generator chooses the offer mix, fictional destinations and scenarios. Jump counts are estimates for campaign planning.</p></section>'+
 '<div class="section-head"><h2 id="publishedBoard">'+stamp+'</h2></div>'+
 (offers.length?'<p>Projected base net includes maintenance and uncovered travel for the full paid term. Combat pay, repair costs and salvage vary with play.</p><div class="offer-grid">'+offers.map(offerCard).join('')+'</div>':'');
}
function downloadFile(name,type,content) {
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement('a');
 a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportBoard() {
 const offers=boardOffers();
 if(!offers.length)return;
 const configuration=state.board.published.options;
 const intro='# Mercenary contract offers\n\nScale '+configuration.scale+' · '+configuration.traveling+' travel / '+(10-configuration.traveling)+' on-world\n\n';
 const body=offers.map(o=>'## '+o.index+'. '+o.type+'\n'+ContractBoard.summary(o).map(line=>'- '+line).join('\n')).join('\n\n');
 downloadFile('mercenary-contract-board.md','text/markdown;charset=utf-8',intro+body+'\n');
 notify('Downloaded ten contract offers.');
}
function loadOffer(index) {
 const o=boardOffers().find(offer=>offer.index===index);
 if(!o)return;
 const id=state.board.published.seed+'-'+o.index;
 if(state.history.some(entry=>entry.offerId===id)){notify('This offer is already in MSRB History.');return;}
 const existing=Object.entries(state.contract).some(([key,value])=>!['starting','reputation'].includes(key)&&value!=='');
 if(existing&&!confirm('Replace the current contract terms with this offer? The roster, ledger, and starting balances will stay as they are.')) return;
 state.contract={...state.contract,name:o.type+' — '+o.mission,employer:o.employer,action:o.type,location:o.destination,
  scale:String(o.scale),base:String(o.base),baseSP:String(o.monthly),months:String(o.months),
  support:String(o.support),supportMode:o.supportMode,supportSP:'',transport:String(o.transportation),transportSP:String(o.coveredTravel),
  salvage:o.salvageMode==='Exchange'?'':String(o.salvage),salvageMode:o.salvageMode,salvageSP:'',command:o.command,
  brief:ContractBoard.summary(o).join('\n')};
 state.draft={id,base:{...o.steps},steps:{...o.steps},scale:o.scale,grossTravel:o.grossTravel,travels:o.travels};
 active='contract';save();render();notify('Offer loaded. Negotiate the terms, then sign to log it.');
}
$('#panel').addEventListener('submit',event=>{
 if(event.target.id!=='boardForm') return;
 event.preventDefault();
 if(state.board.published&&!confirm('Replace the ten offers currently on the board?')) return;
 const options=ContractBoard.settings(Object.fromEntries(new FormData(event.target)));
 state.board={options,published:{options,seed:Math.floor(Math.random()*4294967296)}};
 save();render();$('#publishedBoard')?.scrollIntoView({block:'nearest'});
 notify('Published ten contracts on this device.');
});


document.querySelector('.metrics').addEventListener('click',event=>{
 const shortcut=event.target.closest('[data-sheet]');
 if(!shortcut) return;
 active=shortcut.dataset.sheet;render();
 const target=shortcut.dataset.field;
 const control=target==='roster' ? $('[data-action="add"][data-group="roster"]') : $('[data-group="'+active+'"][data-key="'+target+'"]');
 control?.focus();
 control?.scrollIntoView({block:'center'});
});


const syncConfigKey='mercenaries-github-config-v1';
const previousCompanyKey='mercenaries-previous-company-v1';
let syncConfig={repository:'',auto:true,remote:null};
try {syncConfig={...syncConfig,...JSON.parse(localStorage.getItem(syncConfigKey)||'{}')};} catch {}
let companyRepo;
let syncTimer;
let syncBusy=false;
let syncBlocked=false;
function syncStatus(message) {$('#syncStatus').textContent=message;$('#companyDialogStatus').textContent=message;}
function storeSyncConfig() {
 try {localStorage.setItem(syncConfigKey,JSON.stringify(syncConfig));}catch {}
}
function syncBase(path) {
 const base=syncConfig.remote;
 return base&&base.repoId===companyRepo?.id&&base.path===path?base:null;
}
function detachCompany() {
 clearTimeout(syncTimer);
 syncConfig.remote=null;syncBlocked=false;storeSyncConfig();
}
function keepPreviousCompany() {
 try {localStorage.setItem(previousCompanyKey,JSON.stringify(state));}catch {}
}
function showCompanyDialog() {
 $('#companyRepo').value=syncConfig.repository;
 $('#companyAuto').checked=syncConfig.auto;
 $('#companyDialog').showModal();
 showRemoteCompanies();
}
async function showRemoteCompanies() {
 const list=$('#remoteCompanies');
 list.replaceChildren();
 const repo=companyRepo;
 if(!repo){list.textContent='Connect GitHub to see saved companies.';return;}
 list.textContent='Looking for GitHub companies…';
 try {
  const rows=await repo.list();
  if(repo!==companyRepo||!$('#companyDialog').open)return;
  if(!rows.length){list.textContent='No XML companies yet. Close this panel and use Save to create one.';return;}
  list.replaceChildren();
  for(const row of rows){
   const button=document.createElement('button');
   button.type='button';
   button.textContent=row.name;
   button.title=row.folder;
   if(rows.filter(other=>other.name===row.name).length>1)button.textContent=row.folder;
   button.addEventListener('click',()=>loadRemoteCompany(row.path));
   list.append(button);
  }
 }catch(error){if(repo===companyRepo){list.textContent='Could not list GitHub companies.';syncStatus(error.message);}}
}
async function loadRemoteCompany(path) {
 if(syncBusy||!companyRepo)return;
 const repo=companyRepo;
 const before=JSON.stringify(state);
 if(!confirm('Load this GitHub company on this device? Your current company will be available as a previous local copy.'))return;
 clearTimeout(syncTimer);syncBusy=true;
 try{
  await repo.verify();
  const file=await repo.read(path);
  if(!file)throw Error('This company was removed from GitHub.');
  const next=validated(CompanyXML.read(file.bytes));
  const hash=await CompanyXML.hash(file.bytes);
  if(repo!==companyRepo||before!==JSON.stringify(state))throw Error('Local changes arrived during Load. Try again when you finish editing.');
  keepPreviousCompany();
  state=next;syncConfig.remote={repoId:repo.id,path,sha:file.sha,hash};syncBlocked=false;storeSyncConfig();
  save(false);render();$('#companyDialog').close();
  syncStatus('Loaded from private GitHub.');
 }catch(error){syncStatus(error.message);}
 finally{syncBusy=false;}
}
function scheduleCompanySync() {
 clearTimeout(syncTimer);
 if(!companyRepo||!syncConfig.auto||!syncConfig.remote||syncBlocked)return;
 syncTimer=setTimeout(()=>syncCompany(false),1600);
}
async function syncCompany(manual) {
 if(!companyRepo){if(manual)showCompanyDialog();return;}
 if(syncBusy){if(manual)syncStatus('A company sync is already in progress.');else scheduleCompanySync();return;}
 if(!manual&&(!syncConfig.auto||!syncConfig.remote||syncBlocked||navigator.onLine===false))return;
 if(syncConfig.remote&&syncConfig.remote.repoId!==companyRepo.id){
  if(manual){syncStatus('This company is linked to a different repository. Load a company there or disconnect the existing link.');showCompanyDialog();}
  return;
 }
 const repo=companyRepo;
 const base=syncConfig.remote;
 let path=base?.path;
 if(!path&&manual){
  if(!state.force.name?.trim()){syncStatus('Enter a Force name before saving a new company to GitHub.');return;}
  const name=state.force.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'company';
  path=syncConfig.pendingPath||'companies/'+name+'-'+crypto.randomUUID().slice(0,8)+'/company.xml';
  syncConfig.pendingPath=path;storeSyncConfig();
 }
 if(!path)return;
 const captured=JSON.stringify(state);
 syncBusy=true;
 if(manual)syncStatus('Syncing company XML…');
 try {
  const result=await repo.exchange(base,path,CompanyXML.write(JSON.parse(captured)),manual);
  if(repo!==companyRepo||syncConfig.remote!==base)throw Error('Connection changed during sync. Local edits are safe.');
  if(result.pull){
   if(JSON.stringify(state)!==captured)throw Error('Edits arrived during sync. Your local changes were kept.');
   const next=validated(CompanyXML.read(result.pull));
   keepPreviousCompany();state=next;save(false);render();
  }
  syncConfig.remote=result.remote;delete syncConfig.pendingPath;syncBlocked=false;storeSyncConfig();
  syncStatus(result.pull?'Loaded newer company from GitHub.':'Company XML synced to private GitHub.');
 }catch(error){
  if(error.conflict||[401,403,409,422].includes(error.status))syncBlocked=true;
  syncStatus(error.message||'GitHub sync failed. Your local edits are safe.');
 }finally{
  syncBusy=false;
  if(JSON.stringify(state)!==captured&&!syncBlocked)scheduleCompanySync();
 }
}
$('#companyConnect').addEventListener('submit',async event=>{
 event.preventDefault();
 const input=$('#companyToken');
 const button=$('#connectCompany');
 if(button.disabled)return;
 button.disabled=true;
 try {
  const repo=new PrivateCompanyRepository($('#companyRepo').value,input.value);
  input.value='';
  await repo.verify();
  if(syncConfig.repository.toLowerCase()!==repo.name.toLowerCase())delete syncConfig.pendingPath;
  companyRepo=repo;window.dispatchEvent(new Event('company-repository-changed'));syncConfig.repository=repo.name;syncConfig.auto=$('#companyAuto').checked;syncBlocked=false;storeSyncConfig();
  syncStatus('Connected to '+repo.name+'.');
  await showRemoteCompanies();
  scheduleCompanySync();
 }catch(error){syncStatus(error.message);}
 finally{input.value='';button.disabled=false;}
});
$('#companyAuto').addEventListener('change',event=>{
 syncConfig.auto=event.target.checked;storeSyncConfig();
 if(syncConfig.auto)scheduleCompanySync();else clearTimeout(syncTimer);
});
$('#companyLoad').addEventListener('click',showCompanyDialog);
$('#companySave').addEventListener('click',()=>syncCompany(true));
$('#companyDisconnect').addEventListener('click',()=>{
 closeCompanySession();
 syncStatus('GitHub disconnected. The local company and its repository link were kept.');
});
function closeCompanySession(){
 companyRepo=undefined;window.dispatchEvent(new Event('company-repository-changed'));clearTimeout(syncTimer);$('#companyToken').value='';showRemoteCompanies();
}
$('#companyUnlink').addEventListener('click',()=>{
 if(!confirm('Unlink this local company? A later Save creates a separate file.'))return;
 detachCompany();delete syncConfig.pendingPath;storeSyncConfig();syncStatus('Local company unlinked.');
});
$('#companyXmlExport').addEventListener('click',()=>{
 try {downloadFile('mercenaries-company.xml','application/xml',CompanyXML.write(state));}
 catch(error){syncStatus(error.message);}
});
$('#companyPrevious').addEventListener('click',()=>{
 try {
  const previous=localStorage.getItem(previousCompanyKey);
  if(!previous)throw Error('No previous local company is available.');
  downloadFile('previous-mercenary-company.xml','application/xml',CompanyXML.write(validated(JSON.parse(previous))));
 }catch(error){syncStatus(error.message);}
});
$('#companyXmlImport').addEventListener('change',async event=>{
 const file=event.target.files?.[0];
 if(!file)return;
 try{
  if(syncBusy)throw Error('Wait for company sync to finish before opening a backup.');
  const isJson=/\.json$/i.test(file.name);
  if(file.size>(isJson?25_000_000:CompanyXML.MAX_BYTES))throw Error('The backup file is too large.');
  const loaded=validated(isJson?JSON.parse(await file.text()):CompanyXML.read(new Uint8Array(await file.arrayBuffer())));
  if(syncBusy)throw Error('Wait for company sync to finish before opening a backup.');
  if(!confirm('Open this backup on this device? Your current company will be available as a previous local copy.'))return;
  keepPreviousCompany();detachCompany();delete syncConfig.pendingPath;storeSyncConfig();
  state=loaded;save(false);render();$('#companyDialog').close();syncStatus('Local company backup opened.');
 }catch(error){syncStatus(error.message);}
 finally{event.target.value='';}
});
window.addEventListener('online',scheduleCompanySync);
window.addEventListener('focus',scheduleCompanySync);
window.setInterval(()=>{if(!document.hidden)syncCompany(false);},60000);

render();
