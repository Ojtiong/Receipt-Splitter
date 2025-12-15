const scrapeBtn = document.getElementById('scrape');
const itemsContainer = document.getElementById('itemsContainer');
const participantsInput = document.getElementById('participants');
const exportCsvBtn = document.getElementById('exportCsv');
const exportSheetsBtn = document.getElementById('exportSheets');
const loadSavedBtn = document.getElementById('loadSaved');
const saveParticipantsBtn = document.getElementById('saveParticipants');
const statusEl = document.getElementById('status');

let items = []; // {name, qty, price, assigned:[], splitCount}

function setStatus(s){ statusEl.innerText = s || ''; setTimeout(()=>{ if(statusEl.innerText === s) statusEl.innerText = ''; }, 4000); }

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
    items = (res && res[0] && res[0].result) || [];
    renderItems();
    setStatus(`Scraped ${items.length} items`);
  } catch (err) {
    console.error(err);
    setStatus('Scrape failed — check console or page selectors.');
  }
});

function renderItems() {
  const participants = participantsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  items = items.map(it => ({
    ...it,
    assigned: it.assigned || (participants.length ? [participants[0]] : []),
    splitCount: it.splitCount || 1
  }));

  itemsContainer.innerHTML = `
    <table>
      <tr><th>Item</th><th>Qty</th><th>Price</th><th>Assign (comma)</th><th>Split #</th></tr>
      ${items.map((it, idx)=>`
        <tr class="item">
          <td>${escapeHtml(it.name)}</td>
          <td>${it.qty}</td>
          <td>${(it.price||0).toFixed(2)}</td>
          <td>
            <input data-idx="${idx}" class="assignees" placeholder="e.g. Alice,Bob" value="${(it.assigned||[]).join(',')}" style="width:170px"/>
          </td>
          <td><input type="number" min="1" value="${it.splitCount||1}" data-idx="${idx}" class="splitCount" style="width:60px"/></td>
        </tr>`).join('')}
    </table>
  `;

  Array.from(document.querySelectorAll('.assignees')).forEach(el=>{
    el.addEventListener('change', e=>{
      const idx = +e.target.dataset.idx;
      items[idx].assigned = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
    });
  });
  Array.from(document.querySelectorAll('.splitCount')).forEach(el=>{
    el.addEventListener('change', e=>{
      const idx = +e.target.dataset.idx;
      items[idx].splitCount = Math.max(1, parseInt(e.target.value) || 1);
    });
  });
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])); }

exportCsvBtn.addEventListener('click', () => {
  const csvRows = [['Item','Qty','Price','Assigned','SplitCount','PerPerson']];
  for(const it of items){
    const perPerson = ((it.price || 0) / (it.splitCount||1)).toFixed(2);
    csvRows.push([it.name, it.qty, (it.price||0).toFixed(2), (it.assigned||[]).join(';'), it.splitCount||1, perPerson]);
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
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  chrome.runtime.sendMessage({action: 'appendToSheet', items}, resp => {
    if(chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      setStatus('Sheets export failed: ' + chrome.runtime.lastError.message);
      return;
    }
    if(resp && resp.ok) setStatus('Appended to Google Sheet');
    else setStatus('Sheets append failed: ' + (resp && resp.error ? resp.error : 'unknown'));
  });
});
