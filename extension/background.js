// background.js (replace your existing file with this)
chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if (msg.action === 'appendToSheet') {
    // msg may contain `rows` (new popup format) or `items` (old format)
    const payload = msg.rows || msg.items || msg.rowsArray || [];
    appendToGoogleSheet(payload).then(() => sendResp({ ok: true })).catch(err => {
      console.error('appendToGoogleSheet error:', err);
      sendResp({ ok: false, error: err.message || String(err) });
    });
    return true; // will respond asynchronously
  }
});

async function appendToGoogleSheet(payload) {
  // payload is expected to be either:
  // 1) an array of objects (new popup): [{name, qty, unitPrice, linePrice, assigned, splitCount, perPerson}, ...]
  // 2) an array of items (old popup): [{name, qty, price, assigned, splitCount}, ...]
  // We convert both into `values` (array of arrays) for the Sheets API.

  // Acquire OAuth token
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, t => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(t);
    });
  });

  if (!Array.isArray(payload)) {
    throw new Error('Payload must be an array of rows/items');
  }

  // Map payload to rows (2D array) for Sheets API
  // We'll include: DateTime, Name, Qty, UnitPrice, LinePrice, Assigned, SplitCount, PerPerson
  const values = payload.map(it => {
    // support both formats:
    // new: it.unitPrice, it.linePrice, it.perPerson
    // old: it.price (unit), calculate per using it.price and it.splitCount
    const name = it.name || '';
    const qty = Number.isFinite(it.qty) ? it.qty : (Number.isFinite(it.quantity) ? it.quantity : 1);
    const unitPrice = (Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : (Number.isFinite(it.price) ? Number(it.price) : 0));
    const linePrice = (Number.isFinite(it.linePrice) ? Number(it.linePrice) : unitPrice);
    const splitCount = (Number.isFinite(it.splitCount) ? it.splitCount : 1);
    const perPerson = (Number.isFinite(it.perPerson) ? Number(it.perPerson) : (linePrice / (splitCount || 1)));

    const assigned = (typeof it.assigned === 'string') ? it.assigned : Array.isArray(it.assigned) ? it.assigned.join(';') : (it.assigned || '');

    // Row order — change as you like (must match the sheet layout)
    return [
      new Date().toLocaleString(), // timestamp
      name,
      qty,
      unitPrice.toFixed(2),
      linePrice.toFixed(2),
      assigned,
      splitCount,
      perPerson.toFixed(2)
    ];
  });

  // --- Configure these for your sheet ---
  const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // <-- REPLACE WITH YOUR SPREADSHEET ID
  const range = 'Sheet1!A:H'; // adjust columns if you change the fields above
  // -------------------------------------

  const body = { values };

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Sheets API error: ' + text);
  }
  return resp.json();
}
