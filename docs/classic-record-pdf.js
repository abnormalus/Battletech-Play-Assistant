const ClassicRecordPDF=(()=>{
  const storageKey='classic-record-templates-2018';
  const templateHash='7150700caa80b528b2a175abaf2eea2fb66fb73b076e089688003dda0eb044d8';
  let loading;
  const layouts={
    mech:{index:1,nameY:120,rowsY:207,rows:12,bvY:347,tonnageX:178,
      armor:[[493,45],[486,213],[493,272],[444,60],[416,356],[518,60],[555,356],[413,213],[558,213],[403,266],[567,266]],
      internal:{HD:[472,399],CT:[472,504],LT:[439,401],RT:[538,401],LA:[404,478],RA:[540,478],LL:[416,535],RL:[529,535]},
      critical:{HD:[188,[395,403,411,419,427,435]],CT:[189,[465,473,481,489,497,505,518,526,534,542,550,558]],
        LA:[73,[405,413,421,429,438,446,458,466,474,482,490,498]],RA:[306,[405,413,421,429,438,446,458,466,474,482,490,498]],
        LT:[72,[540,548,556,564,572,580,594,602,610,618,626,634]],RT:[305,[543,551,559,567,575,583,594,602,610,618,626,634]],
        LL:[72,[676,684,692,700,712,720]],RL:[305,[676,684,692,700,712,720]]}},
    quad:{index:2,nameY:120,rowsY:207,rows:12,bvY:347,tonnageX:178,
      armor:[[493,45],[486,203],[518,361],[408,135],[420,352],[564,134],[548,352],[414,308],[553,308],[460,295],[513,295]],
      internal:{HD:[471,400],CT:[473,505],LT:[415,408],RT:[532,408],LA:[412,477],RA:[533,477],LL:[417,525],RL:[533,525]},
      critical:{HD:[188,[394,402,410,418,426,434]],CT:[189,[461,469,477,485,493,501,513,521,529,537,545,553]],
        LA:[39,[401,409,417,425,437,445]],RA:[270,[401,409,417,425,437,445]],
        LT:[71,[541,549,557,565,573,581,594,602,610,618,626,634]],RT:[305,[543,551,559,567,575,583,594,602,610,618,626,634]],
        LL:[39,[675,683,691,699,711,719]],RL:[270,[675,683,691,699,711,719]]}},
    ground:{index:4,nameY:120,rowsY:219,rows:12,bvY:356,motiveY:166,engineY:176,
      armor:[[483,63],[407,168],[568,234],[483,341],[473,179]]},
    vtol:{index:5,nameY:120,rowsY:209,rows:12,bvY:359,engineY:165,
      armor:[[483,63],[423,189],[545,255],[484,336],null,null,[546,136]]},
    naval:{index:6,nameY:120,rowsY:218,rows:14,bvY:377,motiveY:165,engineY:175,
      armor:[[483,56],[398,311],[571,378],[483,614],[480,389]]}
  };
  function loadLibrary(){
    if(globalThis.PDFLib)return Promise.resolve(globalThis.PDFLib);
    if(!loading)loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.integrity='sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';
      script.crossOrigin='anonymous';
      script.onload=()=>resolve(globalThis.PDFLib);
      script.onerror=()=>{loading=undefined;script.remove();reject(Error('Could not load the PDF writer. Check your connection.'));};
      document.head.append(script);
    });
    return loading;
  }
  const path='templates/E-CAT35001RS-BattleTech-Blank-Record-Sheets.pdf';
  const keyFor=repo=>repo?storageKey+'-'+repo.id:storageKey;
  async function validate(file){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==templateHash)throw Error('Choose the supported E-CAT35001RS BattleTech Blank Record Sheets PDF.');
    return bytes;
  }
  async function cached(key){
    try{return await pdfStore('readonly',store=>store.get(key));}catch{return undefined;}
  }
  async function remember(key,file){
    try{await pdfStore('readwrite',store=>store.put(file,key));}catch{}
  }
  const templateName=/^e[\s_-]*cat35001rs[\s_-]*battletech[\s_-]*blank[\s_-]*record[\s_-]*sheets(?:\s*\(\d+\))?\.pdf$/i;
  async function download(repo){
    const tree=await repo.api('/git/trees/'+encodeURIComponent(repo.branch)+'?recursive=1');
    const matches=tree.tree.filter(item=>item.type==='blob'&&templateName.test(item.path.split('/').pop()));
    matches.sort((a,b)=>Number(b.path===path)-Number(a.path===path));
    if(!matches.length&&tree.truncated)throw Error('GitHub returned an incomplete file list. Store the template in a smaller repository or reconnect and try again.');
    for(const item of matches){
      const blob=await repo.api('/git/blobs/'+item.sha);
      if(blob.encoding!=='base64')throw Error('GitHub did not return the template PDF.');
      const file=new Blob([CompanyXML.fromBase64(blob.content)],{type:'application/pdf'});
      try{await validate(file);return file;}catch{}
    }
    return undefined;
  }
  async function attach(file,repo){
    const bytes=await validate(file);
    if(repo){
      try{
        const result=await repo.api('/contents/'+repo.path(path),{method:'PUT',body:JSON.stringify({
          branch:repo.branch,message:'Store shared Classic record sheet template',content:CompanyXML.toBase64(bytes)
        })});
        if(!result.content?.sha)throw Error('GitHub did not confirm that the template was saved.');
      }catch(error){
        if(![409,422].includes(error.status)||!await download(repo))throw error;
      }
    }
    await remember(keyFor(repo),file);
    return file;
  }
  async function template(repo){
    const key=keyFor(repo);
    const local=await cached(key);
    if(local||!repo)return local;
    const shared=await download(repo);
    if(shared){await remember(key,shared);return shared;}
    const original=await cached(storageKey);
    return original?attach(original,repo):undefined;
  }
  async function combine(files){
    if(files.length===1)return files[0];
    const lib=await loadLibrary();
    const merged=await lib.PDFDocument.create();
    for(const file of files){
      const source=await lib.PDFDocument.load(await file.arrayBuffer());
      const pages=await merged.copyPages(source,source.getPageIndices());
      for(const page of pages)merged.addPage(page);
    }
    return new Blob([await merged.save()],{type:'application/pdf'});
  }
  const builtInPaths=new Map([[layouts.ground,'ground-vehicle-template.pdf'],[layouts.mech,'biped-mech-template.pdf']]);
  const builtIn=new Map();
  async function templateFor(repo,data){
    const path=builtInPaths.get(chooseLayout(data));
    if(!path)return template(repo);
    if(!builtIn.has(path)){
      builtIn.set(path,fetch('./'+path).then(response=>{
        if(!response.ok)throw Error('Could not load the built-in record sheet template.');
        return response.blob();
      }).catch(error=>{builtIn.delete(path);throw error;}));
    }
    return builtIn.get(path);
  }
  function chooseLayout(data){
    if(data.vehicle){
      if(/vtol/i.test(data.motive))return layouts.vtol;
      if(/naval|hydrofoil|submarine/i.test(data.motive))return layouts.naval;
      if(/airship|large support|rail/i.test(data.motive))throw Error('This vehicle needs a different Classic template.');
      return layouts.ground;
    }
    if(/tripod/i.test(data.motive))throw Error('This file has no Classic tripod template.');
    return /quad/i.test(data.motive)?layouts.quad:layouts.mech;
  }
  const safeText=value=>String(value??'').replace(/[^\x20-\x7e]/g,character=>({'’':"'",'–':'-','—':'-','·':'/'}[character]||'?'));
  async function fill(file,unit,details,data,crew){
    const lib=await loadLibrary();
    const template=await lib.PDFDocument.load(await file.arrayBuffer());
    const document=await lib.PDFDocument.create();
    const layout=chooseLayout(data);
    const [page]=await document.copyPages(template,[builtInPaths.has(layout)?0:layout.index]);
    document.addPage(page);
    const font=await document.embedFont(lib.StandardFonts.Helvetica);
    const color=lib.rgb(0.08,0.08,0.08);
    function write(target,x,y,value,max=Infinity,size=7){
      let sanitized=safeText(value);
      while(sanitized&&font.widthOfTextAtSize(sanitized,size)>max)sanitized=sanitized.slice(0,-1);
      if(sanitized)target.drawText(sanitized,{x,y:target.getHeight()-y,font,size,color});
    }
    const put=(...args)=>write(page,...args);
    const value=(n,selector)=>n?.querySelector(selector)?.textContent.trim()||'';
    const title=[details.title,details.config].filter(Boolean).join(' ');
    put(70,layout.nameY,title,168,8);
    put(layout.tonnageX||187,135,details.tons,38);
    put(88,146,data.movement.walk,30);put(88,156,data.movement.run,30);
    if(data.vehicle){
      if(layout.motiveY)put(119,layout.motiveY,data.motive,57);
      put(91,layout.engineY,value(unit,':scope > engine'),63,6);
      put(282,121,crew?.name,102);
    }else{
      put(89,166,data.movement.jump,25);
      put(282,121,crew?.name,102);
      const sinks=details.selected?.querySelector(':scope > heatsinks')||unit.querySelector(':scope > baseloadout > heatsinks');
      put(525,595,sinks?.getAttribute('number'),14,6);
    }
    put(306,133,crew?.gunnery,13);put(372,133,crew?.piloting,12);
    put(168,layout.bvY,data.adjustedBV??details.bv,62);
    put(69,layout.bvY,value(details.selected,':scope > cost')||value(unit,':scope > cost'),65,6);
    if(/clan/i.test(details.tech))put(220,155,'X',8,7);
    if(/inner sphere/i.test(details.tech))put(220,166,'X',8,7);
    const used=new Set();
    // Coordinates follow the unshaded compartments of the supplied ground template.
    const left=[[430,91],[458,146],[447,159],[443,159],[427,237],[426,240],[436,240],[419,278],[418,190]];
    const armorRegions={
      Front:[[435,85],[535,85],[506,145],[466,145]],
      Left:left,Right:left.map(([x,y])=>[971-x,y]),
      Rear:[[443,285],[529,285],[549,295],[539,307],[434,307],[422,295]],
      Turret:[[463,224],[509,224],[520,267],[453,267]]
    };
    const leftStructure=[[446,164],[458,164],[445,233],[433,233]];
    const structureRegions={
      Front:[[467,149],[504,149],[509,163],[463,163]],
      Left:leftStructure,Right:leftStructure.map(([x,y])=>[971-x,y]),
      Rear:[[443,274],[530,274],[530,282],[443,282]],
      Turret:[[466,206],[508,206],[511,220],[462,220]]
    };
    const mirror=(polygon,axis)=>polygon.map(([x,y])=>[axis-x,y]);
    const bipedArm=[[412,87],[426,91],[426,119],[422,155],[410,159],[411,125]];
    const bipedTorso=[[440,86],[464,86],[465,118],[450,118],[441,116]];
    const bipedLeg=[[450,173],[472,176],[469,199],[463,225],[468,252],[454,274],[449,295],[410,295],[422,281],[421,266],[430,230],[438,202]];
    const rearSide=[[440,309],[471,308],[470,325],[464,344],[440,343]];
    const bipedArmor={
      'Head':[[477,68],[492,68],[492,92],[477,92]],
      'Center torso':[[470,98],[501,98],[498,155],[493,184],[477,184],[473,150]],
      'Left torso':bipedTorso,'Right torso':mirror(bipedTorso,970),
      'Left arm':bipedArm,'Right arm':mirror(bipedArm,970),
      'Left leg':bipedLeg,'Right leg':mirror(bipedLeg,970),
      'Center torso rear':[[481,291],[490,291],[498,307],[498,330],[503,342],[499,361],[471,361],[467,342],[472,328],[473,308]],
      'Left torso rear':rearSide,'Right torso rear':mirror(rearSide,970)
    };
    const innerArm=[[422,414],[430,415],[431,430],[426,456],[422,473],[422,449]];
    const innerTorso=[[442,414],[458,412],[460,437],[451,434],[445,429]];
    const innerLeg=[[445,468],[462,468],[456,491],[450,514],[448,536],[445,553],[427,553],[436,539],[435,526]];
    const bipedStructure={
      HD:[[467,397],[479,397],[481,407],[475,411],[470,410],[465,406]],
      CT:[[467,414],[477,414],[478,440],[476,467],[469,467],[466,441]],
      LT:innerTorso,RT:mirror(innerTorso,945),
      LA:innerArm,RA:mirror(innerArm,945),
      LL:innerLeg,RL:mirror(innerLeg,945)
    };
    function fits(polygon,x,y,margin){
      let inside=false;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const [ax,ay]=polygon[j],[bx,by]=polygon[i];
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
        const dx=bx-ax,dy=by-ay;
        const along=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
        if(Math.hypot(x-ax-along*dx,y-ay-along*dy)<margin)return false;
      }
      return inside;
    }
    function compartmentPips(polygon,location,count){
      if(!polygon||!Number.isInteger(count)||count<1)return;
      const xs=polygon.map(point=>point[0]),ys=polygon.map(point=>point[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      for(let spacing=6;spacing>=.75;spacing-=.25){
        const radius=spacing*.35;
        const margin=radius+1.25;
        const points=[];
        for(let y=top+margin;y<=bottom-margin;y+=spacing){
          for(let x=left+margin;x<=right-margin;x+=spacing){
            if(fits(polygon,x,y,margin))points.push([x,y]);
          }
        }
        if(points.length<count)continue;
        const cx=(left+right)/2,cy=(top+bottom)/2;
        const distance=([x,y])=>((x-cx)/(right-left))**2+((y-cy)/(bottom-top))**2;
        points.sort((a,b)=>distance(a)-distance(b));
        for(const [x,y] of points.slice(0,count)){
          page.drawCircle({x,y:page.getHeight()-y,size:radius,borderWidth:Math.min(.55,spacing*.13),borderColor:color});
        }
        return;
      }
      throw Error('There are too many armor points to fit inside '+location.toLowerCase()+'.');
    }
    const keyFor=location=>({Head:0,'Center torso':1,'Center torso rear':2,'Left torso':3,'Left torso rear':4,'Right torso':5,'Right torso rear':6,'Left arm':7,'Right arm':8,'Left leg':9,'Right leg':10,'Front left leg':7,'Front right leg':8,'Rear left leg':9,'Rear right leg':10,Front:0,Left:1,Right:2,Rear:3,Turret:4,'Second turret':5,Rotor:6}[location.label]);
    if(layout===layouts.mech)page.drawRectangle({x:474,y:page.getHeight()-94,width:21,height:28,color:lib.rgb(1,1,1)});
    for(const location of data.locations){
      if(layout===layouts.mech){
        compartmentPips(bipedArmor[location.label],location.label,location.armor);
        compartmentPips(bipedStructure[location.code],location.label+' structure',location.internal);
      }
      if(layout===layouts.ground){
        compartmentPips(armorRegions[location.label],location.label,location.armor);
        compartmentPips(structureRegions[location.label],location.label+' structure',location.internal);
      }
      const point=layout.armor[keyFor(location)];
      if(point&&location.armor!==undefined){
        const formatted=String(location.armor);
        put(point[0]-font.widthOfTextAtSize(formatted,6)/2,point[1],formatted,16,6);
      }
      const internal=layout.internal?.[location.code];
      if(internal&&location.internal!==undefined){
        const formatted=String(location.internal);
        put(internal[0]-font.widthOfTextAtSize(formatted,6)/2,internal[1],formatted,14,6);
      }
    }
    const grouped=new Map();
    for(const item of data.items.filter(item=>!BattleTechSheetData.isAmmo(item))){
      const placement=[...new Set(item.placement)].join('/');
      const key=JSON.stringify([item.name,placement,item.shots]);
      if(!grouped.has(key))grouped.set(key,{...item,placement,quantity:0});
      grouped.get(key).quantity++;
    }
    const items=[...grouped.values()];
    const tracks=BattleTechSheetData.ammoTracks(data.items);
    const inventory=[...items.map(item=>({item})),...tracks.map(track=>({track}))];
    const available=(layout.rows-1)*10.8;
    const maxRows=1+Math.floor(available/6.5);
    const display=inventory.slice(0,maxRows);
    if(inventory.length>maxRows){
      const keep=Math.max(0,maxRows-1-Math.min(tracks.length,Math.floor(maxRows/2)));
      display.splice(0,display.length,...items.slice(0,keep).map(item=>({item})),
        ...tracks.slice(0,maxRows-keep-1).map(track=>({track})));
      display.push({note:'+'+(inventory.length-display.length)+' additional inventory entries'});
    }
    const spacing=Math.min(10.8,available/Math.max(1,display.length-1));
    const size=spacing>=9?6:5.2;
    display.forEach(({item,track,note},index)=>{
      const row=track&&display.length<=layout.rows?layout.rows-tracks.length+index-items.length:index;
      const y=layout.rowsY+row*spacing;
      if(item){
        put(45,y,item.quantity,12,size);
        put(59,y,item.name,58,size);
        put(120,y,item.placement,27,size);
      }else if(track){
        const remainder=track.remaining?' + '+track.remaining+' spare':'';
        const unknown=track.unknown?' + ?':'';
        const summary=track.name+': '+track.shots+' shots'+
          (track.weapons>1?' / '+track.rounds+' volleys':'')+remainder+unknown;
        const bubbles=track.rounds>0&&track.rounds<=15?track.rounds:0;
        put(44,y,summary,bubbles?125:193,size);
        for(let shot=0;shot<bubbles;shot++){
          page.drawCircle({x:173+shot*4.35,y:page.getHeight()-y+2,size:1.55,borderWidth:.48,borderColor:color});
        }
      }else put(44,y,note,193,size);
    });
    for(const slot of data.criticals){
      const target=layout.critical?.[slot.code];
      const preprinted=slot.code==='HD'?slot.slot!==3:slot.code==='CT'?slot.slot<9:
        /^(LA|RA|LL|RL)$/.test(slot.code)&&slot.slot<4;
      const key=slot.code+'/'+slot.slot;
      if(target&&target[1][slot.slot]&&!preprinted&&!used.has(key)){
        put(target[0],target[1][slot.slot],slot.name,71,5.5);used.add(key);
      }
    }
    if(data.vehicle){
      const notes=[];
      if(crew?.special)notes.push('Abilities: '+crew.special);
      if(crew?.damage||crew?.repair)notes.push('Damage / repairs: '+[crew.damage,crew.repair].filter(Boolean).join(' / '));
      for(const location of data.locations){
        const index=keyFor(location);
        if(!layout.armor[index]&&location.armor!==undefined)notes.push(location.label+' armor: '+location.armor);
        if(layout!==layouts.ground&&location.internal!==undefined)notes.push(location.label+' structure: '+location.internal);
        if(layout===layouts.ground&&location.internal!==undefined&&!structureRegions[location.label])
          notes.push(location.label+' structure: '+location.internal);
      }
      const y=layout===layouts.vtol?287:298;
      notes.slice(0,7).forEach((line,index)=>put(259,y+index*8.8,line,124,6));
    }
    return new Blob([await document.save()],{type:'application/pdf'});
  }
  return {attach,templateFor,fill,combine};
})();
