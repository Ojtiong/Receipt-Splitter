chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if(msg.action === 'appendToSheet'){
    appendToGoogleSheet(msg.items).then(() => sendResp({ok:true})).catch(err => {
      console.error(err);
      sendResp({ok:false, error: err.message});
    });
    return true; // async
  }
});

async function appendToGoogleSheet(items) {
  // Use chrome.identity to get an OAuth token
  // NOTE: you must configure OAuth consent and the extension in Google Cloud console for chrome.identity to work properly.
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({interactive: true}, t => {
      if(chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(t);
    });
  });

  const spreadsheetId = 'YOUR_SPREADSHEET_ID';
  const range = 'Sheet1!A:F';
  const values = items.map(it => {
    const per = ((it.price||0) / (it.splitCount||1)).toFixed(2);
    const assigned = (it.assigned || []).join(';');
    return [new Date().toLocaleString(), it.name, it.qty, (it.price||0).toFixed(2), assigned, per];
  });

  const body = { values };
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if(!resp.ok) {
    const text = await resp.text();
    throw new Error('Sheets API error: ' + text);
  }
  return resp.json();
}
