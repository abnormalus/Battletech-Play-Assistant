/*
Copyright (c) 2008~2009, Justin R. Bengtson (poopshotgun@yahoo.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
        this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
    * Neither the name of Justin R. Bengtson nor the names of contributors may
        be used to endorse or promote products derived from this software
        without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
 // Data rules adapted from Solaris Skunk Werks. Presentation is supplied by the PWA.
const BattleTechSheetData=(()=>{
  const standard=[
    [4, 3, 1, 2],
    [5, 4, 2, 3],
    [6, 5, 3, 4],
    [8, 6, 4, 6],
    [10, 7, 5, 7],
    [11, 8, 6, 8],
    [12, 10, 6, 10],
    [14, 11, 7, 11],
    [16, 12, 8, 12],
    [18, 13, 9, 13],
    [20, 14, 10, 14],
    [21, 15, 10, 15],
    [22, 15, 11, 15],
    [23, 16, 12, 16],
    [25, 17, 13, 17],
    [27, 18, 14, 18],
    [29, 19, 15, 19],
    [30, 20, 16, 20],
    [31, 21, 17, 21]
  ];
  const superheavy=[
    [32, 22, 17, 22],
    [33, 23, 18, 23],
    [35, 24, 19, 24],
    [36, 25, 20, 25],
    [38, 26, 21, 26],
    [39, 27, 21, 27],
    [41, 28, 22, 28],
    [42, 29, 23, 29],
    [44, 31, 24, 31],
    [45, 32, 25, 32],
    [47, 33, 26, 33],
    [48, 34, 26, 34],
    [50, 35, 27, 35],
    [51, 36, 28, 36],
    [53, 37, 29, 37],
    [54, 38, 30, 38],
    [56, 39, 31, 39],
    [57, 40, 31, 40],
    [59, 41, 32, 41],
    [60, 42, 33, 42]
  ];
  const crewFactors=[
    [2.42, 2.31, 2.21, 2.1, 1.93, 1.75, 1.68, 1.59, 1.5],
    [2.21, 2.11, 2.02, 1.92, 1.76, 1.6, 1.54, 1.46, 1.38],
    [1.93, 1.85, 1.76, 1.68, 1.54, 1.4, 1.35, 1.28, 1.21],
    [1.66, 1.58, 1.51, 1.44, 1.32, 1.2, 1.16, 1.1, 1.04],
    [1.38, 1.32, 1.26, 1.2, 1.1, 1, 0.95, 0.9, 0.85],
    [1.31, 1.19, 1.13, 1.08, 0.99, 0.9, 0.86, 0.81, 0.77],
    [1.24, 1.12, 1.07, 1.02, 0.94, 0.85, 0.81, 0.77, 0.72],
    [1.17, 1.06, 1.01, 0.96, 0.88, 0.8, 0.76, 0.72, 0.68],
    [1.1, 0.99, 0.95, 0.9, 0.83, 0.75, 0.71, 0.68, 0.64]
  ];

  const mechLocations=[
    ['Head','hd','HD'],['Center torso','ct','CT'],['Center torso rear','ctr'],
    ['Left torso','lt','LT'],['Left torso rear','ltr'],['Right torso','rt','RT'],
    ['Right torso rear','rtr'],['Left arm','la','LA'],['Right arm','ra','RA'],
    ['Left leg','ll','LL'],['Right leg','rl','RL'],['Center leg','cl','CL']
  ];
  const vehicleLocations=[['Front','front'],['Left','left'],['Right','right'],['Rear','rear'],
    ['Turret','primaryturret'],['Second turret','secondaryturret'],['Rotor','rotor']];
  const children=node=>Array.from(node?.children||[]);
  const child=(node,name)=>children(node).find(item=>item.localName===name);
  const text=node=>node?.textContent.trim()||'';
  const value=(node,name)=>text(child(node,name));
  const attr=(node,name)=>node?.getAttribute(name)??'';
  const num=value=>value===''||!Number.isFinite(Number(value))?undefined:Number(value);

  function locations(armor,internal,drive,tons,vehicle,motive){
    const quad=/quad/i.test(motive),tripod=/tripod/i.test(motive);
    const turret=attr(drive,'turret');
    const rows=vehicle?vehicleLocations.filter(([,key],index)=>index<4||child(armor,key)&&num(value(armor,key))>0||
      key==='primaryturret'&&/single|dual|double/i.test(turret)||
      key==='secondaryturret'&&/dual|double/i.test(turret)||key==='rotor'&&/vtol/i.test(motive)):
      mechLocations.filter(([,key])=>key!=='cl'||tripod);
    const points=tons>100?superheavy[(tons-105)/5]:standard[tons/5-2];
    return rows.map(([label,key,code])=>{
      const leg={la:['Front left leg','fll'],ra:['Front right leg','frl'],ll:['Rear left leg','rll'],rl:['Rear right leg','rrl']}[key];
      if(quad&&leg){label=leg[0];if(child(armor,leg[1]))key=leg[1];}
      const index=code==='CT'?0:['LT','RT'].includes(code)?1:['LA','RA'].includes(code)&&!quad?2:3;
      const calculated=vehicle?(tons>0?Math.ceil(tons/10):undefined):
        code==='HD'?(tons>100?4:3):code?points?.[index]:undefined;
      return {label,code,armor:num(value(armor,key)),internal:code||vehicle?num(value(internal,key))??calculated:undefined};
    });
  }

  function speeds(unit,base,loadout,vehicle,tons,drive,armor){
    const engine=child(unit,'engine'),rating=num(attr(engine,'rating'));
    const summary=value(loadout,'info')||value(base,'info');
    // A saved SSW summary can include adjusted movement, such as the MASC running speed.
    const recorded=summary.match(/\b\d+(?:\.\d+)?t\s*,\s*(\d+(?:\[[^\]]+\])?)\/(\d+(?:\[[^\]]+\])?)(?:\/(\d+(?:\[[^\]]+\])?))?/i);
    const speed=vehicle?num(attr(drive,'cruise')):rating!==undefined&&tons>0?
      Math.floor(rating/tons/(/primitive/i.test(text(engine))?1.2:1)):undefined;
    const run=speed===undefined?undefined:Math.max(0,Math.floor(speed*1.5+(!vehicle&&/hardened/i.test(value(armor,'type'))?-0.5:0.5)));
    const jets=child(loadout,'jumpjets')||child(base,'jumpjets');
    return {walk:recorded?.[1]??speed,run:recorded?.[2]??run,jump:recorded?.[3]??num(attr(jets,'number'))??0,
      jumpType:value(jets,'type')};
  }

  function decode(unit,details,crew){
    const vehicle=unit.localName==='combatvehicle',tons=details.tons;
    const drive=child(unit,'motive'),armor=child(unit,'armor'),structure=child(unit,'structure');
    const motive=value(unit,'motive_type')||attr(drive,'type')||attr(unit,'motive');
    const base=child(unit,'baseloadout'),loadout=details.selected;
    const items=[],criticals=[];
    function readSlots(component,name){
      return children(component).filter(item=>item.localName==='location').map(item=>{
        const code=text(item),slot=num(attr(item,'index'));
        if(Number.isInteger(slot)&&slot>=0)criticals.push({code,slot,name});
        return code;
      });
    }
    for(const design of [base,loadout]){
      for(const component of children(design)){
        if(!['equipment','heatsinks','jumpjets'].includes(component.localName))continue;
        const name=value(component,'name')||value(component,'type');
        if(!name)continue;
        const placement=readSlots(component,name);
        if(component.localName==='equipment')items.push({name,type:value(component,'type'),placement,
          shots:num(value(component,'shots')||attr(component,'shots'))});
      }
    }
    if(!vehicle){
      for(const component of [structure,armor,child(unit,'gyro'),child(unit,'cockpit')]){
        const name=value(component,'type')||text(component);
        if(name)readSlots(component,name);
      }
    }
    const factor=crewFactors[num(crew?.gunnery??'')]?.[num(crew?.piloting??'')];
    const bv=num(details.bv);
    return {vehicle,motive,armorType:value(armor,'type'),structureType:value(structure,'type'),
      locations:locations(armor,child(unit,'internal')||child(unit,'internal_structure'),drive,tons,vehicle,motive),
      movement:speeds(unit,base,loadout,vehicle,tons,drive,armor),items,criticals,
      adjustedBV:factor!==undefined&&bv!==undefined?Math.round(factor*bv):undefined};
  }
  return {decode};
})();
