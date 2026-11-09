/**
 * تقرير المخازن العامة 2026 - الدقهلية للدواجن
 * Apps Script: يقرأ شيتات المخازن ويرجّع JSON منضّف للتطبيق.
 *
 * الاستخدام:
 *  1) افتح ملف Google Sheet بتاع المخازن > Extensions > Apps Script > الصق الكود ده.
 *     (لو السكربت مش مربوط بالملف حط SPREADSHEET_ID تحت)
 *  2) Deploy > New deployment > Web app
 *       Execute as: Me   |   Who has access: Anyone
 *  3) انسخ رابط الـ Web app وحطه في ملف .env  (VITE_APPS_SCRIPT_URL)
 *
 * الأعمدة بالحروف (fixed letter-based indexing) حسب ترتيب الشيتات الحالي.
 * لو غيّرت ترتيب الأعمدة عدّل الحروف في COLS بس.
 */

const DATA_SCHEMA_VERSION = 1;
const SPREADSHEET_ID = ''; // اتركه فاضي لو السكربت مربوط بالملف نفسه
const YEAR = 2026;

const COLS = {
  iss: { sheet: 'الصرف', header: 4,
    date: 'C', permit: 'D', item: 'F', store: 'I', dept: 'J', status: 'Q', recv: 'N', shift: 'T' },
  add: { sheet: 'الاضافة', header: 4,
    date: 'D', order: 'F', item: 'H', store: 'K', party: 'L', supplier: 'O', buyer: 'R' },
  pr: { sheet: 'طلب الشراء', header: 6,
    date: 'C', no: 'D', dept: 'E', type: 'F', item: 'J', qtyOrd: 'M', qtyIn: 'N', exec: 'T' },
  bal: { sheet: 'الشاشة الرئيسية', header: 3,
    item: 'H', unit: 'I', bal: 'R', store: 'T', group: 'W', move: 'Y', status: 'AA', min: 'AB', reorder: 'AC' },
  oth: { ret: ['المرتجع', 4, 'G'], sa: ['التسوية بالاضافة', 4, 'F'], sd: ['التسوية بالخصم', 4, 'F'], tr: ['التحويلات', 4, 'F'] },
};

const OK_STORES = ['الادوات والمهمات', 'قطع الغيار', 'المطبوعات', 'الوقود والزيوت', 'المطهرات', 'الاصول الثابتة', 'اصول ثابتة'];
const STORE_FIX = { 'اصول ثابتة': 'الاصول الثابتة' };
const DEPT_FIX = { 'it': 'تكنولوجيا المعلومات', 'الميكانيكا': 'ادارة الصيانة' };

/* ---------- web app ---------- */
function doGet() {
  try {
    const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const ctx = { lo: new Date(YEAR, 0, 1), hi: new Date(), tz: tz };
    const iss = readIssues_(ss, ctx), add = readAdditions_(ss, ctx), pr = readPurchase_(ss, ctx), bal = readBalances_(ss);
    const oth = {};
    Object.keys(COLS.oth).forEach(function (k) { oth[k] = countRows_(ss, COLS.oth[k]); });
    let asof = YEAR + '-01-01';
    iss.forEach(function (r) { if (r[0] > asof) asof = r[0]; });
    return json_({ version: DATA_SCHEMA_VERSION, generatedAt: new Date().toISOString(), asof: asof, iss: iss, add: add, pr: pr, bal: bal, oth: oth });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- helpers ---------- */
function idx_(letter) { // 'A'->0, 'AA'->26
  let n = 0;
  for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
  return n - 1;
}
function clean_(v) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function num_(v) { const x = parseFloat(v); return isNaN(x) ? null : x; }

function parseDate_(v, ctx) {
  let d = null;
  if (v instanceof Date) d = new Date(v.getTime());
  else if (typeof v === 'number' && v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 864e5));
  else if (typeof v === 'string') {
    const s = v.trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{3,4})$/);
    if (m) d = new Date(+m[3] < 1000 ? YEAR : +m[3], +m[2] - 1, +m[1]);
    else { m = s.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})/); if (m) d = new Date(+m[1], +m[2] - 1, +m[3]); }
  }
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (y < 1000 || y === 202 || y === 206 || y === 226) d.setFullYear(YEAR); // أخطاء كتابة السنة
  if (d < ctx.lo || d > ctx.hi) return null;
  return Utilities.formatDate(d, ctx.tz, 'yyyy-MM-dd');
}

function rows_(ss, name, header) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('الشيت مش موجود: ' + name);
  const last = sh.getLastRow();
  if (last <= header) return [];
  return sh.getRange(header + 1, 1, last - header, sh.getLastColumn()).getValues();
}
function getter_(cfg) { // يرجّع دالة g(row,'key') تقرأ بالحرف
  const ix = {};
  Object.keys(cfg).forEach(function (k) { if (k !== 'sheet' && k !== 'header') ix[k] = idx_(cfg[k]); });
  return function (r, k) { return r[ix[k]]; };
}

/* ---------- readers ---------- */
function readIssues_(ss, ctx) {
  const c = COLS.iss, g = getter_(c), out = [];
  rows_(ss, c.sheet, c.header).forEach(function (r) {
    const d = parseDate_(g(r, 'date'), ctx), item = clean_(g(r, 'item')), s = clean_(g(r, 'store'));
    if (!d || !item || OK_STORES.indexOf(s) < 0) return;
    const dep = clean_(g(r, 'dept'));
    out.push([d, clean_(g(r, 'permit')), item, STORE_FIX[s] || s, DEPT_FIX[dep] || dep, clean_(g(r, 'shift')), clean_(g(r, 'status')), clean_(g(r, 'recv'))]);
  });
  return out;
}

function readAdditions_(ss, ctx) {
  const c = COLS.add, g = getter_(c), out = [];
  rows_(ss, c.sheet, c.header).forEach(function (r) {
    const d = parseDate_(g(r, 'date'), ctx), item = clean_(g(r, 'item')), s = clean_(g(r, 'store'));
    if (!d || !item || s === 'من فضلك راجع الكود مرة اخرى') return;
    // عدد أذون الإضافة = عدد أرقام الأوردر المختلفة (زي ما الشيت بيحسبها)
    out.push([d, clean_(g(r, 'order')), item, STORE_FIX[s] || s, clean_(g(r, 'supplier')), clean_(g(r, 'buyer')), clean_(g(r, 'party'))]);
  });
  return out;
}

function readPurchase_(ss, ctx) {
  const c = COLS.pr, g = getter_(c), out = [];
  rows_(ss, c.sheet, c.header).forEach(function (r) {
    const d = parseDate_(g(r, 'date'), ctx);
    if (!d || !clean_(g(r, 'item'))) return;
    const qo = num_(g(r, 'qtyOrd')), qi = num_(g(r, 'qtyIn')) || 0;
    const state = (qo > 0 && qi >= qo) ? 1 : (qi <= 0 ? 0 : 2); // 1 تم الاستلام، 2 جزئي، 0 لم يرد
    out.push([d, clean_(g(r, 'no')), clean_(g(r, 'type')), clean_(g(r, 'dept')), clean_(g(r, 'exec')), state]);
  });
  return out;
}

function readBalances_(ss) {
  const c = COLS.bal, g = getter_(c), out = [];
  rows_(ss, c.sheet, c.header).forEach(function (r) {
    const item = clean_(g(r, 'item')), s = clean_(g(r, 'store'));
    if (!item || s === 'الاعاشة') return;
    out.push([item, s, clean_(g(r, 'group')), clean_(g(r, 'status')), clean_(g(r, 'move')), num_(g(r, 'bal')) || 0, clean_(g(r, 'unit')), num_(g(r, 'min')), num_(g(r, 'reorder'))]);
  });
  return out;
}

function countRows_(ss, spec) {
  const col = idx_(spec[2]);
  return rows_(ss, spec[0], spec[1]).filter(function (r) { return clean_(r[col]) !== ''; }).length;
}

/** للتجربة من محرر السكربت: بيطبع ملخص الأعداد */
function testRun() {
  const out = JSON.parse(doGet().getContent());
  Logger.log(JSON.stringify({ iss: out.iss && out.iss.length, add: out.add && out.add.length, pr: out.pr && out.pr.length, bal: out.bal && out.bal.length, oth: out.oth, asof: out.asof, error: out.error }));
}
