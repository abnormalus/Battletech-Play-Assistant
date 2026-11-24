
'use strict';
const fields = {
 force: [['name','Force name'],['commander','Commanding officer'],['scale','Scale','number'],['bv','Available BV','number'],['bsp','Battlefield Support Points','number']],
 contract: [['name','Contract name'],['employer','Employer'],['location','Contract location'],['action','Type of action'],['scale','Scale','number'],['base','Base pay %','number'],['baseSP','Base pay SP','number'],['support','Support %','number'],['supportMode','Support type'],['supportSP','Support SP','number'],['transport','Transportation %','number'],['transportSP','Transportation SP','number'],['salvage','Salvage %','number'],['salvageMode','Salvage type'],['salvageSP','Salvage SP','number'],['command','Command terms'],['months','Length in months','number'],['starting','Starting warchest SP','number'],['reputation','Starting reputation','number'],['brief','Mission briefing','textarea']],
 employment: [['employer','Employer'],['unit','Unit'],['assignment','Assignment'],['forces','Forces committed'],['from','Start date','date'],['until','End date','date'],['location','Reporting location'],['transport','Transportation coverage %','number'],['pay','Monthly remuneration SP','number'],['support','Support and repairs'],['salvage','Salvage terms'],['command','Command rights'],['terms','Additional terms','textarea'],['employerSignature','Employer signatory'],['unitSignature','Unit signatory']],
 roster: [['unit','Unit / variant'],['bv','Battle Value','number'],['scrap','Scrap value SP','number'],['abilities','Unit abilities'],['damage','Damage','textarea'],['repair','Repair status'],['notes','In-play notes','textarea']],
 pilots: [['name','Name'],['gunnery','Gunnery','number'],['piloting','Piloting','number'],['advance','Advances','number'],['experience','Experience'],['training','Training history','textarea'],['availability','Availability'],['special','Special pilot abilities','textarea']],
 ledger: [['date','Date','date'],['month','Month'],['event','Event'],['cost','Cost SP','number'],['cover','Coverage SP','number'],['paid','Paid SP','number'],['rep','Rep change','number']]
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
 return {date:localDate(),month:String(month),event:entry?'On contract · '+entry.contract.name:'Between contracts',
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
 state.ledger.push({date:localDate(),month:String(state.month),event:'Contract resolved · '+entry.contract.name,
  paid:String(result.paid+result.scrap),rep:String(result.rep)});
 entry.resolution=result;resolvingContract=undefined;
 $('#resolveContract').close();
 save();render();notify('Contract resolved and settlement recorded.');
}
const storageKey = 'mercenaries-campaign-v1';
const fresh = () => ({version:1,month:1,force:{},contract:{},employment:{},roster:[],pilots:[],formations:[],ledger:[],board:{options:{traveling:6,model:'standard'}},history:[],draft:null});
function localDate(){const d=new Date();return [d.getFullYear(),d.getMonth()+1,d.getDate()].map(n=>String(n).padStart(2,'0')).join('-');}
const numeric = v => Number.isFinite(Number(v)) ? Number(v) : 0;
function validated(source) {
 if (source?.version !== 1) throw Error('Choose a version 1 campaign backup.');
 source={...source,roster:source.vehicleRoster??source.roster,pilots:source.pilotRoster??source.pilots,ledger:source.financialLedger??source.ledger};
 const cleaned = fresh();
 const safeId=id=>typeof id==='string'&&/^[a-z0-9-]{1,72}$/i.test(id);
 const acceptId=(id,used)=>{const next=safeId(id)&&!used.has(id)?id:crypto.randomUUID();used.add(next);return next;};
 const pilotIds=new Set(), unitIds=new Set(), formationIds=new Set(), assigned=new Set();
 const formerNames=new Map(), legacyFormations=new Map();
 if(Array.isArray(source.pilots))cleaned.pilots=source.pilots.slice(0,1000).map(pilot=>({...values(pilot,'pilots'),id:acceptId(pilot.id,pilotIds)}));
 if(Array.isArray(source.formations))cleaned.formations=source.formations.slice(0,1000).map(item=>({id:acceptId(item.id,formationIds),name:String(item.name??'').slice(0,120)}));
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
      if(group==='roster'){
        clean.id=acceptId(row.id,unitIds);
        if(typeof row.config==='string')clean.config=row.config.slice(0,120);
        if(formationIds.has(row.formationId))clean.formationId=row.formationId;
        else if(typeof row.formation==='string'&&row.formation.trim()){
          const name=row.formation.trim().slice(0,120);
          if(!legacyFormations.has(name)){
            const id=acceptId(null,formationIds);legacyFormations.set(name,id);cleaned.formations.push({id,name});
          }
          clean.formationId=legacyFormations.get(name);
        }
        let pilotId=row.pilotId;
        if(!pilotIds.has(pilotId)&&typeof row.pilot==='string'&&row.pilot.trim()){
          const name=row.pilot.trim();
          if(!formerNames.has(name)){
            const id=acceptId(null,pilotIds);formerNames.set(name,id);cleaned.pilots.push({...values({...row,name},'pilots'),id});
          }
          pilotId=formerNames.get(name);
        }
        if(pilotIds.has(pilotId)&&!assigned.has(pilotId)){clean.pilotId=pilotId;assigned.add(pilotId);}
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
 const finances=companyFinances(state);
 state.ledger.forEach((row,index)=>{
   balance += numeric(row.cover)+numeric(row.paid)-numeric(row.cost);
   const cell=$('[data-balance="'+index+'"]');
   if(cell) cell.textContent=fmt.format(balance);
 });
 const bv=state.roster.reduce((sum,row)=>sum+numeric(row.bv),0);
 $('#balance').textContent=fmt.format(balance)+' SP';
 $('#rep').textContent=fmt.format(finances.reputation);
 const summary=$('#companyFinances');
 if(summary)summary.textContent='Current SP '+fmt.format(finances.currentSP)+' · Reputation '+fmt.format(finances.reputation)+' · Scale '+finances.scale+' · Monthly upkeep '+fmt.format(finances.monthlyUpkeepSP)+' SP';
 $('#bv').textContent=fmt.format(bv)+(state.force.bv ? ' / '+fmt.format(numeric(state.force.bv)) : '');
 $('#rosterCount').textContent=fmt.format(state.pilots.length);
 const advances=$('#forceAdvances');
 if(advances)advances.textContent=fmt.format(state.pilots.reduce((sum,pilot)=>sum+numeric(pilot.advance),0));
 $('#campaignName').textContent=state.force.name || 'Campaign sheets';
}
function recordCrew(row){return {...state.pilots.find(pilot=>pilot.id===row.pilotId),damage:row.damage,repair:row.repair};}
function unitLabel(row,index){return row.unit||'Unit '+(index+1);}
function unitLink(row,index) {
 const label=esc(unitLabel(row,index));
 return row.sheet?'<a href="#mechSheet" data-action="view-unit-sheet" data-index="'+index+'">'+label+'</a>':label;
}
function pilotOptions(row) {
 const selected=state.pilots.find(pilot=>pilot.id===row.pilotId);
 const options=state.pilots.map(pilot=>'<option value="'+esc(pilot.id)+'"'+(pilot===selected?' selected':'')+'>'+esc(pilot.name||'Unnamed pilot')+
  (pilot.availability?' · '+esc(pilot.availability):'')+'</option>').join('');
 return '<label>Assigned pilot<select data-pilot-unit="'+row.id+'"><option value="">Unassigned</option>'+options+'</select></label>'+
  (selected?'<p data-pilot-summary="'+esc(selected.id)+'">Gunnery '+esc(selected.gunnery||'—')+' · Piloting '+esc(selected.piloting||'—')+
  '<br>Special pilot abilities: '+esc(selected.special||'—')+'</p>':'');
}
function renderFormations() {
 const pilotRows=state.pilots.map((pilot,index)=>'<section class="row"><div class="section-head"><h3>'+esc(pilot.name||'New pilot')+
  '</h3><button data-action="remove-pilot" data-index="'+index+'">Remove pilot</button></div><div class="fields">'+inputs('pilots',index)+'</div></section>').join('');
 const units=state.roster.map((row,index)=>({row,index}));
 const groups=[...state.formations];
 if(units.some(({row})=>!row.formationId))groups.unshift({id:'',name:'Unassigned'});
 const formations=groups.map(formation=>{
  const members=units.filter(({row})=>(row.formationId||'')===formation.id);
  return '<section class="sheet"><div class="section-head"><h3>'+esc(formation.name)+'</h3><div class="actions">'+
   '<button data-action="add-unit" data-formation="'+formation.id+'">+ Add unit</button>'+
   '<button data-action="formation-sheets" data-formation="'+formation.id+'"'+(members.some(({row})=>row.sheet)?'':' disabled')+'>View formation sheets</button></div></div>'+
   members.map(({row,index})=>'<div class="row"><div class="section-head"><h4>'+unitLink(row,index)+(row.config?' · '+esc(row.config):'')+'</h4><div class="actions">'+
    '<button data-action="link-unit" data-index="'+index+'">'+(row.sheet?'Change linked sheet':'Find unit')+'</button>'+
    '<button data-action="remove" data-group="roster" data-index="'+index+'">Remove unit</button></div></div><div class="fields">'+inputs('roster',index)+pilotOptions(row)+'</div></div>').join('')+'</section>';
 }).join('');
 return '<section class="sheet"><div class="section-head"><h2>Pilot roster</h2><button data-action="add-pilot">+ Add pilot</button></div>'+pilotRows+'</section>'+
  '<section class="sheet"><h2>Vehicle roster</h2><form id="formationForm" class="actions"><label>Formation name<input name="name" maxlength="120" required></label><button class="primary">+ Add formation</button></form></section>'+formations;
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
   panel.innerHTML='<section class="sheet"><h2>Mercenary force record</h2><div class="fields">'+inputs('force')+
    '<label>Force skill advances<output id="forceAdvances"></output></label></div></section>'+renderFormations();
 } else if(active==='contract'){
   panel.innerHTML=campaignTimePanel()+'<section class="sheet"><h2>Company finances</h2><p id="companyFinances"></p></section><section class="sheet"><div class="section-head"><h2>Mercenary contract record</h2><button class="primary" data-action="sign-contract">Sign contract</button></div><div class="fields">'+inputs('contract')+'</div></section>'+negotiationPanel()+'<section class="sheet"><div class="section-head"><h2>Financial ledger</h2><button class="primary" data-action="add" data-group="ledger">Add transaction</button></div><p>Coverage and payments add to the balance. Enter costs as positive amounts to subtract them.</p>'+
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
function applyUnitDetails(row,details,refresh=true){
 if(!details||!state.roster.includes(row))return;
 if(details.config!==undefined)row.config=details.config;
 if(details.scrap!==undefined)row.scrap=String(details.scrap);
 if(details.bv!==undefined&&details.bv!=='')row.bv=String(details.bv);
 if(refresh){save();render();}
}
function saveRosterLink(row,ref,title,bv,input,details) {
 if(!state.roster.includes(row))return;
 const restoreFocus=document.activeElement===input;
 row.sheet=ref;row.unit=title;delete row.config;
 applyUnitDetails(row,details,false);
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
   const {ref,title,bv,...details}=await MechLibrary.readRosterEntry(entry);
   if(current())saveRosterLink(row,ref,title,bv,input,details);
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
   if(!matches.length){
    const add=document.createElement('button');add.type='button';add.textContent='Add this design';
    add.addEventListener('click',()=>{if(current())MechLibrary.add(name,(ref,title,bv,details)=>saveRosterLink(row,ref,title,bv,input,details));});
    list.append(add);return;
   }
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
 if(group==='pilots'){
  if(key==='name')event.target.closest('.row').querySelector('h3').textContent=row.name||'New pilot';
  if(['name','availability'].includes(key)){
   for(const option of document.querySelectorAll('select[data-pilot-unit] option[value="'+row.id+'"]'))option.textContent=(row.name||'Unnamed pilot')+(row.availability?' · '+row.availability:'');
  }
  if(['gunnery','piloting','special'].includes(key)){
   for(const summary of document.querySelectorAll('[data-pilot-summary="'+row.id+'"]')){
    summary.replaceChildren('Gunnery '+(row.gunnery||'—')+' · Piloting '+(row.piloting||'—'),document.createElement('br'),'Special pilot abilities: '+(row.special||'—'));
   }
  }
 }
 if(group==='roster'&&key==='unit'){
  const container=event.target.closest('.row');
  if(row.sheet&&row.unit.trim()!==(previousValue||'').trim()){
   delete row.sheet;
   row.bv='';row.scrap='';delete row.config;
   container.querySelector('input[data-key="scrap"]').value='';
   container.querySelector('input[data-key="bv"]').value='';
   container.querySelector('[data-action="unlink-unit"]')?.remove();
   container.querySelector('[data-action="link-unit"]').textContent='Link unit sheet';
  }
  container.querySelector('h4').innerHTML=unitLink(row,Number(index))+(row.config?' · '+esc(row.config):'');
  queueRosterSearch(event.target);
 }

 save();totals();
});
$('#resolveContract form[data-resolution]').addEventListener('submit',resolveContract);
$('#panel').addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');
 if(!button) return;
 const {action,group,index}=button.dataset;
 const row=state.roster[Number(index)];
 if(action==='add-pilot'){
  if(state.pilots.length>=1000)return;
  state.pilots.push({id:crypto.randomUUID(),gunnery:'4',piloting:'5',advance:'0',availability:'Available'});
  save();render();$('[data-group="pilots"][data-index="'+(state.pilots.length-1)+'"]')?.focus();return;
 }
 if(action==='remove-pilot'){
  const pilot=state.pilots[Number(index)];
  if(!confirm('Remove '+(pilot.name||'this pilot')+' from the pilot roster?'))return;
  for(const unit of state.roster)if(unit.pilotId===pilot.id)delete unit.pilotId;
  state.pilots.splice(Number(index),1);save();render();return;
 }
 if(action==='add-unit'){
  if(state.roster.length>=1000)return;
  state.roster.push({id:crypto.randomUUID(),formationId:button.dataset.formation});
  save();render();$('[data-group="roster"][data-key="unit"][data-index="'+(state.roster.length-1)+'"]')?.focus();return;
 }
 if(action==='link-unit'){
  const roster=state.roster;
  MechLibrary.pick(row.unit,(ref,title,bv,details)=>{
   if(state.roster!==roster||!roster.includes(row))return;
   saveRosterLink(row,ref,title,bv,undefined,details);
  });return;
 }
 if(action==='unlink-unit'){delete row.sheet;save();render();return;}
 if(action==='view-unit-sheet'){event.preventDefault();MechLibrary.view(row.sheet,row.config,details=>applyUnitDetails(row,details),recordCrew(row));return;}
 if(action==='formation-sheets'){
  const formation=button.dataset.formation;
  MechLibrary.formation(state.formations.find(item=>item.id===formation)?.name||'Unassigned',state.roster.filter(unit=>(unit.formationId||'')===formation).map(unit=>({...unit,pilot:recordCrew(unit)})));return;
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
   state[group].push(group==='ledger'?{date:localDate(),month:String(state.month)}:{});
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
 const unitId=event.target.dataset.pilotUnit;
 if(unitId){
  const unit=state.roster.find(row=>row.id===unitId);
  if(!unit)return;
  const id=event.target.value;
  if(id){
   const previous=state.roster.find(row=>row!==unit&&row.pilotId===id);
   if(previous&&!confirm('Reassign this pilot from '+(previous.unit||'another unit')+'?')){event.target.value=unit.pilotId||'';return;}
   if(previous)delete previous.pilotId;
   unit.pilotId=id;
  }else delete unit.pilotId;
  save();render();return;
 }
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
 if(event.target.id==='formationForm'){
  event.preventDefault();
  const name=new FormData(event.target).get('name').trim();
  if(!name||state.formations.length>=1000)return;
  state.formations.push({id:crypto.randomUUID(),name});save();render();return;
 }
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
 const control=target==='roster' ? $('[data-action="add-pilot"]') : $('[data-group="'+active+'"][data-key="'+target+'"]');
 control?.focus();
 control?.scrollIntoView({block:'center'});
});


const syncConfigKey='mercenaries-github-config-v1';
const githubKey='mercenaries-github-key-v1';
let pendingSave;
let openAfterConnect=false;
const previousCompanyKey='mercenaries-previous-company-v1';
let syncConfig={repository:'',auto:true,remote:null};
try {syncConfig={...syncConfig,...JSON.parse(localStorage.getItem(syncConfigKey)||'{}')};} catch {}
let companyRepo;
let syncTimer;
let syncBusy=false;
let syncBlocked=false;
function syncStatus(message) {for(const id of ['syncStatus','companyDialogStatus','githubStatus'])$('#'+id).textContent=message;}
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
async function syncCompany(manual,saveAs) {
 if(!companyRepo){if(manual){pendingSave=()=>syncCompany(true,saveAs);showGitHubDialog();}return;}
 if(syncBusy){if(manual)syncStatus('A company sync is already in progress.');else scheduleCompanySync();return;}
 if(!manual&&(!syncConfig.auto||!syncConfig.remote||syncBlocked||navigator.onLine===false))return;
 if(!saveAs&&syncConfig.remote&&syncConfig.remote.repoId!==companyRepo.id){
  if(manual){syncStatus('This company is linked to a different repository. Use Save as to create a copy here.');}
  return;
 }
 const repo=companyRepo;
 const prior=syncConfig.remote;
 const base=saveAs?null:prior;
 let path=base?.path;
 if(!path&&manual){
  if(!state.force.name?.trim()){syncStatus('Enter a Force name before saving a new company to GitHub.');return;}
  const name=saveAs||defaultSaveName();
  path='companies/'+name+'/company.xml';
 }
 if(!path)return;
 const captured=JSON.stringify(state);
 syncBusy=true;
 if(manual)syncStatus('Syncing company XML…');
 try {
  const result=await repo.exchange(base,path,CompanyXML.write(JSON.parse(captured)),manual);
  if(repo!==companyRepo||syncConfig.remote!==prior)throw Error('Connection changed during sync. Local edits are safe.');
  if(result.pull){
   if(JSON.stringify(state)!==captured)throw Error('Edits arrived during sync. Your local changes were kept.');
   const next=validated(CompanyXML.read(result.pull));
   keepPreviousCompany();state=next;save(false);render();
  }
  syncConfig.remote=result.remote;delete syncConfig.pendingPath;syncBlocked=false;storeSyncConfig();
  syncStatus(result.pull?'Loaded newer company from GitHub.':'Saved '+path.split('/')[1]+' to GitHub.');
 }catch(error){
  if(error.conflict||[401,403,409,422].includes(error.status))syncBlocked=true;
  syncStatus(error.conflict&&!base?'That save name is already in use. Use Save as to choose another.':error.message||'GitHub sync failed. Your local edits are safe.');
 }finally{
  syncBusy=false;
  if(JSON.stringify(state)!==captured&&!syncBlocked)scheduleCompanySync();
 }
}
function cleanSaveName(name){
 return name.trim().replace(/[\/\\\p{Cc}]/gu,'-').slice(0,120).replace(/^\.+|\.+$/g,'').trim();
}
function defaultSaveName(){
 return cleanSaveName((state.force.name?.trim()||'Mercenary company').slice(0,100)+' - '+localDate());
}
function updateConnection(){
 $('#githubConnection').textContent=companyRepo?'GitHub connected':'Connect GitHub';
 $('#githubConnection').setAttribute('aria-label',companyRepo?'GitHub connected. Manage connection':'Connect GitHub');
 $('#companyConnect').hidden=Boolean(companyRepo);
 $('#githubConnected').hidden=!companyRepo;
 $('#companyOpenConnect').hidden=Boolean(companyRepo);
 $('#githubRepository').textContent=companyRepo?.name||'';
 $('#companyAuto').checked=syncConfig.auto;
 window.dispatchEvent(new Event('company-repository-changed'));
}
function showGitHubDialog(){
 $('#companyRepo').value=syncConfig.repository;
 if($('#companyDialog').open)$('#companyDialog').close();
 if(!$('#githubDialog').open)$('#githubDialog').showModal();
}
function forgetConnection(message){
 companyRepo=undefined;
 clearTimeout(syncTimer);
 try{localStorage.removeItem(githubKey);}catch{}
 updateConnection();
 showRemoteCompanies();
 syncStatus(message);
}
async function connectCompany(repository,key){
 const repo=new PrivateCompanyRepository(repository,key);
 await repo.verify();
 repo.onUnauthorized=()=>{if(companyRepo===repo)forgetConnection('GitHub rejected the saved key. Connect again.');};
 companyRepo=repo;
 syncConfig.repository=repo.name;syncConfig.identity={id:repo.id,branch:repo.branch};syncBlocked=false;storeSyncConfig();
 updateConnection();
 syncStatus('Connected to '+repo.name+'.');
 showRemoteCompanies();
 scheduleCompanySync();
}
$('#companyConnect').addEventListener('submit',async event=>{
 event.preventDefault();
 const input=$('#companyToken'),button=$('#connectCompany');
 if(button.disabled)return;
 button.disabled=true;
 const key=input.value.trim();
 input.value='';
 try{
  await connectCompany($('#companyRepo').value,key);
  try{localStorage.setItem(githubKey,key);}catch{syncStatus('Connected. This browser could not remember the key.');}
  $('#githubDialog').close();
  const save=pendingSave;pendingSave=undefined;
  if(save)save();
  else if(openAfterConnect){openAfterConnect=false;showCompanyDialog();}
 }catch(error){syncStatus(error.message);}
 finally{button.disabled=false;}
});
$('#githubDialog').addEventListener('close',()=>{if(!companyRepo){pendingSave=undefined;openAfterConnect=false;}});
$('#githubConnection').addEventListener('click',showGitHubDialog);
$('#companyOpenConnect').addEventListener('click',()=>{openAfterConnect=true;showGitHubDialog();});
$('#companyAuto').addEventListener('change',event=>{
 syncConfig.auto=event.target.checked;storeSyncConfig();
 if(syncConfig.auto)scheduleCompanySync();else clearTimeout(syncTimer);
});
$('#companyLoad').addEventListener('click',showCompanyDialog);
$('#companySave').addEventListener('click',()=>syncCompany(true));
$('#companySaveAs').addEventListener('click',()=>{
 $('#saveMenu').open=false;
 $('#saveAsName').value=defaultSaveName();$('#saveAsDialog').showModal();
});
$('#saveAsForm').addEventListener('submit',event=>{
 event.preventDefault();
 const name=cleanSaveName($('#saveAsName').value);
 if(!name)return;
 $('#saveAsDialog').close();
 syncCompany(true,name);
});
$('#companyDisconnect').addEventListener('click',()=>forgetConnection('GitHub disconnected. The local company is still available.'));
async function restoreGitHub(){
 let key;
 const button=$('#connectCompany');
 try{
  key=localStorage.getItem(githubKey);
  if(!key||!syncConfig.repository)return;
  button.disabled=true;
  $('#githubConnection').textContent='Checking GitHub…';
  const identity=syncConfig.identity;
  if(identity?.id&&identity.branch&&!companyRepo){
   const remembered=new PrivateCompanyRepository(syncConfig.repository,key);
   remembered.id=identity.id;remembered.branch=identity.branch;
   remembered.onUnauthorized=()=>{if(companyRepo===remembered)forgetConnection('GitHub rejected the saved key. Connect again.');};
   companyRepo=remembered;updateConnection();syncStatus('Using remembered GitHub connection.');
   try{await remembered.verify();}catch(error){if(error.status===401)throw error;syncStatus('GitHub could not be reached. Your connection is remembered.');return;}
   scheduleCompanySync();
  }else await connectCompany(syncConfig.repository,key);
 }catch(error){
  if(error.status===401)forgetConnection('GitHub rejected the saved key. Connect again.');
  else{updateConnection();syncStatus('Could not verify the remembered GitHub connection. Try reconnecting.');}
 }finally{button.disabled=false;}
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
window.addEventListener('online',()=>companyRepo?scheduleCompanySync():restoreGitHub());
window.addEventListener('focus',scheduleCompanySync);
window.setInterval(()=>{if(!document.hidden)syncCompany(false);},60000);

render();
restoreGitHub();
