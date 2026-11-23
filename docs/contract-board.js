
'use strict';
const ContractBoard = (() => {
 // Mission IDs refer to the campaign catalog. Each profile supplies compatible track families.
 const profiles = [
  ['Garrison Duty','Defend',1,[2,4],[22,24,25,26,27,28,93],['regional governor','industrial cooperative'],['pirate raiders','rival contract force']],
  ['Cadre Duty','Meeting Engagement',1,[2,5],[54,96,101,120],['planetary militia','training command'],['militia opposition force','rival mercenary cadre']],
  ['Relief Duty','Defend',2,[1,3],[31,64,66,70,114,116],['border garrison','regional relief authority'],['raiding company','besieging force']],
  ['Defensive Campaign','Defend',2,[3,5],[23,29,30,39,74,93,115],['planetary defense command','regional governor'],['rival mercenary force','Clan raiding detachment']],
  ['Security Duty','Defend',1,[1,3],[62,63,67,68,69,71],['trade consortium','shipping cooperative'],['pirate interceptors','rival security contractor']],
  ['Covert Security Duty','Defend',2,[1,3],[63,65,75,101,111],['private intelligence office','regional trade delegate'],['undercover raiders','rival recovery team']],
  ['Objective Raid','Objective Raid',3,[1,3],[42,43,44,45,46,47,48,49,50,51],['border command','rival industrial consortium'],['facility garrison','mercenary security detail']],
  ['Extraction Raid','Objective Raid',3,[1,2],[82,84,85,86,87,88,89,90,110,118],['rescue authority','contract recovery office'],['local patrols','rival recovery team']],
  ['Reconnaissance Raid','Objective Raid',2,[1,2],[52,53,55,56,57,58,59,60,61],['border intelligence office','militia command'],['screening force','frontier scouts']],
  ['Covert Reconnaissance','Objective Raid',2,[1,2],[52,55,56,59,60,61],['private intelligence office','corporate liaison'],['sensor patrols','rival reconnaissance lance']],
  ['Diversionary Raid','Strike',3,[1,3],[38,51,72,73,78,79,107],['regional operations command','border garrison'],['relief column','rival mercenary task force']],
  ['Covert Diversionary Raid','Strike',3,[1,2],[49,51,61,102,107],['regional intelligence office','contract intermediary'],['facility security force','rival intelligence detachment']],
  ['Planetary Assault','Strike',3,[2,4],[32,33,34,35,36,37,40,41,92,94,98,117],['theater command','planetary liberation council'],['entrenched defenders','rival mercenary battlegroup']],
  ['Pirate Hunting','Meeting Engagement',2,[1,3],[74,76,77,81,87,106,112,113],['frontier trade council','convoy guild'],['pirate lance','armed smugglers']],
  ['Guerrilla Warfare','Strike',3,[2,5],[72,73,78,79,80,103,104,105],['frontier defense council','regional resistance command'],['occupation patrols','rival mercenary patrol']],
  ['Covert Guerrilla Warfare','Strike',3,[2,4],[61,72,79,102,103,104],['contract intermediary','frontier defense council'],['occupation patrols','counter-intelligence detachment']],
  ['Espionage and Sabotage','Objective Raid',3,[1,2],[45,49,59,61,85,107,108,111],['intelligence liaison','corporate security director'],['facility guards','counter-intelligence detachment']],
  ['Observation and Mole-Hunting','Objective Raid',2,[1,3],[54,57,59,60,101,111],['planetary intelligence office','port authority'],['infiltrators’ extraction team','compromised security detachment']],
  ['Retainer','Meeting Engagement',1,[2,5],[54,83,99,109,119,120],['frontier governor','trade council'],['local exercise force','opportunistic raiders']],
  ['Riot Duty','Defend',2,[1,2],[70,95,96,101,109],['civil defense authority','port authority'],['armed opportunists','rogue security units']]
 ];
 const groups = [[0,3],[1,18],[2],[4,5],[6,16],[7],[8,9,17],[10,11],[12,14,15],[13,19]];
 const conditions = {
  'Defend': ['Prepared positions offer cover.', 'Poor visibility limits early contact.', 'A relief column is delayed.'],
  'Objective Raid': ['Intelligence on the objective is incomplete.', 'An optional objective is time-sensitive.', 'A weather front complicates observation.'],
  'Strike': ['Enemy reserves may arrive late in the track.', 'Terrain restricts one approach.', 'Communications are intermittent.'],
  'Meeting Engagement': ['Neither force has reliable reconnaissance.', 'A sudden weather change affects visibility.', 'A third party complicates salvage claims.']
 };
 const terrain=['Grasslands','Broken hills','River valley','Sparse woodland','Industrial outskirts','Rocky badlands'];
 const missionTerrain={25:['Urban district'],26:['Spaceport'],27:['River crossing'],28:['Mountain pass','Canyon'],35:['Urban district'],36:['Broken hills'],37:['Coastal landing zone'],42:['Industrial outskirts','Depot complex'],43:['Depot complex'],44:['Industrial outskirts'],48:['Airfield'],50:['Rail corridor'],69:['Spaceport','Landing zone'],94:['River crossing'],98:['Mining district','Industrial outskirts']};
 const places=['Aster Reach','Bracken Hollow','Cairn’s Rest','Dunlin’s Crossing','Ember Shoal','Fenwatch','Grey Orchard','Harrow’s Gate','Ironwater','Juniper Reach','Kestrel’s Wake','Lantern Vale'];
 const basePay=[50,55,60,70,80,90,100,110,120,130,150,175,200];
 const supportPercents=[0,20,40,60,80,100,10,20,30,40,50,75,100];
 const travelPercents=[0,25,50,75,100];
 const commands={3:'Integrated',7:'House',8:'Liaison',11:'Independent'};
 const range = (v,min,max,otherwise) => {
  const n=String(v??'').trim();
  return n&&Number.isFinite(Number(n))?Math.min(max,Math.max(min,Math.trunc(Number(n)))):otherwise;
 };
 function settings(input={}) {
  return {system:String(input.system||'').trim().slice(0,80),scale:range(input.scale,1,100,1),
   traveling:range(input.traveling,1,9,6),model:input.model==='jumps'?'jumps':'standard'};
 }
 function generate(input,catalog,random=Math.random) {
  const config=settings(input);
  const roll=(min,max)=>min+Math.floor(random()*(max-min+1));
  const pick=list=>list[roll(0,list.length-1)];
  function shuffle(items) {
   const list=[...items];
   for(let i=list.length-1;i>0;i--){const j=roll(0,i);[list[i],list[j]]=[list[j],list[i]];}
   return list;
  }
  const profileOrder=shuffle(groups.map(pick));
  const travelOrder=shuffle(Array.from({length:10},(_,i)=>i<config.traveling));
  const destinations=shuffle(places.filter(place=>place.toLowerCase()!==config.system.toLowerCase()));
  const usedMissions=new Set();
  return profileOrder.map((profile,index)=>{
   const [type,track,risk,duration,ids,employers,opponents]=profiles[profile];
   const available=ids.filter(id=>catalog[id]&&!usedMissions.has(id));
   const missionId=pick(available.length?available:ids.filter(id=>catalog[id]));
   usedMissions.add(missionId);
   const [mission,objective]=catalog[missionId];
   const travels=travelOrder[index];
   const jumps=travels&&config.model==='jumps'?roll(1,8):0;
   const transit=travels?(jumps?Math.ceil(jumps/4):1):0;
   const deployedMonths=roll(...duration);
   const tracks=roll(Math.max(1,deployedMonths-1),deployedMonths);
   const grossTravel=travels?(jumps?50+50*jumps:300)*config.scale:0;
   const travelStep=travels?roll(risk===1?1:0,4):0;
   const transportation=travelPercents[travelStep];
   const coveredTravel=Math.floor(grossTravel*transportation/100);
   const payStep=roll(3+risk,7+risk)+(travels&&transportation<50?1:0);
   const base=basePay[payStep-1];
   const maintenance=500*config.scale;
   const monthly=Math.floor(maintenance*base/100);
   const supportStep=roll(risk===1?1:3,risk===1?6:risk===2?8:11);
   const support=supportPercents[supportStep-1];
   const supportMode=supportStep===1?'None':supportStep<=6?'Straight':'Battle';
   const salvageStep=track==='Strike'||track==='Objective Raid'?pick([1,3,4,5,6,7]):roll(3,12);
   const salvage=salvageStep>=4?(salvageStep-3)*10:0;
   const salvageMode=salvageStep===1?'None':salvageStep===3?'Exchange':'Share';
   const commandStep=pick(risk===1?[7,8,8,11]:[3,7,8,11]);
   return {index:index+1,type,track,mission,objective,risk:['','Routine','Contested','High'][risk],
    employer:pick(employers),opponent:pick(opponents),terrain:pick(missionTerrain[missionId]||terrain),condition:pick(conditions[track]),
    origin:config.system||'Current system', destination:travels?destinations.pop():config.system||'Current system',
    travels,jumps,transit,deployedMonths,tracks,months:transit+deployedMonths,scale:config.scale,
    grossTravel,coveredTravel,transportation,base,monthly,maintenance,
    projectedNet:(monthly-maintenance)*(transit+deployedMonths)-grossTravel+coveredTravel,
    support,supportMode,salvage,salvageMode,command:commands[commandStep],
    steps:{pay:payStep,support:supportStep,salvage:salvageStep,transport:travelStep+5,command:commandStep}};
  });
 }
 const supportText=o=>o.supportMode==='None'?'None':o.supportMode==='Battle'?`Battle ${o.support}% (full repairs; ${o.support}% eligible replacements)`:'Straight '+o.support+'% repairs';
 const salvageText=o=>o.salvageMode==='Exchange'?'Exchange (25% of salvage value toward repairs)':o.salvageMode==='None'?'None':o.salvage+'%';
 const routeText=o=>o.travels?o.origin+' to '+o.destination+(o.jumps?' · '+o.jumps+' estimated jumps':'')+' · '+o.transit+' transit month'+(o.transit===1?'':'s'):'On-world · '+o.destination;
 function summary(o) {
  return [
   'Employer: '+o.employer,'Route: '+routeText(o),'Terrain: '+o.terrain,'Opposition: '+o.opponent,
   'Contract: '+o.type+' · '+o.deployedMonths+' operational months · '+o.months+' paid months',
   'Intensity: '+o.tracks+' planned track'+(o.tracks===1?'':'s'),'Opening track: '+o.track+' · '+o.mission,'Primary objective: '+o.objective,'Complication: '+o.condition,
   'Base pay: '+o.base+'% ('+o.monthly+' SP/month)','Maintenance: '+o.maintenance+' SP/month',
   'Travel cost: '+o.grossTravel+' SP · Employer coverage: '+o.coveredTravel+' SP ('+o.transportation+'%)',
   'Support: '+supportText(o),'Salvage: '+salvageText(o),'Command: '+o.command,
   'Projected base-pay net: '+o.projectedNet+' SP before combat, repairs and salvage'
  ];
 }
 function fromSeed(input,catalog,seed) {
  let n=seed>>>0;
  return generate(input,catalog,()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;});
 }
 return {settings,generate,fromSeed,supportText,salvageText,routeText,summary};
})();

const missionCatalog = {"22":["Hold the Line","Prevent the enemy from crossing a defensive position"],"23":["Last Stand","Survive a fixed number of turns against superior forces"],"24":["Base Defense","Protect a military installation from destruction"],"25":["City Defense","Prevent the enemy from occupying or destroying urban objectives"],"26":["Spaceport Defense","Protect landing facilities and grounded DropShips"],"27":["Bridge Defense","Hold a strategically important river crossing"],"28":["Chokepoint Defense","Block movement through a mountain pass or canyon"],"29":["Artillery Defense","Protect friendly artillery batteries while they operate"],"30":["Mobile Defense","Defend several objectives with a force too small to cover all of them"],"31":["Fighting Withdrawal","Delay the enemy while withdrawing most of your force"],"32":["Breakthrough","Penetrate the enemy line and exit from the opposite map edge"],"33":["Base Assault","Capture or destroy a fortified military installation"],"34":["Bunker Busting","Destroy hardened defensive positions"],"35":["Urban Assault","Seize important buildings or districts"],"36":["Hill Assault","Capture and hold strategically important high ground"],"37":["Beachhead","Establish and secure a landing zone"],"38":["Flanking Attack","Attack enemy forces from an unexpected direction"],"39":["Counterattack","Retake territory lost during a previous battle"],"40":["Encirclement","Surround enemy forces and prevent their escape"],"41":["Command Decapitation","Disable or capture the enemy command unit"],"42":["Supply Depot Raid","Destroy or capture enemy ammunition and supplies"],"43":["Fuel Depot Raid","Destroy fuel reserves, storage tanks, or tanker vehicles"],"44":["Repair Facility Raid","Destroy repair infrastructure or immobilized enemy 'Mechs"],"45":["Communications Raid","Disable an enemy communications installation"],"46":["Radar Suppression","Destroy early warning and sensor facilities"],"47":["Artillery Raid","Locate and eliminate enemy artillery positions"],"48":["Airfield Raid","Destroy aircraft, support facilities, or hangars"],"49":["Industrial Sabotage","Disable production facilities while minimizing collateral damage"],"50":["Ammunition Train Attack","Intercept and destroy an enemy ammunition shipment"],"51":["Hit-and-Run","Inflict specified losses and escape before reinforcements arrive"],"52":["Area Reconnaissance","Visit and observe several locations on the map"],"53":["Recon in Force","Discover enemy strength by engaging its forward elements"],"54":["Patrol","Detect and intercept enemy units operating in an assigned sector"],"55":["Border Reconnaissance","Investigate suspicious activity near a border"],"56":["Sensor Sweep","Scan designated points with equipped units"],"57":["Enemy Identification","Identify specified enemy units without necessarily destroying them"],"58":["Forward Observation","Establish a position from which to direct artillery or air support"],"59":["Electronic Intelligence","Remain within sensor range of a target long enough to gather data"],"60":["Tracking Operation","Follow an enemy force to discover its destination"],"61":["Stealth Infiltration","Reach an objective while avoiding detection or minimizing enemy contact"],"62":["Supply Convoy Escort","Protect trucks carrying supplies"],"63":["VIP Escort","Deliver a valuable individual safely to a destination"],"64":["Military Column Escort","Protect a moving group of friendly combat units"],"65":["Prisoner Transport","Escort captured personnel to a holding facility"],"66":["Medical Evacuation Escort","Protect wounded personnel being transported"],"67":["Heavy Equipment Transport","Escort a slow transporter carrying valuable machinery"],"68":["Prototype Transport","Deliver an experimental weapon or vehicle intact"],"69":["DropShip Landing Escort","Secure the landing zone and approach routes for an incoming DropShip"],"70":["Civilian Evacuation","Protect noncombatants crossing the battlefield"],"71":["Supply Run","Deliver supplies through contested territory before a deadline"],"72":["Convoy Ambush","Destroy or capture a passing enemy convoy"],"73":["Roadblock","Prevent enemy reinforcements from reaching another battle"],"74":["Intercept Raiders","Catch enemy raiders before they escape"],"75":["Counter-Ambush","Survive and repel an unexpected attack"],"76":["Hunter-Killer","Locate and destroy a specific enemy combat unit"],"77":["Artillery Interception","Destroy enemy artillery while it moves between positions"],"78":["Reinforcement Interception","Defeat a reinforcement column before it joins the main enemy force"],"79":["Supply Line Interdiction","Prevent enemy logistics from crossing the map"],"80":["Escape Route Blockade","Seal off the enemy's withdrawal routes"],"81":["Pursuit","Chase down a withdrawing enemy before it reaches safety"],"82":["Downed Pilot Rescue","Recover a stranded MechWarrior"],"83":["Battlefield Salvage","Secure disabled enemy 'Mechs and recover valuable components"],"84":["Prototype Recovery","Recover a lost experimental BattleMech or vehicle"],"85":["Intelligence Extraction","Recover agents or intelligence personnel from hostile territory"],"86":["Prisoner Liberation","Free captured soldiers or civilians"],"87":["Lost Patrol Recovery","Find and extract a missing friendly patrol"],"88":["DropShip Crash Recovery","Secure a crashed DropShip's cargo or survivors"],"89":["Technical Personnel Extraction","Rescue engineers, technicians, or scientists"],"90":["Recover the Black Box","Retrieve sensitive records from a destroyed vehicle or facility"],"91":["Denial of Salvage","Destroy or remove wrecks before the enemy can recover them"],"92":["Capture the Outpost","Seize an enemy forward operating base"],"93":["Hold the Crossroads","Control a strategic road junction"],"94":["Secure the Bridge","Capture an intact bridge and prevent demolition"],"95":["Occupation Patrol","Establish control over several urban or rural locations"],"96":["Search and Clear","Eliminate hostile forces concealed in a designated area"],"97":["Forward Base Establishment","Secure territory long enough to deploy a new base"],"98":["Resource Site Capture","Take control of a mine, refinery, or industrial complex"],"99":["Communications Restoration","Restore and defend a communications relay"],"100":["Contested Territory","Control more strategic locations than the enemy at battle's end"],"101":["Security Sweep","Locate hostile units operating inside nominally friendly territory"],"102":["False Flag Operation","Carry out an operation while concealing the true employer"],"103":["Covert Supply Delivery","Deliver equipment to allied guerrillas behind enemy lines"],"104":["Insurgent Support","Assist local irregulars in defeating government forces"],"105":["Counterinsurgency","Locate and defeat organized insurgent combat units"],"106":["Smuggler Interception","Capture a shipment of illicit military equipment"],"107":["Electronic Warfare","Jam communications or disable a sensor network"],"108":["Prisoner Capture","Disable and capture a specific enemy unit rather than destroy it"],"109":["Demonstration of Force","Compel a hostile force to withdraw without suffering major losses"],"110":["Defector Extraction","Recover a high-value individual attempting to switch sides"],"111":["Evidence Seizure","Capture physical records proving enemy or corporate wrongdoing"],"112":["Meeting Engagement","Defeat or drive back an opposing force encountered unexpectedly"],"113":["Running Battle","Fight across changing terrain while both forces are in motion"],"114":["Rearguard Action","Sacrifice time and territory to allow friendly units to escape"],"115":["Spoiling Attack","Attack an enemy concentration before it can launch its planned offensive"],"116":["Relief of a Siege","Break an enemy blockade around a friendly position"],"117":["Siege Operations","Gradually eliminate defenses around an entrenched objective"],"118":["Combat Search and Rescue","Locate and extract survivors while hostile forces close in"],"119":["Battlefield Cleanup","Eliminate mines, unexploded ordnance, or abandoned hostile equipment"],"120":["Training Exercise","Conduct a simulated battle with victory objectives and limited damage"],"121":["Trial of Possession","Fight a Clan-style challenge over ownership of territory or equipment"]};
