/**
 * Loot Council Dashboard — Main Apps Script Proxy
 *
 * Handles three responsibilities:
 *   1. Fetching CLA Google Sheets as CSV (?sheetId=...&gid=...)
 *   2. WarcraftLogs OAuth token exchange (?action=wclAuth&payload=...)
 *   3. WarcraftLogs GraphQL queries (?action=wclQuery&q=...&token=...)
 *   4. Wowhead item ID lookup (?action=itemLookup&name=...)
 *
 * Deploy as:
 *   Execute as: Me
 *   Who has access: Anyone
 */

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  try {

    // ── 1. WCL OAuth Token Exchange ──────────────────────────────
    // Dashboard sends PKCE token exchange params as base64 JSON payload
    if (action === 'wclAuth') {
      const payload = JSON.parse(atob(params.payload));

      const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/oauth/token', {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          grant_type:    payload.grant_type,
          client_id:     payload.client_id,
          redirect_uri:  payload.redirect_uri,
          code:          payload.code,
          code_verifier: payload.code_verifier,
        },
        muteHttpExceptions: true,
      });

      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── 2. WCL GraphQL Query ─────────────────────────────────────
    // Query is base64-encoded to handle special characters safely
    if (action === 'wclQuery') {
      const query = decodeURIComponent(escape(atob(params.q)));
      const token = params.token;

      const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        payload: JSON.stringify({ query }),
        muteHttpExceptions: true,
      });

      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── 3. Wowhead Item ID Lookup ─────────────────────────────────
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

      // Extract first item result from Wowhead XML
      const idMatch   = xml.match(/<id>(\d+)<\/id>/);
      const nameMatch = xml.match(/<name><!\[CDATA\[([^\]]+)\]\]><\/name>/);
      const slotMatch = xml.match(/<slot>(\d+)<\/slot>/);

      if (!idMatch) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Item not found', query: name }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Map Wowhead slot numbers to slot names
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

    // ── 4. Google Sheet CSV Fetch ─────────────────────────────────
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
