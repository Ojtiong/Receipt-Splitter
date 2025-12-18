// Handles OAuth + appending to Google Sheets
// Accepts messages:
//  - { action: 'appendValues', values: [ [col1, col2, ...], ... ] }  => appends directly
//  - { action: 'appendToSheet', rows: [...] }  => legacy object handler (kept for compatibility)

chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if (msg.action === 'appendValues') {
    const values = msg.values || [];
    appendValuesToSheet(values)
      .then(() => sendResp({ ok: true }))
      .catch(err => {
        console.error('appendValuesToSheet error:', err);
        sendResp({ ok: false, error: err.message || String(err) });
      });
    return true; // async response
  }

  if (msg.action === 'appendToSheet') {
    const payload = msg.rows || msg.items || [];
    appendObjectsToSheet(payload)
      .then(() => sendResp({ ok: true }))
      .catch(err => {
        console.error('appendObjectsToSheet error:', err);
        sendResp({ ok: false, error: err.message || String(err) });
      });
    return true;
  }
});

// Acquire OAuth token
function getAuthTokenInteractive() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(token);
    });
  });
}

// Append array-of-arrays to sheet
async function appendValuesToSheet(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('No values to append');
  }

  const token = await getAuthTokenInteractive();

  // Configure your spreadsheet ID & range here:
  const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // <-- REPLACE WITH YOUR SPREADSHEET ID
  const range = 'Sheet1!A:Z';

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

// Legacy: append objects (convert to values)
async function appendObjectsToSheet(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Payload must be an array');
  }

  // Convert items/rows objects to row arrays.
  // We'll produce columns: Timestamp, Name, Qty, UnitPrice, LinePrice, Assigned, SplitCount, PerPerson
  const values = payload.map(it => {
    const name = it.name || '';
    const qty = Number.isFinite(it.qty) ? it.qty : (Number.isFinite(it.quantity) ? it.quantity : 1);
    const unitPrice = (Number.isFinite(it.unitPrice) ? Number(it.unitPrice) : (Number.isFinite(it.price) ? Number(it.price) : 0));
    const linePrice = (Number.isFinite(it.linePrice) ? Number(it.linePrice) : unitPrice);
    const splitCount = (Number.isFinite(it.splitCount) ? it.splitCount : 1);
    const perPerson = (Number.isFinite(it.perPerson) ? Number(it.perPerson) : (linePrice / (splitCount || 1)));
    const assigned = (typeof it.assigned === 'string') ? it.assigned : (Array.isArray(it.assigned) ? it.assigned.join(';') : (it.assigned || ''));

    return [
      new Date().toLocaleString(),
      name,
      qty,
      unitPrice.toFixed(2),
      linePrice.toFixed(2),
      assigned,
      splitCount,
      perPerson.toFixed(2)
    ];
  });

  // Reuse appendValuesToSheet
  return appendValuesToSheet(values);
}
