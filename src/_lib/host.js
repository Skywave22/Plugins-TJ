// SkyStream plugin API on top of the Nuvio plugin runtime (QuickJS + fetch polyfill).
// Lets the tested TJ-Plugins SkyStream scrapers run unchanged inside a Nuvio provider:
// http_get / http_post / http_parallel, MultimediaItem / Episode / StreamResult / Actor / Trailer,
// getPreference / setPreference (in memory for one run), crypto.decryptAES / pbkdf2, solveCaptcha, timers.
import { setT, clearT, setI, clearI, addBlocked, nativeTimers } from "./timers.js";

var APP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var REQUEST_TIMEOUT_MS = 20000;   // SkyStream gives up after ~15 s; dead mirrors must not eat Nuvio's 60 s budget
var KNOWN_HEADERS = ["set-cookie", "location", "content-type", "content-length", "content-disposition", "server",
  "cf-ray", "cf-mitigated", "refresh", "date", "etag", "last-modified", "x-redirect", "x-powered-by", "access-control-allow-origin"];

// Nuvio joins repeated headers with ","; SkyStream gives Set-Cookie as a list
// opt-in tracing for tools/test.mjs --debug (setting "__debug"); silent in the app
export function dbg() {
  try { if (typeof SCRAPER_SETTINGS !== "undefined" && SCRAPER_SETTINGS && SCRAPER_SETTINGS.__debug) console.log(Array.prototype.join.call(arguments, " ")); } catch (e) {}
}

export function splitSetCookie(v) {
  if (!v) return [];
  return String(v).split(/,(?=\s*[^;,=\s]+=[^;,]*)/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function headerView(res) {
  var plain = {};
  KNOWN_HEADERS.forEach(function (k) {
    var v = null;
    try { v = res.headers.get(k); } catch (e) {}
    if (v !== null && v !== undefined) plain[k] = k === "set-cookie" ? splitSetCookie(v) : v;
  });
  if (typeof Proxy === "undefined") return plain;
  return new Proxy(plain, {
    get: function (t, k) {
      if (typeof k !== "string") return t[k];
      if (k in t) return t[k];
      var lk = k.toLowerCase();
      if (lk in t) return t[lk];
      try { var v = res.headers.get(lk); return v === null ? undefined : v; } catch (e) { return undefined; }
    },
    has: function (t, k) {
      if (k in t) return true;
      try { return typeof k === "string" && res.headers.get(k.toLowerCase()) !== null; } catch (e) { return false; }
    },
  });
}

function cleanHeaders(h) {
  var out = {};
  if (!h || typeof h !== "object") return out;
  Object.keys(h).forEach(function (k) {
    var v = h[k];
    if (v === undefined || v === null || typeof v === "object") return;
    var key = /^user-agent$/i.test(k) ? "User-Agent" : k;   // Nuvio adds its own UA unless the key is exactly "User-Agent"
    out[key] = String(v);
  });
  return out;
}

function encodeForm(o) {
  return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k] == null ? "" : String(o[k])); }).join("&");
}

function withTimeout(p, ms, fallback) {
  return new Promise(function (resolve) {
    var done = false;
    var t = setT(function () { if (!done) { done = true; resolve(fallback); } }, ms);
    p.then(function (v) { if (!done) { done = true; clearT(t); resolve(v); } },
      function () { if (!done) { done = true; clearT(t); resolve(fallback); } });
  });
}

// NuvioTV runs requests one at a time and blocks while each one runs, so long scrapes could pass the
// app's 60 s limit and lose everything. After this wall-clock deadline, new requests fail at once and
// the plugin finishes with what it already found. (Phones run requests in parallel and need no cutoff.)
var netDeadline = 0;
export function setNetDeadline(ts) { netDeadline = ts; }

export async function request(method, url, headers, body) {
  if (method === "POST" && headers && typeof headers === "object" && !body && (headers.body || headers.headers)) {
    body = headers.body; headers = headers.headers;
  }
  var h = cleanHeaders(headers);
  if (!h["User-Agent"]) h["User-Agent"] = APP_UA;
  var ctKey = Object.keys(h).filter(function (k) { return /^content-type$/i.test(k); })[0];
  if ((method === "POST" || method === "PUT") && !ctKey) { ctKey = "Content-Type"; h[ctKey] = body && typeof body === "object" ? "application/json" : "application/x-www-form-urlencoded"; }
  if (body && typeof body === "object") body = /form-urlencoded/i.test(h[ctKey] || "") ? encodeForm(body) : JSON.stringify(body);
  var fail = function (msg) { return { status: 0, statusCode: 0, code: 0, body: "", headers: {}, finalUrl: url, error: msg }; };
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return fail("Invalid URL: " + url);
  if (netDeadline && !nativeTimers && Date.now() > netDeadline) { dbg("  ✂ skipped (TV time limit) " + String(url).slice(0, 100)); return fail("time limit"); }
  var opts = { method: method, headers: h, redirect: method === "GET" || method === "HEAD" ? "follow" : "manual" };
  if (body !== undefined && body !== null && method !== "GET" && method !== "HEAD") opts.body = String(body);
  var t0 = Date.now();
  dbg("  → " + method + " " + url.slice(0, 120));
  var pending = fetch(url, opts);       // returns at once on phones; on NuvioTV the request already ran (blocking)
  addBlocked(Date.now() - t0);
  return withTimeout(pending.then(async function (res) {
    dbg("  ← " + res.status + " " + (Date.now() - t0) + "ms " + url.slice(0, 120));
    var text = "";
    try { text = await res.text(); } catch (e) {}
    if (!res.status) return fail(res.statusText || "connection error");
    return { status: res.status, statusCode: res.status, code: res.status, body: text || "", headers: headerView(res), finalUrl: res.url || url, url: res.url || url };
  }), REQUEST_TIMEOUT_MS, fail("timeout"));
}

function b64ToBytes(s) {
  var bin = atob(String(s || "").replace(/\s+/g, ""));
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
  var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}

function makeCrypto() {
  var real = (typeof globalThis !== "undefined" && globalThis.crypto) || {};
  var c = {};
  for (var k in real) c[k] = real[k];
  c.decryptAES = async function (data, key, iv, options) {
    var mode = String((options && options.mode) || "cbc").toLowerCase();
    var name = mode === "gcm" ? "AES-GCM" : "AES-CBC";
    if (real.subtle && real.subtle.decrypt) {
      var k2 = await real.subtle.importKey("raw", b64ToBytes(key), { name: name }, false, ["decrypt"]);
      var out = await real.subtle.decrypt({ name: name, iv: b64ToBytes(iv) }, k2, b64ToBytes(data));
      return utf8Decode(new Uint8Array(out));
    }
    if (typeof CryptoJS !== "undefined" && name === "AES-CBC") {
      var E = CryptoJS.enc.Base64;
      return CryptoJS.AES.decrypt({ ciphertext: E.parse(data) }, E.parse(key), { iv: E.parse(iv), mode: CryptoJS.mode.CBC }).toString(CryptoJS.enc.Utf8);
    }
    throw new Error("AES not available");
  };
  c.pbkdf2 = async function (password, salt, iterations, keyLength) {
    if (!(real.subtle && real.subtle.deriveBits) && typeof CryptoJS !== "undefined") {
      return CryptoJS.PBKDF2(String(password), CryptoJS.enc.Base64.parse(salt), { keySize: (keyLength || 32) / 4, iterations: iterations || 10000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Base64);
    }
    var enc = new TextEncoder().encode(String(password));
    var key = await real.subtle.importKey("raw", enc, { name: "PBKDF2" }, false, ["deriveBits"]);
    var bits = await real.subtle.deriveBits({ name: "PBKDF2", salt: b64ToBytes(salt), iterations: iterations || 10000, hash: "SHA-256" }, key, (keyLength || 32) * 8);
    return bytesToB64(new Uint8Array(bits));
  };
  return c;
}

function cls(defaults) {
  return function (p) {
    var o = {};
    for (var k in defaults) o[k] = defaults[k];
    if (p) for (var k2 in p) o[k2] = p[k2];
    for (var k3 in o) this[k3] = o[k3];
  };
}

// everything a SkyStream plugin expects to find, as one object (passed as factory arguments)
export function createHost() {
  var store = {};
  var http_get = function (url, headers, cb) {
    return request("GET", url, headers, null).then(function (r) { if (typeof cb === "function") cb(r); return r; });
  };
  var http_post = function (url, headers, body, cb) {
    return request("POST", url, headers, body).then(function (r) { if (typeof cb === "function") cb(r); return r; });
  };
  return {
    http_get: http_get,
    http_post: http_post,
    http_parallel: function (reqs) {
      return Promise.all((reqs || []).map(function (r) { return request((r.method || "GET").toUpperCase(), r.url, r.headers, r.body); }));
    },
    _fetch: async function (url) { return await http_get(url, {}); },
    MultimediaItem: cls({ type: "movie", status: "ongoing", playbackPolicy: "none", isAdult: false, streams: [], syncData: {} }),
    Episode: cls({ season: 0, episode: 0, dubStatus: "none", playbackPolicy: "none", streams: [] }),
    StreamResult: function (p) {
      p = p || {};
      this.url = p.url; this.source = p.source || "Auto"; this.headers = p.headers; this.subtitles = p.subtitles;
      this.drmKid = p.drmKid; this.drmKey = p.drmKey; this.licenseUrl = p.licenseUrl;
    },
    Actor: cls({}), Trailer: cls({}), NextAiring: cls({}),
    getPreference: function (k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null); },
    setPreference: function (k, v) { store[k] = v; },
    crypto: makeCrypto(),
    solveCaptcha: function () { return Promise.reject(new Error("captcha is not available in Nuvio")); },
    console: (function () {
      var f = function () { dbg.apply(null, ["  [plugin]"].concat(Array.prototype.slice.call(arguments).map(function (x) { try { return typeof x === "string" ? x : JSON.stringify(x); } catch (e) { return String(x); } }))); };
      return { log: f, error: f, warn: f, info: f, debug: f };
    })(),
    setTimeout: setT, clearTimeout: clearT, setInterval: setI, clearInterval: clearI,
  };
}

// arguments the build passes to every embedded SkyStream plugin (see build.js)
export var FACTORY_ARGS = ["manifest", "globalThis", "getPreference", "setPreference", "http_get", "http_post", "http_parallel", "_fetch",
  "MultimediaItem", "Episode", "StreamResult", "Actor", "Trailer", "NextAiring", "crypto", "solveCaptcha", "console",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval"];

// runs the plugin factory in its own sandbox; returns { getHome, search, load, loadStreams }
export function instantiate(make, manifest) {
  var host = createHost();
  var real = typeof globalThis !== "undefined" ? globalThis : {};
  var shadow = Object.create(real);   // reads fall through to the real globals, plugin writes stay here
  var api = make.call(shadow, manifest, shadow, host.getPreference, host.setPreference, host.http_get, host.http_post, host.http_parallel,
    host._fetch, host.MultimediaItem, host.Episode, host.StreamResult, host.Actor, host.Trailer, host.NextAiring, host.crypto,
    host.solveCaptcha, host.console, host.setTimeout, host.clearTimeout, host.setInterval, host.clearInterval) || {};
  ["getHome", "search", "load", "loadStreams"].forEach(function (k) { if (typeof api[k] !== "function" && typeof shadow[k] === "function") api[k] = shadow[k]; });
  api.host = host;
  return api;
}
