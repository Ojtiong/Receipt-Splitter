# Receipt Splitter — Sam's Club Chrome Extension

Scrapes items from Sam's Club cart/order/receipt pages and helps split bills between friends.
This repository contains a Chrome extension (in `extension/`) and a GitHub Pages site (in `docs/`) with instructions.

**Quick:** load the extension unpacked (Developer mode) from the `extension/` folder, then open a Sam's Club order/cart/receipt page and click the extension icon.

See `docs/index.html` for a user guide and screenshots.

---

## Notes

- The extension uses `chrome.identity` for Google Sheets integration. You must create a Google Cloud OAuth Client ID and replace the placeholder value in `background.js`.
- The DOM selectors in `contentScraper.js` are generic — inspect the Sam's Club page and tweak selectors as needed.
