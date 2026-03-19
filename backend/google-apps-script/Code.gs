/*
  Google Apps Script backend for admin.html
  Deploy as: Web app
  - Execute as: Me
  - Who has access: Anyone

  Set Script Properties:
  - ADMIN_PIN = <your pin>
  - SHEET_ID = <google sheet id>
  - SHEET_NAME = events
  - DRIVE_ROOT_FOLDER_ID = <drive folder id for posters>
*/

// One-time bootstrap values provided for initial setup.
// Run setupScriptPropertiesOnce() from Apps Script editor once, then deploy web app.
var DEFAULT_SETUP = {
  SHEET_ID: "1_bF5DizUSOMc3NBhiL3o5ZHHacogra0fnLiLCNg0AhM",
  SHEET_NAME: "events",
  DRIVE_ROOT_FOLDER_ID: "1t30TMvENtZTo7catXk8FqyhCB3lRUsLF",
  ADMIN_PIN: "1234"
};

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || "{}");
    var action = String(payload.action || "");
    var pin = String(payload.pin || "");
    var oldPin = String(payload.oldPin || "");
    var newPin = String(payload.newPin || "");
    var eventObj = payload.event || {};
    var posterObj = payload.poster || {};

    var props = PropertiesService.getScriptProperties();
    var adminPin = String(props.getProperty("ADMIN_PIN") || "");

    if (action === "pinStatus") {
      return jsonOut({ ok: true, pinConfigured: !!adminPin }, 200);
    }
    if (action === "verifyPin") {
      if (!adminPin) return jsonOut({ ok: false, error: "PIN not set" }, 400);
      if (pin !== adminPin) return jsonOut({ ok: false, error: "Invalid PIN" }, 401);
      return jsonOut({ ok: true, pinConfigured: true }, 200);
    }
    if (action === "changePin") {
      if (!isValidPin(newPin)) {
        return jsonOut({ ok: false, error: "New PIN must be at least 4 digits." }, 400);
      }

      if (adminPin) {
        if (oldPin !== adminPin) return jsonOut({ ok: false, error: "Current PIN is incorrect." }, 401);
      }

      props.setProperty("ADMIN_PIN", newPin);
      return jsonOut({ ok: true, pinConfigured: true }, 200);
    }

    if (!adminPin) {
      return jsonOut({ ok: false, error: "PIN is not set. Set PIN first." }, 401);
    }
    if (pin !== adminPin) {
      return jsonOut({ ok: false, error: "Invalid PIN" }, 401);
    }

    var sheetId = props.getProperty("SHEET_ID");
    var sheetName = props.getProperty("SHEET_NAME") || "events";
    var rootFolderId = props.getProperty("DRIVE_ROOT_FOLDER_ID");
    if (!sheetId || !rootFolderId) {
      return jsonOut({ ok: false, error: "Missing script properties" }, 500);
    }

    var slug = String(eventObj.slug || "").trim();
    if (!slug) return jsonOut({ ok: false, error: "Missing slug" }, 400);

    var existing = findEventRowBySlug(sheetId, sheetName, slug);
    var posterFile = savePoster(rootFolderId, slug, posterObj);
    var posterUrl = posterFile ? posterFile.getUrl() : String((existing && existing.posterUrl) || "");

    upsertEventRow(sheetId, sheetName, {
      slug: slug,
      title: String(eventObj.title || ""),
      date: String(eventObj.date || ""),
      time: String(eventObj.time || ""),
      location: String(eventObj.location || ""),
      status: String(eventObj.status || "scheduled"),
      teaser: String(eventObj.teaser || ""),
      homepageMatter: String(eventObj.homepageMatter || ""),
      posterUrl: posterUrl,
      updatedAt: new Date().toISOString()
    });

    return jsonOut({ ok: true, slug: slug, posterUrl: posterUrl }, 200);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) }, 500);
  }
}

function setupScriptPropertiesOnce() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    SHEET_ID: DEFAULT_SETUP.SHEET_ID,
    SHEET_NAME: DEFAULT_SETUP.SHEET_NAME,
    DRIVE_ROOT_FOLDER_ID: DEFAULT_SETUP.DRIVE_ROOT_FOLDER_ID,
    ADMIN_PIN: DEFAULT_SETUP.ADMIN_PIN
  }, true);

  return {
    ok: true,
    message: "Script properties saved. Now deploy/redeploy web app and use the /exec URL."
  };
}

function doGet(e) {
  var mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode : "feed";
  if (mode === "health") return jsonOut({ ok: true, status: "healthy" }, 200);
  return jsonOut({ ok: true, events: readEvents() }, 200);
}

function savePoster(rootFolderId, slug, posterObj) {
  if (!posterObj || !posterObj.data) return null;
  var root = DriveApp.getFolderById(rootFolderId);
  var eventFolder = getOrCreateChild(root, slug);

  var bytes = Utilities.base64Decode(String(posterObj.data));
  var mime = String(posterObj.mime || "application/octet-stream");
  var originalName = String(posterObj.name || "poster.bin");
  var ext = originalName.indexOf(".") >= 0 ? originalName.substring(originalName.lastIndexOf(".")) : "";
  var filename = "poster" + ext.toLowerCase();
  var blob = Utilities.newBlob(bytes, mime, filename);

  // Remove previous poster versions with same name for clean replacement
  var old = eventFolder.getFilesByName(filename);
  while (old.hasNext()) old.next().setTrashed(true);

  return eventFolder.createFile(blob);
}

function upsertEventRow(sheetId, sheetName, rowObj) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var headers = ["slug", "title", "date", "time", "location", "status", "teaser", "homepageMatter", "posterUrl", "updatedAt"];
  if (sh.getLastRow() === 0) sh.appendRow(headers);

  var data = sh.getDataRange().getValues();
  var slugCol = 1; // A
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][slugCol - 1]) === rowObj.slug) {
      foundRow = i + 1;
      break;
    }
  }

  var values = headers.map(function (h) { return rowObj[h] || ""; });
  if (foundRow > 0) {
    sh.getRange(foundRow, 1, 1, headers.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
}

function findEventRowBySlug(sheetId, sheetName, slug) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return null;

  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var slugIndex = headers.indexOf("slug");
  if (slugIndex < 0) return null;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][slugIndex]) !== slug) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[r][c];
    return obj;
  }

  return null;
}

function readEvents() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("SHEET_ID");
  var sheetName = props.getProperty("SHEET_NAME") || "events";
  if (!sheetId) return [];

  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[r][c];
    out.push(obj);
  }
  return out;
}

function getOrCreateChild(parentFolder, childName) {
  var it = parentFolder.getFoldersByName(childName);
  return it.hasNext() ? it.next() : parentFolder.createFolder(childName);
}

function jsonOut(obj, statusCode) {
  // Apps Script ContentService does not support custom status codes directly.
  // statusCode is included in payload.
  obj.statusCode = statusCode;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isValidPin(value) {
  return /^[0-9]{4,}$/.test(String(value || ""));
}
