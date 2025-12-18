// contentScraper.js (Final Working Version)

(() => {
  function num(str) {
    if (!str) return 0;
    const cleaned = str.replace(/[^\d.\-]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  // Select the item tiles (your existing selector)
  const tiles = Array.from(document.querySelectorAll('div[data-testid="itemtile-stack"]'));

  const items = tiles.map(tile => {
    // Defensive: get plain text of the whole tile for quick checks (lowercase)
    const tileText = (tile.innerText || "").toLowerCase();

    // Skip entire tile if it clearly shows "canceled"
    if (tileText.includes("canceled")) return null;

    const name = tile.querySelector('[data-testid="productName"] span')
      ?.textContent.trim() || "";

    const image = tile.querySelector('[data-testid="productTileImage"]')
      ?.getAttribute("src") || "";

    const unitPriceText =
      tile.querySelector('[data-testid="productDescription"] .lh-title')
        ?.textContent.trim() || "";

    const unitPrice = num(unitPriceText);

    const linePriceText =
      tile.querySelector('[data-testid="line-price"]')
        ?.textContent.trim() || unitPriceText;

    const linePrice = num(linePriceText);

    const qtyText =
      tile.querySelector('.bill-item-quantity')
        ?.textContent.trim() || "1";

    let qty = 1;
    const match = qtyText.match(/(\d+)/);
    if (match) qty = parseInt(match[1], 10);

    return {
      name,
      image,
      qty,
      unitPrice,
      linePrice
    };
  })
  // Remove nulls caused by skipped tiles and remove items with no name or zero linePrice
  .filter(it => it && it.name && Number(it.linePrice) > 0);

  return items;
})();