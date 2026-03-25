/**
 * Loot Council Dashboard — Shared Apps Script Proxy
 *
 * Handles two responsibilities:
 *   1. Fetching CLA Google Sheets as CSV (?sheetId=...&gid=...)
 *   2. Wowhead item ID lookup (?action=itemLookup&name=...)
 *
 * This script is safe to share across guilds — it is stateless,
 * involves no credentials, and has low per-guild quota usage.
 *
 * WarcraftLogs OAuth and GraphQL are handled by a separate
 * wcl-proxy.gs script that each guild deploys themselves.
 *
 * Deploy as:
 *   Execute as: Me
 *   Who has access: Anyone
 */

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  try {

    // ── 1. Wowhead Item ID Lookup ─────────────────────────────────
    // Searches Wowhead's XML API for an item by name, returns { id, slot }
    if (action === 'itemLookup') {
      const name = params.name;
      if (!name) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Missing name parameter' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const url = 'https://www.wowhead.com/tbc/search?q=' +
        encodeURIComponent(name) + '&xml';

      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const xml = response.getContentText();

      const idMatch   = xml.match(/<id>(\d+)<\/id>/);
      const nameMatch = xml.match(/<n><!\[CDATA\[([^\]]+)\]\]><\/name>/);
      const slotMatch = xml.match(/<slot>(\d+)<\/slot>/);

      if (!idMatch) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Item not found', query: name }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const SLOT_MAP = {
        1: 'Head', 2: 'Neck', 3: 'Shoulder', 5: 'Chest',
        6: 'Waist', 7: 'Legs', 8: 'Feet', 9: 'Wrist',
        10: 'Hands', 11: 'Finger', 13: 'Trinket', 14: 'Back',
        15: 'Main Hand', 16: 'Off Hand', 17: 'Ranged',
        18: 'Bag', 22: 'Chest', 23: 'Main Hand',
      };

      const slotNum = slotMatch ? parseInt(slotMatch[1]) : null;
      const slot = slotNum ? (SLOT_MAP[slotNum] || String(slotNum)) : null;

      return ContentService
        .createTextOutput(JSON.stringify({
          id:   parseInt(idMatch[1]),
          name: nameMatch ? nameMatch[1] : name,
          slot: slot,
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── 2. Google Sheet CSV Fetch ─────────────────────────────────
    // Fetches a specific tab of a Google Sheet as CSV by sheetId + gid
    if (params.sheetId && params.gid) {
      const sheetId = params.sheetId;
      const gid     = params.gid;

      const url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
        '/export?format=csv&id=' + sheetId + '&gid=' + gid;

      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

      if (response.getResponseCode() !== 200) {
        return ContentService
          .createTextOutput('ERROR: Sheet fetch failed — ' + response.getResponseCode() +
            '. Make sure the sheet is set to "Anyone with the link can view".')
          .setMimeType(ContentService.MimeType.TEXT);
      }

      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // ── Unknown request ───────────────────────────────────────────
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unknown action or missing parameters' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
