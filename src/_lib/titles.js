// Title matching helpers, shared with the TJ-Plugins SkyStream All-in-one (tools/aio/core.js).
var ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' };
function decode(s) {
    return String(s || '').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
        .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
        .replace(/&([a-z]+);/gi, function (m, n) { return ENT[n.toLowerCase()] || m; });
}
var TAG_RE = /\b(hindi|english|tamil|telugu|malayalam|kannada|bengali|punjabi|urdu|korean|japanese|chinese|dubbed|dub|dual[\s-]*audio|multi[\s-]*audio|org|hq|hd|full\s+movie|web[\s-]*dl|web[\s-]*rip|hdrip|hdtc|hdts|bluray|brrip|dvdrip|camrip|pre[\s-]*dvd|x264|x265|hevc|10bit|esubs?|msubs?|subbed|uncensored|amzn|nf|dsnp|hmax|atvp|jhs|zee5|480p|720p|1080p|2160p|4k|uhd|complete|all\s+episodes?|web\s+series|tv\s+series|series|turkish\s+movie|korean\s+movie)\b/gi;
var ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };

// → { clean: display title, norm: matching key, year, sh: season number in the title or null }
function parseTitle(raw) {
    var t = decode(raw).replace(/[\u200b-\u200f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    var year = null, sh = null, m;
    t = t.replace(/^\s*\[\s*18\+\s*\]\s*/, '').replace(/^\s*\(\s*18\+\s*\)\s*/, '').replace(/^(download|watch)\s+/i, '');
    // season: "Season 2", "(Season 1-4)", "S02", "2nd Season", "Second Season"
    var multi = /\bS\d{1,2}\s*[-–]\s*S?\d{1,2}\b|\bseasons?\s*\d{1,2}\s*[-–&,]\s*\d/i.test(t);   // packs: no single season
    if (multi) sh = null;
    else if ((m = t.match(/\bseasons?\s*0*(\d{1,2})(?!\s*[-–&,]\s*\d)/i))) sh = +m[1];
    else if ((m = t.match(/\bS0*(\d{1,2})(?:\s*E\d+)?\b(?!\s*[-–]\s*S?\d)/))) sh = +m[1];
    else if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i))) sh = +m[1];
    else if ((m = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i))) sh = ORD[m[1].toLowerCase()];
    if ((m = t.match(/[(\[]\s*((?:19|20)\d{2})\s*[)\]]/))) year = +m[1];
    else if ((m = t.match(/\s((?:19|20)\d{2})\b(?!\s*[-–:])/)) && m.index > 2) year = +m[1];
    var c = t;
    c = c.split(/\s[|•]\s|\s–\s(?=(?:episode|anime|korean|chinese|turkish|japanese|all\s|complete|movie|season)\b)/i)[0];
    c = c.replace(/\s+aka\s+.*$/i, '');
    var yp = c.search(/[(\[]\s*(19|20)\d{2}\s*[)\]]/);
    if (yp > 2) c = c.slice(0, yp);                      // "Name (2024) Season 2 Hindi ..." -> "Name"
    c = c.replace(/[(\[{][^)\]}]*[)\]}]/g, function (x) { return /\d|season|dub|audio|hindi|english|sub|hd|added|complete|org|movie|series|\bep/i.test(x) ? ' ' : x; });
    c = c.replace(/\b(seasons?\s*\d{1,2}(\s*[-–&,]\s*\d{1,2})*|S\d{1,2}(\s*[-–]\s*S?\d{1,2})*|\d{1,2}(st|nd|rd|th)\s+season|(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season)\b.*$/i, ' ');
    if (year) c = c.replace(new RegExp('\\s' + year + '\\b.*$'), ' ');
    c = c.replace(/\s+\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b.*$/i, ' ');
    c = c.replace(/(^|[^e]\s)movie\s*$/i, '$1');           // "Maa Tujhhe Salaam Movie", but keep "... The Movie"
    var clean = c.replace(TAG_RE, function (x, w, off) { return off > 0 ? ' ' : x; })
        .replace(/[(\[{]\s*[)\]}]/g, ' ').replace(/[(\[{][^)\]}]*$/, ' ').replace(/[\s:–—,-]+$/, '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2) clean = decode(raw).trim();
    var norm = clean.normalize ? clean.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : clean;
    norm = norm.toLowerCase().replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9\u0900-\u097f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/g, ' ').trim();
    norm = norm.replace(/^the\s+/, '').replace(/\s+the\s+movie$/, '');
    return { clean: clean, norm: norm, year: year, sh: sh };
}

// spelling-tolerant key: "Anupamaa" = "Anupama", "Shippuuden" = "Shippuden"
function loose(norm) { return String(norm).replace(/(.)\1+/g, '$1'); }

function isSeries(type) { return /series|tv|anime|drama|show/i.test(String(type || '')); }

export { decode, parseTitle, loose, isSeries };

// "12 May 2026", "12th May, 2026", "May 12 2026", "2026-05-12", "12-05-2026" → "2026-05-12" (or "")
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function ymd(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
export function dateIn(text) {
  var t = String(text || ""), m;
  if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s.,-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,.-]+(\d{4})\b/i))) return ymd(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  if ((m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i))) return ymd(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return ymd(m[1], +m[2], +m[3]);
  if ((m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/))) return ymd(m[3], +m[2], +m[1]);
  return "";
}
