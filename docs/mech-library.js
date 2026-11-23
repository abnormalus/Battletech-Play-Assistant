(() => {
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
    controls.hidden = true;
    results.replaceChildren();
    sheet.replaceChildren();
  }

  function installLibrary(files, source) {
    if (!files.length) throw Error('No .ssw or .saw unit files were found in this source.');
    entries = files.map(entry => ({
      ...entry,
      label: filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''),
      search: normalize(filename(entry.path).replace(/\.(?:ssw|saw)$/i, ''))
    })).sort((a, b) => a.label.localeCompare(b.label));
    query.value = '';
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

  function showMech(xml) {
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    const mech = documentXml.documentElement;
    if (!['mech', 'combatvehicle'].includes(mech.localName) || documentXml.querySelector('parsererror')) {
      throw Error('This file does not contain a readable SSW mech or SAW vehicle.');
    }
    const field = (parent, key) => parent.querySelector(key)?.textContent.trim() || '';
    const title = [mech.getAttribute('name'), mech.getAttribute('model')].filter(Boolean).join(' ');
    const motive = mech.querySelector('motive');
    const stats = [motive?.getAttribute('type') || field(mech, 'motive_type'),mech.getAttribute('tons') && mech.getAttribute('tons') + ' tons',
      field(mech, 'battle_value') && 'BV ' + field(mech, 'battle_value'),
      field(mech, 'year'), field(mech, 'techbase')].filter(Boolean).join(' · ');
    const heading = node('h3', title);
    heading.tabIndex = -1;
    const print = node('button', 'Print / Save as PDF');
    print.type = 'button';
    print.addEventListener('click', () => window.print());
    sheet.replaceChildren(heading, node('p', stats), node('p', field(mech, 'baseloadout > info')), print);

    const locations = mech.localName === 'combatvehicle' ? [['Front','front'], ['Left','left'], ['Right','right'],
      ['Rear','rear'], ['Turret','primaryturret'], ['Second turret','secondaryturret'], ['Rotor','rotor']] : [['Head','hd'], ['Center torso','ct','ctr'], ['Left torso','lt','ltr'],
      ['Right torso','rt','rtr'], ['Left arm','la'], ['Right arm','ra'],
      ['Left leg','ll'], ['Right leg','rl'], ['Front left leg','fll'], ['Front right leg','frl'],
      ['Rear left leg','rll'], ['Rear right leg','rrl']];
    const armor = locations.map(([name, front, rear]) =>
      [name, field(mech, 'armor > ' + front), rear ? field(mech, 'armor > ' + rear) : '']
    ).filter(row => row[1] || row[2]);
    if (armor.length) sheet.append(node('h4', 'Armor'), table(mech.localName === 'combatvehicle' ? ['Location', 'Armor'] : ['Location', 'Front', 'Rear'],
      mech.localName === 'combatvehicle' ? armor.map(row => row.slice(0, 2)) : armor));
    for (const loadout of mech.querySelectorAll('baseloadout, loadout')) {
      const equipment = Array.from(loadout.querySelectorAll(':scope > equipment'), item =>
        [field(item, 'name'), Array.from(item.querySelectorAll('location'), location => location.textContent.trim()).join(', ')]
      ).filter(row => row[0]);
      if (equipment.length) sheet.append(node('h4', loadout.getAttribute('name') || 'Equipment'),
        table(['Item', 'Location'], equipment));
    }
    heading.focus();
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
      button.addEventListener('click', async () => {
        const id = ++requestId;
        sheet.replaceChildren();
        status.textContent = 'Opening ' + entry.label + '…';
        try {
          const xml = await entry.read();
          if (id !== requestId) return;
          showMech(xml);
          status.textContent = '';
        } catch (error) {
          if (id === requestId) status.textContent = error.message;
        }
      });
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
        })), 'GitHub');
      } else if (zip) {
        status.textContent = 'Reading the GitHub ZIP…';
        const bytes = await blobBytes(repo, zip.sha);
        if (id !== requestId) return;
        installLibrary(zipEntries(bytes), 'the GitHub ZIP');
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
  document.querySelector('#openMechLibrary').addEventListener('click', () => {
    dialog.showModal();
    indexGitHub();
  });
})();
