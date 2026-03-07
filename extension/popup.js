// Replace your URL here
const { APPS_SCRIPT_URL, DEBUG, NO_CORS, STORE_NAME } = CONFIG;

if (DEBUG) {
  console.log("Debug mode enabled");
}

// UI elements
const scrapeBtn = document.getElementById('scrape');
const itemsContainer = document.getElementById('itemsContainer');
const participantsInput = document.getElementById('participants');
const exportCsvBtn = document.getElementById('exportCsv');
const exportSheetsBtn = document.getElementById('exportSheets');
const loadSavedBtn = document.getElementById('loadSaved');
const saveParticipantsBtn = document.getElementById('saveParticipants');
const statusEl = document.getElementById('status');

let items = []; // {name, image, qty, unitPrice, linePrice, assigned:[], splitCount}

// Utility: show short status message
function setStatus(s, ms = 3500) {
  statusEl.innerText = s || '';
  if (ms > 0) setTimeout(() => { if (statusEl.innerText === s) statusEl.innerText = ''; }, ms);
}

// Persist participants
async function saveParticipants(list) {
  return new Promise(resolve => chrome.storage.local.set({ participants: list }, resolve));
}
async function loadParticipants() {
  return new Promise(resolve => chrome.storage.local.get(['participants'], res => resolve(res.participants || '')));
}

// Load saved participants into input
loadSavedBtn.addEventListener('click', async () => {
  const saved = await loadParticipants();
  participantsInput.value = saved;
  setStatus('Loaded saved participants');
});
saveParticipantsBtn.addEventListener('click', async () => {
  await saveParticipants(participantsInput.value);
  setStatus('Participants saved');
});

// Scrape handler: inject contentScraper.js into active tab
scrapeBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['contentScraper.js']
    });

    // Find first valid result array (in case of multiple frames)
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

    // Normalize to use unitPrice / linePrice
    items = (scraped || []).map(it => ({
      name: it.name || '',
      image: it.image || '',
      qty: Number.isFinite(it.qty) ? it.qty : (Number.isFinite(it.quantity) ? it.quantity : 1),
      unitPrice: Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : (Number.isFinite(it.price) ? Number(it.price) : 0),
      linePrice: Number.isFinite(it.linePrice) ? Number(it.linePrice) : (Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : (Number.isFinite(it.price) ? Number(it.price) : 0)),
      assigned: Array.isArray(it.assigned) ? it.assigned : (typeof it.assigned === 'string' && it.assigned.length ? it.assigned.split(';').map(s => s.trim()).filter(Boolean) : []),
      splitCount: (it.splitCount && it.splitCount > 0) ? it.splitCount : 1
    }))
      .filter(i => i.name && Number(i.linePrice) > 0);

    renderItems();
    setStatus(`Scraped ${items.length} items`);
  } catch (err) {
    console.error('Scrape error', err);
    setStatus('Scrape failed — check console for details');
  }
});

// Render items table in popup
function renderItems() {
  const participants = participantsInput.value.split(',').map(s => s.trim()).filter(Boolean);

  items = items.map(it => ({
    ...it,
    assigned: (Array.isArray(it.assigned) && it.assigned.length) ? it.assigned : (participants.length ? [participants[0]] : []),
    splitCount: (it.splitCount && it.splitCount > 0) ? it.splitCount : 1
  }));

  itemsContainer.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left">Item</th>
          <th style="width:50px">Qty</th>
          <th style="width:70px;text-align:right">Unit</th>
          <th style="width:80px;text-align:right">Total</th>
          <th style="text-align:left">Assign</th>
          <th style="width:70px">Split #</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
          <tr>
            <td style="vertical-align:middle;">
              ${it.image ? `<img src="${escapeHtml(it.image)}" width="40" height="40" style="object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle">` : ''}
              <span>${escapeHtml(it.name)}</span>
            </td>
            <td style="text-align:center">${it.qty}</td>
            <td style="text-align:right;padding-right:8px">$${(it.unitPrice || 0).toFixed(2)}</td>
            <td style="text-align:right;padding-right:8px">$${(it.linePrice || it.unitPrice || 0).toFixed(2)}</td>
            <td>
              <input data-idx="${idx}" class="assignees" placeholder="e.g. Alice,Bob" value="${(it.assigned || []).join(',')}" style="width:170px"/>
            </td>
            <td style="text-align:center">
              <input type="number" min="1" value="${it.splitCount || 1}" data-idx="${idx}" class="splitCount" style="width:60px"/>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;

  // Wire up inputs
  Array.from(document.querySelectorAll('.assignees')).forEach(el => {
    el.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      if (!Number.isFinite(idx) || !items[idx]) return;
      items[idx].assigned = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      const _splitCount = items[idx].assigned.length;
      items[idx].splitCount = Math.max(1, _splitCount);
    });
  });
  // Array.from(document.querySelectorAll('.splitCount')).forEach(el => {
  //   el.addEventListener('change', e => {
  //     const idx = +e.target.dataset.idx;
  //     if (!Number.isFinite(idx) || !items[idx]) return;
  //   });
  // });
}

// Simple HTML-escape
function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Build export rows matching your sheet layout:
// Header: ['Item','Price','Count', ...participants]
// Rows: [name, totalPrice, qty, amtForP1, amtForP2, ...]
// Final totals row: ['total', totalPrice, '', totalPerP1, totalPerP2,...]
function buildExportRows(titleRow = null) {

  // capture a stack trace and timestamp at function entry
  const entryStack = (new Error('buildExportRows stack')).stack;
  const entryTs = new Date().toISOString();

  const participants = participantsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  const header = ['Item', 'Price', 'Count', ...participants];

  const rows = [];
  if (titleRow) {
    // allow a title row spanning many cols (useful to show date or label)
    const titlePadding = new Array(3 + participants.length).fill('');
    rows.push([titleRow, ...titlePadding.slice(1)]); // put title in first column
  }
  rows.push(header);

  let totalPrice = 0;
  const perPersonTotals = participants.map(() => 0);

  // snapshot of items for debug
  const itemsSnapshot = items.map(it => ({
    name: it.name,
    qty: it.qty,
    unitPrice: it.unitPrice,
    linePrice: it.linePrice,
    assigned: Array.isArray(it.assigned) ? [...it.assigned] : (typeof it.assigned === 'string' ? it.assigned.split(',').map(s=>s.trim()).filter(Boolean) : []),
    splitCount: it.splitCount
  }));

  for (const it of items) {
    const name = it.name || '';
    const qty = Number.isFinite(it.qty) ? it.qty : 1;
    const total = Number.isFinite(it.linePrice) && it.linePrice > 0 ? it.linePrice : Number(it.unitPrice || 0);
    totalPrice += total;

    const assigned = (Array.isArray(it.assigned) && it.assigned.length) ? it.assigned : participants.slice(); // everyone if none assigned
    // Determine split count: if user provided splitCount use it, else use assigned.length
    const splitCount = (it.splitCount && it.splitCount > 0) ? it.splitCount : (assigned.length || 1);
    const share = Number(total) / (splitCount || 1);

    // Build per-person amounts in the order of participants array
    const personAmounts = participants.map((p, idx) => {
      const isAssigned = assigned.includes(p);
      const amt = isAssigned ? share : 0;
      perPersonTotals[idx] += amt;
      return amt;
    });

    // Row: Item, Price (total), Count, amounts...
    const row = [name, total.toFixed(2), qty, ...personAmounts.map(a => a.toFixed(2))];
    rows.push(row);
  }

  // Totals row
  const totalsRow = ['total', totalPrice.toFixed(2), '', ...perPersonTotals.map(a => a.toFixed(2))];
  rows.push(totalsRow);

  // Build debug object and stash it globally for inspection by other code (e.g. the sender)
  const debug = {
    timestamp: entryTs,
    entryStack,
    itemsCount: items.length,
    itemsSnapshot,
    participants,
    header,
    totalRows: rows.length,
    totalPrice: Number(totalPrice.toFixed(2)),
    perPersonTotals,
  };

  // expose for later use (inspected/attached by export function)
  try {
    window.__LAST_EXPORT_DEBUG = debug;
  } catch (e) {
    // ignore (e.g. CSP or environments where window not available)
    if (DEBUG) console.warn('Could not set window.__LAST_EXPORT_DEBUG', e);
  }

  if (DEBUG) {
    console.groupCollapsed('buildExportRows debug');
    console.log('buildExportRows debug object:', debug);
    console.table(rows.slice(0, 10)); // small preview of the first 10 rows
    console.log('Total rows:', rows.length);
    console.groupEnd();
  }

  return rows;
}

// CSV export (matching sheet format)
exportCsvBtn.addEventListener('click', () => {
  const rows = buildExportRows();
  const csvStr = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvStr], { type: 'text/csv' });
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

// Sheets export: send the 2D values to your Apps Script
exportSheetsBtn.addEventListener('click', async () => {

  if (items.length === 0) {
    setStatus('No items to export');
    return;
  }

  // Ensure we call buildExportRows so it populates window.__LAST_EXPORT_DEBUG
  const rows = buildExportRows(null); // header + rows + totals

  setStatus('Sending to Sheets...');

  try {
    // Compose basic payload
    const payload = {
      values: rows,
      meta: {
        date: new Date().toISOString().slice(0, 10),
        store: (typeof CONFIG !== 'undefined' && CONFIG.STORE && CONFIG.STORE_NAME) ? CONFIG.STORE_NAME : "Sam's Club"
      }
    };

    // Add debug info (stolen from buildExportRows) and add a send-time stack
    const sendStack = (new Error('exportSheets send stack')).stack;
    const sendTs = new Date().toISOString();
    const lastBuildDebug = (typeof window !== 'undefined' && window.__LAST_EXPORT_DEBUG) ? window.__LAST_EXPORT_DEBUG : null;

    payload.meta.debug = {
      sendTimestamp: sendTs,
      sendStack,
      buildExportRowsDebug: lastBuildDebug,
      itemsCount: items.length,
      // include a compact items snapshot to help debugging size/shape
      itemsSnapshotSmall: items.slice(0, 20).map(it => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        linePrice: it.linePrice,
        assigned: it.assigned,
        splitCount: it.splitCount
      })),
      rowsCount: rows.length
    };

    if (DEBUG) {
      // Print payload in an easy-to-scan way
      console.groupCollapsed('%cExport -> Apps Script payload (DEBUG)', 'color: white; background: #444; padding: 2px 6px; border-radius: 3px;');
      console.log('payload.meta:', payload.meta);
      console.log('values (first 12 rows):', payload.values.slice(0, 12));
      if (payload.values.length > 12) console.log(`...and ${payload.values.length - 12} more rows`);
      console.log('full payload object:', payload);
      console.trace('Export triggered from here');
      console.groupEnd();
    }
    console.log('About to fetch:', CONFIG.APPS_SCRIPT_URL);
    // Send to Apps Script
    // NOTE: you currently use mode: "no-cors" in popup.js; if you keep it,
    // the response will be opaque and you cannot read response.json().
    // Keep the same behavior here.
    let response;
    if (NO_CORS == true) {
      console.log('Fetching with NO_CORS:');
      response = await fetch((typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) ? CONFIG.APPS_SCRIPT_URL : APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload),
        redirect: "manual"
      });
    }
    else {
      console.log('Fetching with CORS:');
      response = await fetch((typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) ? CONFIG.APPS_SCRIPT_URL : APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }
    }
    // If you later remove no-cors and enable CORS on the Apps Script side:
    const text = await response.text();
    console.log('Apps Script raw response:', text);

    setStatus('Sent — check your Google Sheet!');
  } catch (err) {
    console.error('Sheets error', err);
    setStatus('Sheets export failed');

    if (DEBUG) {
      console.groupCollapsed('exportSheets error debug');
      console.error(err);
      try { console.log('window.__LAST_EXPORT_DEBUG', window.__LAST_EXPORT_DEBUG); } catch (e) {}
      console.groupEnd();
    }
  }
});

// On load: try to load saved participants automatically
(async function init() {
  const saved = await loadParticipants();
  if (saved) participantsInput.value = saved;
})();
