const MechLibrary = (() => {
  'use strict';
  const dialog = document.querySelector('#mechLibrary');
  const connect = dialog.querySelector('#mechConnect');
  let indexedRepository;
  let indexingRepository;
  let indexingPromise;
  const query = dialog.querySelector('#mechQuery');
  const results = dialog.querySelector('#mechResults');
  const status = dialog.querySelector('#mechStatus');
  const sheet = dialog.querySelector('#mechSheet');
  const controls = dialog.querySelector('#mechSearch');
  const isUnit = path => /\.(?:ssw|saw)$/i.test(path) && !path.startsWith('__MACOSX/');
  const filename = path => path.split('/').pop();
  const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  let entries = [];
  let requestId = 0;
  let pickUnit;
  let mode='lookup';
  const customKey='mercenaries-custom-designs-v1';
  const field=(parent,key)=>parent?.querySelector(key)?.textContent.trim()||'';
  let initialQuery = '';
  let sourceRepositoryId = null;

  function node(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  async function blobBytes(repo, sha) {
    const blob = await repo.api('/git/blobs/' + sha);
    if (blob.encoding !== 'base64') throw Error('GitHub did not return readable file data.');
    return CompanyXML.fromBase64(blob.content);
  }

  function zipEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder();
    const u16 = at => view.getUint16(at, true);
    const u32 = at => view.getUint32(at, true);
    let end = bytes.length - 22;
    const min = Math.max(0, end - 65535);
    while (end >= min && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
    if (end < min || u16(end + 4) || u16(end + 6) || u16(end + 10) === 65535) {
      throw Error('Choose a standard, single-file SSW ZIP archive.');
    }
    let cursor = u32(end + 16);
    const files = [];
    for (let i = 0; i < u16(end + 10); i++) {
      if (u32(cursor) !== 0x02014b50) throw Error('The ZIP directory is invalid.');
      const flags = u16(cursor + 8), method = u16(cursor + 10);
      const size = u32(cursor + 20), expanded = u32(cursor + 24);
      const length = u16(cursor + 28), offset = u32(cursor + 42);
      const path = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + length));
      cursor += 46 + length + u16(cursor + 30) + u16(cursor + 32);
      if (!isUnit(path)) continue;
      files.push({ path, async read() {
        if (flags & 1 || expanded > 2 * 1024 * 1024 || u32(offset) !== 0x04034b50) {
          throw Error('This ZIP entry is encrypted, oversized, or invalid.');
        }
        const start = offset + 30 + u16(offset + 26) + u16(offset + 28);
        if (start + size > bytes.length) throw Error('This ZIP entry is incomplete.');
        const data = bytes.subarray(start, start + size);
        if (method === 0 && size === expanded) return decoder.decode(data);
        if (method !== 8 || typeof DecompressionStream === 'undefined') {
          throw Error('This ZIP compression is unsupported. Try the extracted repository folder.');
        }
        const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        const chunks = [];
        let total = 0;
        try {
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > expanded) throw Error('The ZIP entry exceeds its declared size.');
            chunks.push(value);
          }
          if (total !== expanded) throw Error('The ZIP entry size is invalid.');
          return new Blob(chunks).text();
        } finally {
          await reader.cancel().catch(() => {});
        }
      }});
    }
    return files;
  }

  function clearLibrary() {
    requestId++;
    entries = [];
    sourceRepositoryId = null;
    controls.hidden = true;
    results.replaceChildren();
    sheet.replaceChildren();
  }

  function installLibrary(files, source, repoId = null) {
    sourceRepositoryId = repoId;
    files=[...files,...localDesigns()];
    entries = files.map(entry => ({
      ...entry,
      repoId:entry.local?null:repoId,
      label: filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''),
      search: normalize(filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''))
    })).sort((a, b) => a.label.localeCompare(b.label));
    query.value = initialQuery;
    controls.hidden = false;
    status.textContent = entries.length.toLocaleString() + ' files indexed from ' + source + '.';
    renderResults();
    if (dialog.open) query.focus();
  }

  function parseUnit(xml) {
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    const mech = documentXml.documentElement;
    if (!['mech', 'combatvehicle'].includes(mech.localName) || documentXml.querySelector('parsererror')) {
      throw Error('This file does not contain a readable SSW mech or SAW vehicle.');
    }
    return mech;
  }

  function unitDetails(unit, configuration) {
    const alternatives=[...unit.querySelectorAll(':scope > loadout')];
    const selected=alternatives.find(item=>item.getAttribute('name')===configuration)||
      alternatives.find(item=>/^prime$/i.test(item.getAttribute('name')))||alternatives[0];
    const tech=field(unit,':scope > techbase');
    const tons=Number(unit.getAttribute('tons'));
    return {
      title:[unit.getAttribute('name'),unit.getAttribute('model')].filter(Boolean).join(' '),
      config:selected?.getAttribute('name')||'',
      bv:field(selected,':scope > battle_value')||field(unit,':scope > battle_value'),
      scrap:Number.isFinite(tons)&&tons>0?tons*(/clan|mixed/i.test(tech)||/mixed/i.test(field(unit,':scope > baseloadout > info'))?15:10):undefined,
      alternatives,selected,tech,tons
    };
  }

  function classicViewer(toolbar,title,generate,active){
    const output=node('div','');
    const frame=node('iframe','');frame.className='classic-pdf-view';
    frame.title=title;frame.hidden=true;
    const link=node('a','Open or print PDF');link.target='_blank';link.rel='noopener';link.hidden=true;
    const input=node('input','');input.type='file';input.accept='.pdf,application/pdf';input.hidden=true;
    const attach=node('button','Attach Classic blank PDF');attach.type='button';attach.hidden=true;
    attach.addEventListener('click',()=>input.click());
    let url,run=0;
    function reset(){
      frame.hidden=true;frame.removeAttribute('src');link.hidden=true;link.removeAttribute('href');
      if(url){URL.revokeObjectURL(url);url=undefined;}
    }
    dialog.addEventListener('close',()=>{run++;reset();},{once:true});
    async function refresh(file){
      const version=++run,repo=companyRepo;
      const current=()=>active()&&version===run;
      reset();attach.hidden=true;
      status.textContent=file&&repo?'Saving the Classic PDF template to GitHub…':'Preparing Classic record sheet…';
      try{
        const template=file?await ClassicRecordPDF.attach(file,repo):await ClassicRecordPDF.template(repo);
        if(!current())return;
        if(!template){
          attach.hidden=false;
          status.textContent=repo?'This library has no Classic PDF template yet. Attach it once to share it with everyone.':'Attach the Classic PDF template for this device.';
          return;
        }
        const result=await generate(template);
        if(!current())return;
        url=URL.createObjectURL(result.pdf);frame.src=url;link.href=url;
        frame.hidden=false;link.hidden=false;status.textContent=result.note||'';
      }catch(error){
        if(current()){
          status.textContent=error.message;
          if(file)attach.hidden=false;
        }
      }
    }
    input.addEventListener('change',()=>{
      const file=input.files[0];input.value='';
      if(file)refresh(file);
    });
    toolbar.append(attach,input,link);
    output.append(frame);
    return {output,refresh};
  }

  async function openEntry(entry,configuration,onChange,pilot){
    const id=++requestId;
    const active=()=>id===requestId&&dialog.open;
    sheet.replaceChildren();
    status.textContent='Opening '+entry.label+'…';
    try{
      const unit=parseUnit(await entry.read());
      if(!active())return;
      const toolbar=node('div','');toolbar.className='actions sheet-toolbar';
      let details=unitDetails(unit,configuration);
      const viewer=classicViewer(toolbar,entry.label,async template=>{
        const selected=details;
        return {pdf:await ClassicRecordPDF.fill(template,unit,selected,BattleTechSheetData.decode(unit,selected,pilot),pilot)};
      },active);
      if(details.alternatives.length){
        const label=node('label','Configuration');
        const selection=node('select','');
        for(const loadout of details.alternatives){
          const name=loadout.getAttribute('name')||'';
          const option=node('option',name);option.value=name;selection.append(option);
        }
        selection.value=details.config;
        selection.addEventListener('change',()=>{
          details=unitDetails(unit,selection.value);
          onChange?.(details);
          viewer.refresh();
        });
        label.append(selection);toolbar.prepend(label);
      }
      if(pickUnit){
        const link=node('button','Link this unit');link.type='button';link.className='primary';
        link.addEventListener('click',()=>{
          if(!active()||!pickUnit)return;
          const choose=pickUnit;dialog.close();
          choose({path:entry.path,repoId:entry.repoId},details.title,details.bv,details);
        });
        toolbar.prepend(link);
      }else if(onChange&&configuration!==details.config)onChange(details);
      sheet.replaceChildren(toolbar,viewer.output);
      await viewer.refresh();
    }catch(error){if(active())status.textContent=error.message;}
  }

  function nameMatches(name) {
    const search = normalize(name);
    if (!search) return [];
    const terms = name.toLowerCase().match(/[a-z0-9]+/g) || [];
    const matches = entries.filter(entry => entry.search.includes(search) || terms.every(term => entry.search.includes(term)));
    const exact = matches.filter(entry => entry.search === search);
    return [...exact, ...matches.filter(entry => entry.search !== search)];
  }

  async function searchRoster(name) {
    await ensureLibrary();
    const matches = nameMatches(name);
    const exact = matches.filter(entry => entry.search === normalize(name));
    return {exact:exact.length === 1 ? exact[0] : null, matches:matches.slice(0,8), total:matches.length, ready:true};
  }

  async function readRosterEntry(entry) {
    const mech = parseUnit(await entry.read());
    if (!entries.includes(entry)) throw Error('The unit library changed. Search again.');
    return {...unitDetails(mech),ref:{path:entry.path,repoId:entry.repoId}};
  }

  function renderResults() {
    const search = normalize(query.value);
    results.replaceChildren();
    if (!search) {
      results.append(node('p', 'Enter a mech or vehicle name or model number.'));
      return;
    }
    const matches = nameMatches(query.value);
    if(!matches.length){
      const add=node('button','Add this design');add.type='button';
      add.addEventListener('click',()=>showAddDesign(query.value,pickUnit));
      results.append(add);return;
    }
    results.append(node('p', matches.length ? 'Showing ' + Math.min(matches.length, 50) + ' of ' + matches.length + ' matches.' : 'No matching unit files.'));
    for (const entry of matches.slice(0, 50)) {
      const button = node('button', entry.label);
      button.type = 'button';
      button.title = entry.path;
      button.addEventListener('click', () => openEntry(entry));
      results.append(button);
    }
  }

  async function indexGitHub() {
    const repo = companyRepo;
    if (repo && repo === indexingRepository && indexingPromise) return indexingPromise;
    const pending = loadGitHubIndex();
    indexingPromise = pending;
    try { await pending; }
    finally { if (indexingPromise === pending) indexingPromise = undefined; }
  }

  async function loadGitHubIndex() {
    const repo = companyRepo;
    connect.hidden = Boolean(repo);
    if (!repo || repo === indexedRepository || repo === indexingRepository) return;
    clearLibrary();
    indexingRepository = repo;
    const id = requestId;
    status.textContent = 'Indexing the GitHub library…';
    try {
      const root = await repo.api('/git/trees/' + encodeURIComponent(repo.branch));
      const folder = root.tree.find(item => item.type === 'tree' && /^SSW-Master(?:-master)?$/i.test(item.path));
      const tree = await repo.api('/git/trees/' + (folder?.sha || encodeURIComponent(repo.branch)) + '?recursive=1');
      if (id !== requestId) return;
      const files=tree.tree.filter(item=>item.type==='blob'&&isUnit(item.path)).map(item=>({
        path:folder?folder.path+'/'+item.path:item.path,sha:item.sha
      }));
      if(folder){
        const custom=root.tree.find(item=>item.type==='tree'&&item.path==='designs');
        if(custom){
          const extra=await repo.api('/git/trees/'+custom.sha+'?recursive=1');
          if(id!==requestId)return;
          files.push(...extra.tree.filter(item=>item.type==='blob'&&isUnit(item.path)).map(item=>({path:'designs/'+item.path,sha:item.sha})));
        }
      }
      const designs=files.map(item=>({path:item.path,read:async()=>new TextDecoder().decode(await blobBytes(repo,item.sha))}));
      const extracted=files.some(item=>!item.path.startsWith('designs/'));
      const zip = root.tree.find(item => item.type === 'blob' && /^SSW-Master(?:-master)?\.zip$/i.test(item.path)) ||
        tree.tree.find(item => item.type === 'blob' && /(?:^|\/)SSW-Master(?:-master)?\.zip$/i.test(item.path));
      if(extracted&&!tree.truncated){
        installLibrary(designs,'GitHub',repo.id);
      } else if (zip) {
        status.textContent = 'Reading the GitHub ZIP…';
        const bytes = await blobBytes(repo, zip.sha);
        if (id !== requestId) return;
        installLibrary([...zipEntries(bytes),...designs], 'the GitHub ZIP', repo.id);
      } else {
        installLibrary(designs,'GitHub',repo.id);
      }
      indexedRepository = repo;
    } catch (error) {
      if (id === requestId) status.textContent = error.message;
    } finally {
      if (indexingRepository === repo) indexingRepository = undefined;
    }
  }


  const zipInput = dialog.querySelector('#mechZip');
  zipInput.addEventListener('change', async () => {
    const file = zipInput.files[0];
    if (!file) return;
    zipInput.value = '';
    indexedRepository = undefined;
    indexingRepository = undefined;
    indexingPromise = undefined;
    clearLibrary();
    const id = requestId;
    status.textContent = 'Reading the ZIP…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (id === requestId) installLibrary(zipEntries(bytes), file.name);
    } catch (error) {
      if (id === requestId) status.textContent = error.message;
    }
  });
  query.addEventListener('input', renderResults);
  window.addEventListener('company-repository-changed', () => {
    indexedRepository = undefined;
    indexingRepository = undefined;
    indexingPromise = undefined;
    clearLibrary();
    status.textContent = '';
  });
  connect.addEventListener('click', () => {
    dialog.close();
    showCompanyDialog();
  });
  async function openLibrary({name = '', choose, local = false, viewMode='lookup'} = {}) {
    mode=viewMode;
    dialog.dataset.mode=mode;
    dialog.querySelector('#mechLibraryTitle').textContent=mode==='sheet'?'BattleTech record sheet':'Mech and vehicle lookup';
    pickUnit = choose;
    initialQuery = name || '';
    sheet.replaceChildren();
    status.textContent = '';
    query.value = initialQuery;
    if(!dialog.open)dialog.showModal();
    connect.hidden = Boolean(companyRepo);
    dialog.querySelector('#mechZipChoice').hidden=Boolean(companyRepo)||mode!=='lookup';
    if(!local||!entries.length||sourceRepositoryId!==null)await ensureLibrary();
    controls.hidden=mode==='sheet';
    if(mode!=='sheet')renderResults();
  }

  function readLocalDesigns(){
    try{return JSON.parse(localStorage.getItem(customKey)||'{}');}catch{return {};}
  }

  function localDesigns(){
    return Object.entries(readLocalDesigns()).map(([path,xml])=>({path,local:true,read:async()=>xml}));
  }

  async function ensureLibrary(){
    if(companyRepo)await indexGitHub();
    else if(!entries.length)installLibrary([],'local designs');
  }

  async function showAddDesign(name,choose){
    if(!dialog.open)await openLibrary({name,choose,viewMode:choose?'picker':'lookup'});
    const id=++requestId;
    const box=node('section','');
    box.className='sheet';
    box.append(node('h3','Add this design'));
    const repo=companyRepo;
    if(!repo){
      box.append(node('p','Connect GitHub to add designs to the shared library.'));
      const connectButton=node('button','Connect GitHub');
      connectButton.type='button';
      connectButton.addEventListener('click',()=>{
        const githubDialog=document.querySelector('#githubDialog');
        githubDialog.addEventListener('close',()=>{
          if(companyRepo)showAddDesign(name,choose);
        },{once:true});
        dialog.close();
        showGitHubDialog();
      });
      box.append(connectButton);
      sheet.replaceChildren(box);status.textContent='';
      return;
    }
    box.append(node('p','Attaching a design saves it to '+repo.name+' and adds it to the shared library.'));
    const label=node('label','Attach a Solaris Skunk Werks or Solaris Armor Werks design');
    const input=node('input','');
    input.type='file';input.accept='.ssw,.saw';label.append(input);box.append(label);
    sheet.replaceChildren(box);status.textContent='';
    input.addEventListener('change',async()=>{
      const file=input.files[0];
      if(!file)return;
      input.disabled=true;
      try{
        if(!isUnit(file.name)||file.size>200000)throw Error('Choose an .ssw or .saw file up to 200 KB.');
        const xml=await file.text();
        if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Design XML cannot include a DOCTYPE or entities.');
        const unit=parseUnit(xml);
        const details=unitDetails(unit);
        if(!details.title)throw Error('The design is missing its name.');
        const ext=unit.localName==='mech'?'.ssw':'.saw';
        const filename=details.title.replace(/[^\p{L}\p{N} .()_-]/gu,'_').slice(0,120)+ext;
        const bytes=new TextEncoder().encode(xml);
        const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
          .map(byte=>byte.toString(16).padStart(2,'0')).join('');
        const path='designs/'+fingerprint+'/'+filename;
        const location='/contents/'+repo.path(path);
        const content=CompanyXML.toBase64(bytes);
        if(id!==requestId||!dialog.open)return;
        if(repo!==companyRepo)throw Error('The GitHub connection changed. Reopen Add this design and try again.');
        status.textContent='Saving design to '+repo.name+'…';
        let saved;
        try{
          const result=await repo.api(location,{method:'PUT',body:JSON.stringify({
            branch:repo.branch,message:'Add custom BattleTech design',content
          })});
          saved=result.content;
        }catch(error){
          if(![409,422].includes(error.status))throw error;
          try{saved=await repo.api(location+'?ref='+encodeURIComponent(repo.branch));}
          catch{throw error;}
          if(saved.encoding!=='base64'||saved.content.replace(/\s/g,'')!==content)throw error;
        }
        if(!saved?.sha)throw Error('GitHub did not confirm the saved design. Attach the file again to retry.');
        if(id!==requestId||!dialog.open||repo!==companyRepo)return;
        const entry={path,label:details.title,repoId:repo.id,search:normalize(details.title),read:async()=>xml};
        if(!entries.some(item=>item.path===path&&item.repoId===repo.id))entries.push(entry);
        pickUnit=choose;
        await openEntry(entries.find(item=>item.path===path&&item.repoId===repo.id));
        if(dialog.open&&repo===companyRepo&&!status.textContent)status.textContent='Design saved to '+repo.name+'.';
      }catch(error){if(id===requestId)status.textContent=error.message;}
      finally{input.disabled=false;input.value='';}
    });
  }

  function findEntry(ref) {
    return entries.find(entry=>entry.repoId===ref.repoId&&entry.path===ref.path)||
      (ref.repoId===null?localDesigns().find(entry=>entry.path===ref.path):undefined);
  }

  async function view(ref,configuration,onChange,pilot) {
    await openLibrary({local:ref.repoId === null,viewMode:'sheet'});
    if (!dialog.open) return;
    const entry = findEntry(ref);
    if(entry)await openEntry(entry,configuration,onChange,pilot);
    else status.textContent='This linked design is unavailable in the current library.';
  }

  async function formation(name,units){
    await openLibrary({local:units.every(unit=>!unit.sheet||unit.sheet.repoId===null),viewMode:'sheet'});
    if(!dialog.open)return;
    const id=++requestId;
    const active=()=>id===requestId&&dialog.open;
    const toolbar=node('div','');toolbar.className='actions sheet-toolbar';
    const title=name+' formation sheets';
    toolbar.append(node('strong',title));
    const viewer=classicViewer(toolbar,title,async template=>{
      const files=[],skipped=[],loaded=new Map();
      for(const [index,unit] of units.entries()){
        if(!active())throw Error('The formation viewer was closed.');
        const entry=unit.sheet&&findEntry(unit.sheet);
        try{
          if(!entry)throw Error('Design unavailable.');
          if(!loaded.has(entry))loaded.set(entry,parseUnit(await entry.read()));
          const design=loaded.get(entry),details=unitDetails(design,unit.config);
          files.push(await ClassicRecordPDF.fill(template,design,details,BattleTechSheetData.decode(design,details,unit.pilot),unit.pilot));
        }catch{skipped.push(unit.unit||'Unit '+(index+1));}
      }
      if(!files.length)throw Error('No Classic sheets available for this formation.');
      return {pdf:await ClassicRecordPDF.combine(files),note:skipped.length?'Sheets unavailable for '+skipped.join(', ')+'.':''};
    },active);
    sheet.replaceChildren(toolbar,viewer.output);
    await viewer.refresh();
  }

  dialog.addEventListener('close', () => {
    requestId++;
    pickUnit = undefined;
  });
  document.querySelector('#openMechLibrary').addEventListener('click', () => openLibrary());
  return {pick:(name,choose) => openLibrary({name,choose,viewMode:'picker'}),add:showAddDesign,view,formation,searchRoster,readRosterEntry};
})();
