/**
 * Loot Council Dashboard — Item Icon Lookup Script
 *
 * Takes a Wowhead item ID and returns the item's icon filename.
 * Used to populate itemIcons for items not already in gear-item-ids.json.
 *
 * Request:  ?itemId=28802
 * Response: { "icon": "inv_jewelry_ring_38" }
 *
 * Deploy as:
 *   Execute as: Me
 *   Who has access: Anyone
 */

function doGet(e) {
  const itemId = e.parameter.itemId;

  if (!itemId) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Missing itemId parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // Wowhead's tooltip API returns item metadata including the icon name
    const url = 'https://www.wowhead.com/tbc/tooltip/item/' + itemId;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Wowhead fetch failed', status: response.getResponseCode() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(response.getContentText());

    // Wowhead tooltip API returns { icon: "spell_name_here", ... }
    const icon = data.icon ? data.icon.toLowerCase() : null;

    if (!icon) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'No icon found for item', itemId: itemId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ icon: icon, itemId: parseInt(itemId) }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
