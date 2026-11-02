// Turns an embedded TJ-Plugins SkyStream plugin into a Nuvio provider:
//   TMDB id → title/year (TMDB) → the site's item (direct TMDB link, or the site's search + strict
//   title matching) → the right episode (load) → links (loadStreams) → Nuvio stream objects.
import { instantiate, dbg, setNetDeadline } from "./host.js";
import { setT, clearT, cancelAll } from "./timers.js";
import { parseTitle, loose, isSeries } from "./titles.js";
import { tmdbInfo } from "./tmdb.js";

var BUDGET_MS = 52000;   // Nuvio stops a provider after 60 s and then shows nothing from it
var TV_NET_MS = 32000;   // NuvioTV: no new requests after this (each one blocks; see host.js)

function now() { return Date.now(); }

// calls a SkyStream function like the app does (callback or returned promise, first answer wins)
export function call(api, fn, args, ms) {
  return new Promise(function (resolve) {
    var done = false;
    function fin(r) {
      if (done) return;
      done = true;
      if (Array.isArray(r)) r = { success: true, data: r };
      if (!r || typeof r !== "object") r = { success: false, message: "empty answer" };
      resolve(r);
    }
    var timer = null;
    var fin0 = fin;
    fin = function (r) { if (timer !== null) { clearT(timer); timer = null; } fin0(r); };
    if (!api || typeof api[fn] !== "function") return fin({ success: false, message: fn + " missing" });
    timer = setT(function () { fin({ success: false, errorCode: "TIMEOUT" }); }, Math.max(1000, ms));
    try {
      var ret = api[fn].apply(null, args.concat([fin]));
      if (ret && typeof ret.then === "function") ret.then(function (v) { if (v !== undefined) fin(v); }, function (e) { fin({ success: false, message: String((e && e.message) || e) }); });
    } catch (e) { fin({ success: false, message: String((e && e.message) || e) }); }
  });
}

// ───── matching a search hit / episode (same rules as the SkyStream All-in-one) ─────
function pickMatches(list, info) {
  var wants = [info.t].concat(info.alts || []).map(function (t) { return loose(parseTitle(t).norm); });
  var out = [];
  (list || []).slice(0, 30).forEach(function (it, pos) {
    if (!it || !it.title || !it.url) return;
    var p = parseTitle(it.title);
    var exactId = info.id && new RegExp("[\"/=:]" + info.id + "(?![0-9])").test(String(it.url)) && /tmdb|"id"/i.test(String(it.url));
    if (!exactId && wants.indexOf(loose(p.norm)) < 0) return;
    var y = it.year ? +String(it.year).slice(0, 4) || p.year : p.year;
    var sh = p.sh || 0;
    if (info.k === "m") {
      if (sh || (isSeries(it.type) && !/anime/i.test(it.type))) return;
      if (info.y && y && Math.abs(info.y - y) > 1) return;
    } else {
      var S = info.S || 1;
      if (sh && sh !== S && !(sh === 1 && S === 1)) return;
      if (!sh && info.y && y && Math.abs(info.y - y) > 1 && S === 1) return;
    }
    var score = (exactId ? 10 : 0) + (sh && sh === (info.S || 0) ? 4 : 0) + (y && info.y && Math.abs(y - info.y) <= 1 ? 2 : 0) + (it.posterUrl ? 1 : 0) - pos * 0.01;
    out.push({ url: it.url, sh: sh, score: score, title: String(it.title) });
  });
  return out.sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
}

function episodeFrom(item, candSh, info) {
  var eps = (item && item.episodes) || [];
  if (!eps.length) return null;
  if (info.k === "m") {
    if (eps.length > 2 || (isSeries(item.type) && eps.length > 1)) return null;
    return eps[0].url;
  }
  var S = info.S || 1, E = info.E;
  if (!E) return null;
  var exact = eps.filter(function (e) { return +e.season === S && +e.episode === E; })[0];
  if (exact) return exact.url;
  var seasons = {};
  eps.forEach(function (e) { seasons[+e.season || 0] = 1; });
  var ss = Object.keys(seasons).map(Number);
  var flat = ss.every(function (x) { return x <= 1; });
  if ((flat && (candSh === S || (!candSh && S === 1))) || (ss.length === 1 && candSh === S)) {
    if (eps.length < 2 && !isSeries(item.type)) return null;
    var byNum = eps.filter(function (e) { return +e.episode === E; })[0];
    return byNum ? byNum.url : null;
  }
  return null;
}

// ───── SkyStream stream → Nuvio stream ─────
var QUALS = [[/2160|\b4k\b|uhd/i, "4K"], [/1440/, "1440p"], [/1080|fhd/i, "1080p"], [/720/, "720p"], [/576/, "576p"], [/480/, "480p"], [/360/, "360p"], [/240/, "240p"]];
function qualityOf(t) {
  var lab = String(t || "").replace(/\b4k[-\s]?(hub|bk)\b/ig, "").replace(/\bmd-4k\b/ig, "");
  for (var i = 0; i < QUALS.length; i++) if (QUALS[i][0].test(lab)) return QUALS[i][1];
  if (/\bcam\b|hdcam|\bts\b|telesync/i.test(lab)) return "CAM";
  return "Auto";
}
var LANGS = [[/hindi|हिंदी|हिन्दी|\bhin\b/i, "Hindi"], [/tamil/i, "Tamil"], [/telugu/i, "Telugu"], [/malayalam/i, "Malayalam"], [/kannada/i, "Kannada"],
  [/bengali|bangla/i, "Bengali"], [/punjabi/i, "Punjabi"], [/urdu/i, "Urdu"], [/english|\beng\b/i, "English"], [/korean/i, "Korean"], [/japanese|\bjpn?\b/i, "Japanese"]];
function languageOf(t) {
  var s = String(t || ""), found = [];
  LANGS.forEach(function (l) { if (l[0].test(s) && found.indexOf(l[1]) < 0) found.push(l[1]); });
  if (/multi[\s-]*audio|\bmulti\b/i.test(s)) return found.length ? found.join(" + ") + " (Multi)" : "Multi Audio";
  if (/dual[\s-]*audio/i.test(s) && found.length < 2) return found.length ? found[0] + " (Dual)" : "Dual Audio";
  return found.join(" + ");
}
function sizeOf(t) { var m = String(t || "").match(/(\d+(?:\.\d+)?)\s*(GB|MB)\b/i); return m ? m[1] + " " + m[2].toUpperCase() : ""; }

function epTag(info) { return info.k === "s" ? " S" + String(info.S || 1).padStart(2, "0") + "E" + String(info.E || 1).padStart(2, "0") : ""; }

function toNuvio(s, cfg, info) {
  if (!s || typeof s.url !== "string") return null;
  var url = s.url.trim();
  if (s.drmKey || s.drmKid || s.licenseUrl) return null;          // DRM links cannot play in Nuvio
  if (/^magic_m3u8:/i.test(url)) {
    if (!cfg.inlineHls) return null;
    url = "data:application/vnd.apple.mpegurl;base64," + url.slice(11);
  } else if (!/^https?:\/\//i.test(url)) return null;
  var label = String(s.source || s.name || "Server").replace(/\s+/g, " ").trim();
  var low = label.toLowerCase(), pre = String(cfg.name).toLowerCase();
  if (low.indexOf(pre) === 0 && label.length > pre.length + 1) label = label.slice(pre.length).replace(/^[\s·:|-]+/, "") || label;   // "CineJoy Nitro" → "Nitro"
  var text = label + " " + (s.quality || "") + " " + (s.name || "");
  var headers = {};
  if (s.headers && typeof s.headers === "object") Object.keys(s.headers).forEach(function (k) {
    var v = s.headers[k];
    if (v !== undefined && v !== null && typeof v !== "object" && String(v).trim() && !/^range$/i.test(k)) headers[k] = String(v);
  });
  var subs = (Array.isArray(s.subtitles) ? s.subtitles : []).map(function (x) {
    var u = x && (x.url || x.file);
    if (!u || !/^https?:\/\//i.test(u)) return null;
    var lang = String(x.label || x.lang || x.language || "Unknown");
    return { url: u, language: lang, name: lang };
  }).filter(Boolean);
  var o = {
    name: cfg.name + " · " + label,
    title: info.title + (info.y ? " (" + info.y + ")" : "") + epTag(info),
    url: url,
    quality: qualityOf(text),
    provider: cfg.id,
  };
  var lang = languageOf(text) || (info.hitTitle ? languageOf(info.hitTitle) : ""); if (lang) o.language = lang;   // search sites: the post says "Hindi Dubbed"
  var size = sizeOf(text); if (size) o.size = size;
  if (Object.keys(headers).length) o.headers = headers;
  if (subs.length) o.subtitles = subs;
  if (cfg.hooks && typeof cfg.hooks.stream === "function") { try { o = cfg.hooks.stream(o) || o; } catch (e) {} }
  return o;
}

// ───── provider ─────
// cfg: { id, name, make, manifest, mode: "tmdb" | "search", inlineHls?, maxQueries?, hooks?,
//        itemUrl?(tm, info), episodeUrl?(tm, info) }   (tmdb mode: the plugin's own URL format; default is its JSON form)
export function makeProvider(cfg) {
  return async function getStreams(tmdbId, mediaType, season, episode) {
    var t0 = now();
    var left = function () { return BUDGET_MS - (now() - t0); };
    setNetDeadline(t0 + TV_NET_MS);
    try {
      var tm = await tmdbInfo(tmdbId, mediaType);
      if (!tm) return [];
      var info = { id: tm.id, t: tm.title, title: tm.title, y: tm.year, k: tm.type === "tv" ? "s" : "m", S: +season || (tm.type === "tv" ? 1 : 0), E: +episode || (tm.type === "tv" ? 1 : 0), alts: tm.alts, tm: tm };
      var api = instantiate(cfg.make, cfg.manifest, cfg.hooks);
      var epUrl = null;

      if (cfg.mode === "tmdb") {
        var itemUrl = cfg.itemUrl ? cfg.itemUrl(tm, info) : JSON.stringify({ type: tm.type, id: tm.id, title: tm.title });
        var r = await call(api, "load", [itemUrl], Math.min(20000, left() - 20000));
        if (r && r.success !== false && r.data) epUrl = episodeFrom(r.data, info.k === "s" ? info.S : 0, info);
        if (!epUrl && cfg.episodeUrl) epUrl = cfg.episodeUrl(tm, info);
        else if (!epUrl) epUrl = info.k === "s"
          ? JSON.stringify({ type: "tv", id: tm.id, s: info.S, e: info.E, title: tm.title, rt: tm.runtime || null })
          : JSON.stringify({ type: "movie", id: tm.id, title: tm.title, rt: tm.runtime || null });
      } else {
        var queries = [tm.title].concat(tm.alts).filter(function (q, i, a) { return q && a.indexOf(q) === i; }).slice(0, cfg.maxQueries || 2);
        for (var qi = 0; qi < queries.length && !epUrl && left() > 15000; qi++) {
          var sr = await call(api, "search", [parseTitle(queries[qi]).clean || queries[qi]], Math.min(15000, left() - 12000));
          var cands = sr && sr.success !== false ? pickMatches(sr.data, info) : [];
          dbg("[tj] search " + JSON.stringify(queries[qi]) + ": " + ((sr && sr.data) || []).slice(0, 8).map(function (x) { return x && (x.title + " (" + (x.year || "") + "," + (x.type || "") + ")"); }).join(" | ") + " → " + cands.length + " match(es)");
          for (var ci = 0; ci < cands.length && !epUrl && left() > 12000; ci++) {
            var lr = await call(api, "load", [cands[ci].url], Math.min(15000, left() - 10000));
            if (lr && lr.success !== false && lr.data) epUrl = episodeFrom(lr.data, cands[ci].sh, info);
            if (epUrl) info.hitTitle = cands[ci].title + " " + String((lr.data && lr.data.title) || "");
            dbg("[tj] load " + String(cands[ci].url).slice(0, 100) + ": " + (lr && lr.data ? (lr.data.type + ", " + ((lr.data.episodes || []).length) + " episode(s): " + (lr.data.episodes || []).slice(0, 4).map(function (e) { return "S" + e.season + "E" + e.episode + " " + String(e.name || "").slice(0, 30); }).join(" | ")) : JSON.stringify(lr).slice(0, 160)));
          }
        }
      }
      dbg("[tj] episode url (" + (now() - t0) + "ms): " + String(epUrl).slice(0, 160));
      if (!epUrl) return [];

      var st = await call(api, "loadStreams", [epUrl], left() - 1500);
      dbg("[tj] loadStreams done (" + (now() - t0) + "ms): " + (st && st.success !== false ? (st.data || []).length + " links" : JSON.stringify(st).slice(0, 200)));
      if (!st || st.success === false || !Array.isArray(st.data)) return [];
      var seen = {};
      return st.data.map(function (s) { return toNuvio(s, cfg, info); }).filter(function (s) {
        if (!s || seen[s.url]) return false;
        seen[s.url] = 1;
        return true;
      });
    } catch (e) {
      return [];
    } finally {
      cancelAll();   // TV fallback timers must not outlive the call
    }
  };
}
