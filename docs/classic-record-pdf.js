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
  async function download(repo){
    const ref='?ref='+encodeURIComponent(repo.branch);
    let metadata;
    try{metadata=await repo.api('/contents/'+repo.path(path)+ref);}
    catch(error){if(error.status===404)return undefined;throw error;}
    if(!metadata.sha||metadata.type!=='file')throw Error('The GitHub template path does not point to a PDF file.');
    const blob=await repo.api('/git/blobs/'+metadata.sha);
    if(blob.encoding!=='base64')throw Error('GitHub did not return the template PDF.');
    const file=new Blob([CompanyXML.fromBase64(blob.content)],{type:'application/pdf'});
    await validate(file);
    return file;
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
    const [page]=await document.copyPages(template,[layout.index]);
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
    const keyFor=location=>({Head:0,'Center torso':1,'Center torso rear':2,'Left torso':3,'Left torso rear':4,'Right torso':5,'Right torso rear':6,'Left arm':7,'Right arm':8,'Left leg':9,'Right leg':10,'Front left leg':7,'Front right leg':8,'Rear left leg':9,'Rear right leg':10,Front:0,Left:1,Right:2,Rear:3,Turret:4,'Second turret':5,Rotor:6}[location.label]);
    for(const location of data.locations){
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
    for(const item of data.items){
      const placement=[...new Set(item.placement)].join('/');
      const key=JSON.stringify([item.name,placement,item.shots]);
      if(!grouped.has(key))grouped.set(key,{...item,placement,quantity:0});
      grouped.get(key).quantity++;
    }
    const items=[...grouped.values()];
    let index=0;
    for(const item of items.slice(0,layout.rows)){
      const y=layout.rowsY+index++*10.8;
      put(45,y,item.quantity,12,6);put(59,y,item.name,58,6);put(120,y,item.placement,27,6);
    }
    const extra=[];
    for(const slot of data.criticals){
      const target=layout.critical?.[slot.code];
      const preprinted=slot.code==='HD'?slot.slot!==3:slot.code==='CT'?slot.slot<9:
        /^(LA|RA|LL|RL)$/.test(slot.code)&&slot.slot<4;
      const key=slot.code+'/'+slot.slot;
      if(target&&target[1][slot.slot]&&!preprinted&&!used.has(key)){
        put(target[0],target[1][slot.slot],slot.name,71,5.5);used.add(key);
      }else if(!data.vehicle)extra.push(slot.code+' '+(slot.slot+1)+'  '+slot.name);
    }
    const overflow=[...items.slice(layout.rows).map(item=>item.quantity+' × '+item.name+'  '+item.placement),...extra];
    if(crew?.special)overflow.push('Special pilot abilities: '+crew.special);
    if(crew?.damage||crew?.repair)overflow.push('Damage / repairs: '+[crew.damage,crew.repair].filter(Boolean).join(' / '));
    if(data.vehicle){
      for(const location of data.locations){
        const at=keyFor(location);
        if(!layout.armor[at]&&location.armor!==undefined)overflow.push(location.label+' armor: '+location.armor);
        if(location.internal!==undefined)overflow.push(location.label+' structure: '+location.internal);
      }
    }
    for(let i=0;i<overflow.length;i+=45){
      const supplement=document.addPage([612,765]);
      write(supplement,45,58,title+' - Record sheet supplement',520,15);
      overflow.slice(i,i+45).forEach((line,offset)=>write(supplement,45,86+offset*14,line,520,9));
    }
    return new Blob([await document.save()],{type:'application/pdf'});
  }
  return {attach,template,fill,combine};
})();
