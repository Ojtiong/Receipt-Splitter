// popup.js (updated to use unitPrice / linePrice returned by contentScraper.js)

const scrapeBtn = document.getElementById('scrape');
const itemsContainer = document.getElementById('itemsContainer');
const participantsInput = document.getElementById('participants');
const exportCsvBtn = document.getElementById('exportCsv');
const exportSheetsBtn = document.getElementById('exportSheets');
const loadSavedBtn = document.getElementById('loadSaved');
const saveParticipantsBtn = document.getElementById('saveParticipants');
const statusEl = document.getElementById('status');

let items = []; // {name, image, qty, unitPrice, linePrice, assigned:[], splitCount}

function setStatus(s, ms = 4000){
  statusEl.innerText = s || '';
  if(ms > 0){
    setTimeout(()=>{ if(statusEl.innerText === s) statusEl.innerText = ''; }, ms);
  }
}

async function saveParticipants(list) {
  return new Promise(resolve => {
    chrome.storage.local.set({participants: list}, () => resolve());
  });
}

async function loadParticipants() {
  return new Promise(resolve => {
    chrome.storage.local.get(['participants'], res => {
      resolve(res.participants || '');
    });
  });
}

loadSavedBtn.addEventListener('click', async () => {
  const saved = await loadParticipants();
  participantsInput.value = saved;
  setStatus('Loaded saved participants');
});

saveParticipantsBtn.addEventListener('click', async () => {
  await saveParticipants(participantsInput.value);
  setStatus('Participants saved');
});

scrapeBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  try {
    const res = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['contentScraper.js']
    });
    // res is an array of injection results; find the first result that contains an array of items
    let scraped = [];
    if (Array.isArray(res)) {
      for (const entry of res) {
        if (entry && Array.isArray(entry.result)) {
          scraped = entry.result;
          break;
        }
      }
    } else if (res && res.result) {
      scraped = res.result;
    }
    // Normalize fields: ensure linePrice and unitPrice exist, fallback gracefully
    items = (scraped || []).map(it => ({
      name: it.name || '',
      image: it.image || '',
      qty: Number.isFinite(it.qty) ? it.qty : (it.quantity || 1),
      unitPrice: Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : (Number.isFinite(it.price) ? Number(it.price) : 0),
      linePrice: Number.isFinite(it.linePrice) ? Number(it.linePrice) : (Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : 0),
      assigned: it.assigned || [],
      splitCount: it.splitCount || 1
    })).filter(i => i.name);

    renderItems();
    setStatus(`Scraped ${items.length} items`);
  } catch (err) {
    console.error(err);
    setStatus('Scrape failed — check console or page selectors.');
  }
});

function renderItems() {
  const participants = participantsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  // ensure each item has assigned & splitCount
  items = items.map(it => ({
    ...it,
    assigned: (Array.isArray(it.assigned) && it.assigned.length) ? it.assigned : (participants.length ? [participants[0]] : []),
    splitCount: (it.splitCount && it.splitCount > 0) ? it.splitCount : 1
  }));

  itemsContainer.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr><th style="text-align:left">Item</th><th>Qty</th><th>Unit</th><th>Total</th><th>Assign (comma)</th><th>Split #</th></tr>
      </thead>
      <tbody>
      ${items.map((it, idx)=>`
        <tr class="item">
          <td style="vertical-align:middle;">
            ${it.image ? `<img src="${escapeHtml(it.image)}" width="40" height="40" style="object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle">` : ''}
            <span style="vertical-align:middle">${escapeHtml(it.name)}</span>
          </td>
          <td style="text-align:center">${it.qty}</td>
          <td style="text-align:right;padding-right:12px">$${(it.unitPrice||0).toFixed(2)}</td>
          <td style="text-align:right;padding-right:12px">$${(it.linePrice||it.unitPrice||0).toFixed(2)}</td>
          <td style="text-align:left">
            <input data-idx="${idx}" class="assignees" placeholder="e.g. Alice,Bob" value="${(it.assigned||[]).join(',')}" style="width:170px"/>
          </td>
          <td style="text-align:center"><input type="number" min="1" value="${it.splitCount||1}" data-idx="${idx}" class="splitCount" style="width:60px"/></td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;

  // wire up listeners
  Array.from(document.querySelectorAll('.assignees')).forEach(el=>{
    el.addEventListener('change', e=>{
      const idx = +e.target.dataset.idx;
      if (!Number.isFinite(idx) || !items[idx]) return;
      items[idx].assigned = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
    });
  });
  Array.from(document.querySelectorAll('.splitCount')).forEach(el=>{
    el.addEventListener('change', e=>{
      const idx = +e.target.dataset.idx;
      if (!Number.isFinite(idx) || !items[idx]) return;
      items[idx].splitCount = Math.max(1, parseInt(e.target.value) || 1);
    });
  });
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])); }

exportCsvBtn.addEventListener('click', () => {
  const csvRows = [['Item','Qty','UnitPrice','LinePrice','Assigned','SplitCount','PerPerson']];
  for(const it of items){
    // prefer linePrice for totals; fallback to unitPrice
    const total = Number.isFinite(it.linePrice) ? it.linePrice : it.unitPrice || 0;
    const perPerson = (total / (it.splitCount||1));
    csvRows.push([it.name, it.qty, (it.unitPrice||0).toFixed(2), total.toFixed(2), (it.assigned||[]).join(';'), it.splitCount||1, perPerson.toFixed(2)]);
  }
  const csvStr = csvRows.map(r => r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csvStr], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'samsclub_split.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('CSV exported');
});

exportSheetsBtn.addEventListener('click', async () => {
  // Prepare rows to send; each item becomes a row
  // Use linePrice (fallback unitPrice) for total
  const rows = items.map(it => {
    const total = Number.isFinite(it.linePrice) ? it.linePrice : it.unitPrice || 0;
    const perPerson = (total / (it.splitCount||1));
    return {
      name: it.name,
      qty: it.qty,
      unitPrice: (it.unitPrice||0).toFixed(2),
      linePrice: total.toFixed(2),
      assigned: (it.assigned||[]).join(';'),
      splitCount: it.splitCount||1,
      perPerson: perPerson.toFixed(2)
    };
  });

  chrome.runtime.sendMessage({action: 'appendToSheet', rows}, resp => {
    if(chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      setStatus('Sheets export failed: ' + chrome.runtime.lastError.message);
      return;
    }
    if(resp && resp.ok) setStatus('Appended to Google Sheet');
    else setStatus('Sheets append failed: ' + (resp && resp.error ? resp.error : 'unknown'));
  });
});
