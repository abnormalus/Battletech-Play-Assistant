const MechLibrary = (() => {
  'use strict';
  const dialog = document.querySelector('#mechLibrary');
  const connect = dialog.querySelector('#mechConnect');
  let indexedRepository;
  let indexingRepository;
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
    if (!files.length) throw Error('No .ssw or .saw unit files were found in this source.');
    sourceRepositoryId = repoId;
    entries = files.map(entry => ({
      ...entry,
      repoId,
      label: filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''),
      search: normalize(filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''))
    })).sort((a, b) => a.label.localeCompare(b.label));
    query.value = initialQuery;
    controls.hidden = false;
    status.textContent = entries.length.toLocaleString() + ' files indexed from ' + source + '.';
    renderResults();
    query.focus();
  }

  function table(headers, rows) {
    const element = document.createElement('table');
    const heading = element.createTHead().insertRow();
    for (const header of headers) {
      const cell = node('th', header);
      cell.scope = 'col';
      heading.append(cell);
    }
    const body = element.createTBody();
    for (const row of rows) {
      const line = body.insertRow();
      for (const value of row) line.insertCell().textContent = value;
    }
    return element;
  }

  function parseUnit(xml) {
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    const mech = documentXml.documentElement;
    if (!['mech', 'combatvehicle'].includes(mech.localName) || documentXml.querySelector('parsererror')) {
      throw Error('This file does not contain a readable SSW mech or SAW vehicle.');
    }
    return mech;
  }

  function showMech(mech, target) {
    const field = (parent, key) => parent.querySelector(key)?.textContent.trim() || '';
    const title = [mech.getAttribute('name'), mech.getAttribute('model')].filter(Boolean).join(' ');
    const motive = mech.querySelector('motive');
    const stats = [motive?.getAttribute('type') || field(mech, 'motive_type'),mech.getAttribute('tons') && mech.getAttribute('tons') + ' tons',
      field(mech, 'battle_value') && 'BV ' + field(mech, 'battle_value'),
      field(mech, 'year'), field(mech, 'techbase')].filter(Boolean).join(' · ');
    const heading = node('h3', title);
    heading.tabIndex = -1;
    target.replaceChildren(heading, node('p', stats), node('p', field(mech, 'baseloadout > info')));

    const locations = mech.localName === 'combatvehicle' ? [['Front','front'], ['Left','left'], ['Right','right'],
      ['Rear','rear'], ['Turret','primaryturret'], ['Second turret','secondaryturret'], ['Rotor','rotor']] : [['Head','hd'], ['Center torso','ct','ctr'], ['Left torso','lt','ltr'],
      ['Right torso','rt','rtr'], ['Left arm','la'], ['Right arm','ra'],
      ['Left leg','ll'], ['Right leg','rl'], ['Front left leg','fll'], ['Front right leg','frl'],
      ['Rear left leg','rll'], ['Rear right leg','rrl']];
    const armor = locations.map(([name, front, rear]) =>
      [name, field(mech, 'armor > ' + front), rear ? field(mech, 'armor > ' + rear) : '']
    ).filter(row => row[1] || row[2]);
    if (armor.length) target.append(node('h4', 'Armor'), table(mech.localName === 'combatvehicle' ? ['Location', 'Armor'] : ['Location', 'Front', 'Rear'],
      mech.localName === 'combatvehicle' ? armor.map(row => row.slice(0, 2)) : armor));
    for (const loadout of mech.querySelectorAll('baseloadout, loadout')) {
      const equipment = Array.from(loadout.querySelectorAll(':scope > equipment'), item =>
        [field(item, 'name'), Array.from(item.querySelectorAll('location'), location => location.textContent.trim()).join(', ')]
      ).filter(row => row[0]);
      if (equipment.length) target.append(node('h4', loadout.getAttribute('name') || 'Equipment'),
        table(['Item', 'Location'], equipment));
    }
    return title;
  }

  function printButton(label) {
    const print = node('button', label);
    print.type = 'button';
    print.addEventListener('click', () => window.print());
    return print;
  }

  async function openEntry(entry) {
    const id = ++requestId;
    sheet.replaceChildren();
    status.textContent = 'Opening ' + entry.label + '…';
    try {
      const mech = parseUnit(await entry.read());
      if (id !== requestId || !dialog.open) return;
      const title = showMech(mech, sheet);
      sheet.prepend(printButton('Print / Save as PDF'));
      if (pickUnit) {
        const link = node('button', 'Link this unit');
        link.type = 'button';
        link.className = 'primary';
        link.addEventListener('click', () => {
          if (id !== requestId || !pickUnit) return;
          const choose = pickUnit;
          dialog.close();
          choose({path:entry.path,repoId:entry.repoId},title,mech.querySelector('battle_value')?.textContent.trim() || '');
        });
        sheet.prepend(link);
      }
      status.textContent = '';
      sheet.querySelector('h3').focus();
    } catch (error) {
      if (id === requestId) status.textContent = error.message;
    }
  }

  function renderResults() {
    const search = normalize(query.value);
    results.replaceChildren();
    if (!search) {
      results.append(node('p', 'Enter a mech or vehicle name or model number.'));
      return;
    }
    const matches = entries.filter(entry => entry.search.includes(search));
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
      const files = tree.tree.filter(item => item.type === 'blob' && isUnit(item.path));
      const zip = root.tree.find(item => item.type === 'blob' && /^SSW-Master(?:-master)?\.zip$/i.test(item.path)) ||
        tree.tree.find(item => item.type === 'blob' && /(?:^|\/)SSW-Master(?:-master)?\.zip$/i.test(item.path));
      if (files.length && !tree.truncated) {
        installLibrary(files.map(item => ({
          path: folder ? folder.path + '/' + item.path : item.path,
          read: async () => new TextDecoder().decode(await blobBytes(repo, item.sha))
        })), 'GitHub', repo.id);
      } else if (zip) {
        status.textContent = 'Reading the GitHub ZIP…';
        const bytes = await blobBytes(repo, zip.sha);
        if (id !== requestId) return;
        installLibrary(zipEntries(bytes), 'the GitHub ZIP', repo.id);
      } else {
        throw Error(tree.truncated ? 'GitHub returned an incomplete file index. Try a local SSW ZIP.' :
          'No .ssw, .saw, or SSW-Master ZIP files were found on the default branch.');
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
    clearLibrary();
    status.textContent = '';
  });
  connect.addEventListener('click', () => {
    dialog.close();
    showCompanyDialog();
  });
  async function openLibrary({name = '', choose, local = false} = {}) {
    pickUnit = choose;
    initialQuery = name || '';
    sheet.replaceChildren();
    status.textContent = '';
    query.value = initialQuery;
    dialog.showModal();
    connect.hidden = Boolean(companyRepo);
    if (!local || !entries.length || sourceRepositoryId !== null) await indexGitHub();
    if (controls.hidden) {
      if (!companyRepo && !entries.length) status.textContent = 'Connect GitHub or choose the local SSW ZIP.';
      return;
    }
    renderResults();
  }

  function findEntry(ref) {
    return entries.find(entry => entry.repoId === ref.repoId && entry.path === ref.path);
  }

  async function view(ref) {
    await openLibrary({local:ref.repoId === null});
    if (!dialog.open) return;
    const entry = findEntry(ref);
    if (entry) await openEntry(entry);
    else status.textContent = 'Linked sheet unavailable. Connect its GitHub repository or load its local ZIP and retry.';
  }

  async function formation(name, units) {
    await openLibrary({local:units.every(unit => !unit.sheet || unit.sheet.repoId === null)});
    if (!dialog.open) return;
    const id = ++requestId;
    status.textContent = 'Opening formation sheets…';
    const links = node('ul', '');
    const title = node('h3', name + ' formation sheets');
    const print = printButton('Print formation / Save as PDF');
    print.disabled = true;
    sheet.replaceChildren(title, print, links);
    const loaded = new Map();
    let available = 0;
    for (const [index, unit] of units.entries()) {
      const label = unit.unit || 'Unit ' + (index + 1);
      const item = node('li', label);
      links.append(item);
      const entry = unit.sheet && findEntry(unit.sheet);
      if (!entry) {
        item.append(unit.sheet ? ' (sheet unavailable)' : ' (no linked sheet)');
        continue;
      }
      try {
        if (!loaded.has(entry)) loaded.set(entry, parseUnit(await entry.read()));
        if (id !== requestId || !dialog.open) return;
        const card = node('section', '');
        card.id = 'formation-unit-' + (index + 1);
        card.className = 'formation-unit';
        showMech(loaded.get(entry), card);
        const link = node('a', label);
        link.href = '#' + card.id;
        link.addEventListener('click', event => {
          event.preventDefault();
          card.scrollIntoView({block:'start'});
          card.querySelector('h3').focus({preventScroll:true});
        });
        item.replaceChildren(link);
        sheet.append(card);
        available++;
      } catch {
        if (id !== requestId || !dialog.open) return;
        item.append(' (could not load sheet)');
      }
    }
    print.disabled = available === 0;
    status.textContent = available ? '' : 'No formation sheets are available from the current library.';
  }

  dialog.addEventListener('close', () => {
    requestId++;
    pickUnit = undefined;
  });
  document.querySelector('#openMechLibrary').addEventListener('click', () => openLibrary());
  return {pick:(name,choose) => openLibrary({name,choose}), view, formation};
})();
