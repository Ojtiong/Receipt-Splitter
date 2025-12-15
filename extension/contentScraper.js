(() => {
  // Try a few candidate selectors for items
  const selectors = [
    '.order-item', '.cart-item', '.receipt-item', '.sc-cart-item', '.cartRow' // add as needed
  ];

  let rows = [];
  for(const sel of selectors){
    const found = Array.from(document.querySelectorAll(sel));
    if(found.length) { rows = found; break; }
  }
  if(!rows.length) {
    // fallback: try table rows
    rows = Array.from(document.querySelectorAll('tr')).filter(tr => tr.innerText.trim().length > 10).slice(0, 50);
  }

  const items = rows.map(row => {
    // These queries are heuristics — inspect the Sam's Club page and adjust
    const name = row.querySelector('.item-name, .product-name, .sc-product-title, .description, .name, h3')?.innerText?.trim()
               || row.querySelector('td:first-child')?.innerText?.trim()
               || row.innerText.split('\\n')[0]?.trim() || '';

    const qtyText = row.querySelector('.item-qty, .quantity, .qty')?.innerText || row.querySelector('.quantityInput')?.value || '1';
    const qtyNum = parseFloat(String(qtyText).replace(/[^\d.]/g,'')) || 1;

    const priceText = row.querySelector('.item-price, .price, .total-price, .sc-product-price')?.innerText
                   || row.querySelector('td:last-child')?.innerText || '';
    const price = parseFloat(String(priceText).replace(/[^\d.]/g,'')) || 0;

    return { name, qty: qtyNum, price };
  }).filter(it => it.name);

  // return result of executeScript
  items;
})();
