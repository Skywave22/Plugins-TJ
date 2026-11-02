#!/usr/bin/env node
/**
 * TJ-Plugins — Nuvio app-accurate provider test.
 *
 * Runs a built provider (providers/<id>.js) the way the Nuvio app does:
 *  - real QuickJS engine (quickjs-emscripten), like the app's quickjs-kt
 *  - the app's own polyfills (tools/runtime/polyfill.js, extracted from JsBindings.kt) and its
 *    getStreams call wrapper (tools/runtime/call.js), the plugin wrapped in the same module shim
 *  - host functions emulated from the Kotlin side: __native_fetch (OkHttp: default UA, POST follows
 *    redirects unless redirect:'manual', multi-value headers joined with ","), __plugin_sleep,
 *    __parse_url, __crypto_*, settings / TMDB key / call args, 60 s plugin timeout
 *  - parses the result exactly like PluginRuntime.parseJsonResults, then (--check) probes each link
 *    with its headers to see that it really plays (HLS playlist + first segment, or video bytes)
 *
 * Usage:
 *   node tools/test.mjs <id> <tmdbId> [movie|tv] [season] [episode] [--check] [--tv] [--debug] [--log] [--http]
 *   --tv     run in the NuvioTV runtime instead (own polyfill, blocking fetch, real CryptoJS, no setTimeout)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { getQuickJS } from "quickjs-emscripten";
import { nativeFetch, MAX_BODY } from "./lib/fetch-emu.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const pos = argv.filter((a) => !a.startsWith("--"));
const [id, tmdbId, mediaType = "movie", season, episode] = pos;
if (!id || !tmdbId) { console.error("usage: node tools/test.mjs <id> <tmdbId> [movie|tv] [season] [episode] [--check] [--log] [--http]"); process.exit(2); }
const SHOW_LOG = flags.has("--log") || flags.has("--debug"), SHOW_HTTP = flags.has("--http"), CHECK = flags.has("--check");
const PLUGIN_TIMEOUT_MS = 60_000;
const TV = flags.has("--tv");   // NuvioTV: its own polyfill, blocking fetch (30 s), real CryptoJS, no timers, no native crypto
const C = { r: (s) => `\x1b[31m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, b: (s) => `\x1b[36m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };

const file = path.join(ROOT, "providers", id + ".js");
const code = fs.readFileSync(file, "utf8");
const polyfill = fs.readFileSync(path.join(ROOT, TV ? "tools/runtime/tv-polyfill.js" : "tools/runtime/polyfill.js"), "utf8");
const callCode = fs.readFileSync(path.join(ROOT, TV ? "tools/runtime/tv-call.js" : "tools/runtime/call.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const entry = manifest.scrapers.find((s) => s.id === id);
if (!entry) console.log(C.y(`! ${id} is not listed in manifest.json`));

const QuickJS = await getQuickJS();
const rt = QuickJS.newRuntime();
rt.setMemoryLimit(512 * 1024 * 1024);
rt.setMaxStackSize(4 * 1024 * 1024);
const vm = rt.newContext();
const t0 = Date.now();
const notes = [];
const inflight = new Set();
let consoleCalls = 0, httpCount = 0, result = null, pendingHost = 0;
rt.setInterruptHandler(() => Date.now() - t0 > PLUGIN_TIMEOUT_MS + 5000);

const def = (name, fn) => { const h = vm.newFunction(name, fn); vm.setProp(vm.global, name, h); h.dispose(); };
const str = (h) => (h === undefined ? undefined : vm.dump(h));
const ret = (v) => (v === undefined || v === null ? vm.undefined : typeof v === "boolean" ? (v ? vm.true : vm.false) : typeof v === "number" ? vm.newNumber(v) : vm.newString(String(v)));
function asyncHost(name, fn) {
  def(name, (...args) => {
    const vals = args.map(str);
    const d = vm.newPromise();
    pendingHost++;
    Promise.resolve().then(() => fn(...vals)).then(
      (v) => { if (vm.alive) { const h = ret(v); d.resolve(h); h.dispose?.(); } },
      (e) => { if (vm.alive) { const h = vm.newError(String(e && e.message || e)); d.reject(h); h.dispose(); } },
    ).finally(() => { pendingHost--; });
    d.settled.then(() => { if (vm.alive) rt.executePendingJobs(); });
    return d.handle;
  });
}

// ── console (HostFunctions.kt)
const con = vm.newObject();
for (const lvl of ["log", "error", "warn", "info", "debug"]) {
  const h = vm.newFunction(lvl, (...a) => { consoleCalls++; if (SHOW_LOG || lvl === "error") console.log(C.d(`  [${lvl}] `) + a.map(str).map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ").slice(0, 400)); });
  vm.setProp(con, lvl, h); h.dispose();
}
vm.setProp(vm.global, "console", con); con.dispose();

// ── HostFunctions.kt
const callArgs = JSON.stringify({ tmdbId: String(tmdbId), mediaType, season: season ? +season : null, episode: episode ? +episode : null });
def("__get_scraper_id", () => vm.newString(id));
def("__get_scraper_settings", () => vm.newString(flags.has("--debug") ? '{"__debug":true}' : "{}"));
def("__get_tmdb_api_key", () => vm.newString(process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c"));
def("__get_call_args", () => vm.newString(callArgs));
def("__capture_result", (h) => { if (result === null) result = str(h); });
if (!TV) asyncHost("__plugin_sleep", (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.min(60000, +ms || 0)))));

// ── UrlBridge.kt
def("__parse_url", (h) => {
  try {
    const u = new URL(str(h));
    return vm.newString(JSON.stringify({ protocol: u.protocol, host: u.host, hostname: u.hostname, port: u.port, pathname: u.pathname || "/", search: u.search, hash: u.hash }));
  } catch { return vm.newString(JSON.stringify({ protocol: "", host: "", hostname: "", port: "", pathname: "/", search: "", hash: "" })); }
});

// ── FetchBridge.kt + OkHttp (AddonPlatform.android.kt) — async on mobile, blocking on TV
function logFetch(method, url, r, ms) {
  if (r.truncated) notes.push(`response over 1 MB truncated by the app: ${url.slice(0, 100)}`);
  if (SHOW_HTTP) console.log(C.d(`  [HTTP] ${method} ${r.error ? "ERR " + r.error : r.out.status} ${ms}ms ${url.slice(0, 140)}`));
}
function fetchParams(url, method, headersJson, bodyKind, body, followRedirects) {
  let headers = {};
  try { headers = JSON.parse(headersJson || "{}"); } catch {}
  return { url, method, headers, bodyKind, body, followRedirects: followRedirects !== false && followRedirects !== "false", timeoutMs: TV ? 30000 : 60000 };
}
if (TV) {
  def("__native_fetch", (...a) => {
    httpCount++;
    const [url, method, headersJson, bodyKind, body, fr] = a.map(str);
    const ts = Date.now();
    const p = spawnSync(process.execPath, [path.join(ROOT, "tools/lib/fetch-emu.mjs")], { input: JSON.stringify(fetchParams(url, method, headersJson, bodyKind, body, fr)), maxBuffer: 64 * 1024 * 1024, timeout: 40000 });
    let r; try { r = JSON.parse(p.stdout.toString()); } catch { r = { error: "spawn failed", out: { ok: false, status: 0, statusText: "Fetch failed", url, body: "", bodyBase64: "", headers: {} } }; }
    logFetch(method, url, r, Date.now() - ts);
    return vm.newString(JSON.stringify(r.out));
  });
} else {
  asyncHost("__native_fetch", async (url, method, headersJson, bodyKind, body, followRedirects) => {
    httpCount++;
    const ts = Date.now();
    const flight = { method, url, ts }; inflight.add(flight);
    const r = await nativeFetch(fetchParams(url, method, headersJson, bodyKind, body, followRedirects));
    inflight.delete(flight);
    logFetch(method, url, r, Date.now() - ts);
    return JSON.stringify(r.out);
  });
}

if (!TV) {
// ── CryptoBridge.kt / PluginCrypto.android.kt
const tok = (s) => String(s || "").toUpperCase().replace(/[-_/ ]/g, "");
const dig = (a) => ({ MD5: "md5", SHA1: "sha1", SHA256: "sha256", SHA384: "sha384", SHA512: "sha512" })[tok(a).replace(/^HMAC/, "")] || "sha256";
const hx = (s) => Buffer.from(String(s || ""), "hex");
const safe = (fn) => (...a) => { try { return vm.newString(fn(...a.map(str))); } catch (e) { return vm.newString(""); } };
def("__crypto_get_random_values_hex", safe((n) => crypto.randomBytes(+n || 0).toString("hex")));
def("__crypto_digest_hex_raw", safe((a, d) => crypto.createHash(dig(a)).update(hx(d)).digest("hex")));
def("__crypto_hmac_hex_raw", safe((a, k, d) => crypto.createHmac(dig(a), hx(k)).update(hx(d)).digest("hex")));
def("__crypto_pbkdf2_hex", safe((p, s, it, bits, a) => crypto.pbkdf2Sync(hx(p), hx(s), +it || 1000, (+bits || 256) / 8, dig(a)).toString("hex")));
function aes(enc, mode, k, iv, d) {
  const m = tok(mode), key = hx(k), ivb = hx(iv), data = hx(d), bits = key.length * 8;
  if (m.includes("GCM")) {
    if (enc) { const c = crypto.createCipheriv(`aes-${bits}-gcm`, key, ivb); return Buffer.concat([c.update(data), c.final(), c.getAuthTag()]).toString("hex"); }
    const c = crypto.createDecipheriv(`aes-${bits}-gcm`, key, ivb); c.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([c.update(data.subarray(0, data.length - 16)), c.final()]).toString("hex");
  }
  const name = `aes-${bits}-${m.includes("ECB") ? "ecb" : "cbc"}`;
  const c = enc ? crypto.createCipheriv(name, key, m.includes("ECB") ? null : ivb) : crypto.createDecipheriv(name, key, m.includes("ECB") ? null : ivb);
  c.setAutoPadding(!m.includes("NOPADDING"));
  return Buffer.concat([c.update(data), c.final()]).toString("hex");
}
def("__crypto_aes_encrypt_hex", safe((m, k, iv, d) => aes(true, m, k, iv, d)));
def("__crypto_aes_decrypt_hex", safe((m, k, iv, d) => aes(false, m, k, iv, d)));
def("__crypto_digest_hex", safe((a, d) => crypto.createHash(dig(a)).update(String(d), "utf8").digest("hex")));
def("__crypto_hmac_hex", safe((a, k, d) => crypto.createHmac(dig(a), String(k)).update(String(d), "utf8").digest("hex")));
def("__crypto_base64_encode", safe((d) => Buffer.from(String(d), "utf8").toString("base64")));
def("__crypto_base64_decode", safe((d) => Buffer.from(String(d), "base64").toString("utf8")));
def("__crypto_utf8_to_hex", safe((d) => Buffer.from(String(d), "utf8").toString("hex")));
def("__crypto_hex_to_utf8", safe((d) => hx(d).toString("utf8")));
def("__crypto_sign_hex", safe(() => { throw new Error("not emulated"); }));
def("__crypto_verify_hex", () => vm.false);
}
// DOM / cheerio bridge is jsoup-based in the app: our providers do not use it (regex/JSON only)
for (const n of ["__cheerio_load", "__cheerio_select", "__cheerio_find", "__cheerio_text", "__cheerio_html", "__cheerio_inner_html", "__cheerio_attr", "__cheerio_next", "__cheerio_prev"])
  def(n, () => { notes.push("cheerio used: " + n + " (not emulated here — avoid it, the app's cheerio is a jsoup subset)"); return vm.newString("[]"); });

// ── evaluate like PluginRuntime.executePluginInternal
function evalOrDie(src, name) {
  const r = vm.evalCode(src, name);
  if (r.error) { const e = vm.dump(r.error); r.error.dispose(); throw new Error(`${name}: ${typeof e === "object" ? (e.message + "\n" + (e.stack || "")) : e}`); }
  r.value.dispose();
}
const wrapped = `var module = { exports: {} };\nvar exports = module.exports;\n(function() {\n${code}\n})();`;
console.log(C.b(`▶ ${id}${entry ? " v" + entry.version : ""}${TV ? " [NuvioTV runtime]" : ""} — getStreams(${tmdbId}, ${mediaType}${season ? ", " + season + ", " + episode : ""})`));
try {
  evalOrDie(polyfill, "polyfill.js");
  if (TV) evalOrDie(fs.readFileSync(path.join(ROOT, "node_modules/crypto-js/crypto-js.js"), "utf8"), "crypto-js.js");
  evalOrDie(wrapped, `providers/${id}.js`);
  evalOrDie(callCode, "call.js");
} catch (e) { console.log(C.r("✖ evaluation failed: " + e.message)); process.exit(1); }

while (result === null && Date.now() - t0 < PLUGIN_TIMEOUT_MS) {
  rt.executePendingJobs();
  if (result !== null) break;
  await new Promise((r) => setTimeout(r, pendingHost ? 5 : 1));
}
const ms = Date.now() - t0;
if (result === null) { for (const f of inflight) console.log(C.y(`  still waiting ${((Date.now() - f.ts) / 1000).toFixed(0)}s: ${f.method} ${f.url.slice(0, 150)}`)); console.log(C.r(`✖ TIMEOUT: no result after ${PLUGIN_TIMEOUT_MS / 1000}s — the app would show nothing from this provider`)); process.exit(1); }

// ── PluginRuntime.parseJsonResults
let arr = [];
try { arr = JSON.parse(result); } catch { notes.push("result is not JSON"); }
const streams = (Array.isArray(arr) ? arr : []).filter((x) => x && typeof x === "object").map((x) => {
  const url = typeof x.url === "string" ? x.url : x.url && x.url.url;
  return { ...x, url };
}).filter((x) => x.url && String(x.url).trim());
const bad = (Array.isArray(arr) ? arr.length : 0) - streams.length;
if (bad) notes.push(`${bad} result(s) dropped by the app (no url)`);
for (const s of streams) {
  if (s.headers && Object.values(s.headers).some((v) => typeof v !== "string")) notes.push("non-string header value (dropped by the app): " + s.name);
  if (!s.name) notes.push("stream without name (app shows title instead)");
}
console.log(`${streams.length ? C.g("✔") : C.y("○")} ${streams.length} stream(s) in ${(ms / 1000).toFixed(1)}s, ${httpCount} requests${consoleCalls ? C.y(`, ${consoleCalls} console call(s)`) : ""}`);

async function probe(s) {
  const h = { ...(s.headers || {}) };
  if (!Object.keys(h).some((k) => /^user-agent$/i.test(k))) h["User-Agent"] = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
  const get = async (u, range) => {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 20000);
    const r = await fetch(u, { headers: range ? { ...h, Range: "bytes=0-65535" } : h, signal: ac.signal });
    const chunks = []; let n = 0; const cap = range ? 65536 : 4 * 1024 * 1024;   // never download a whole video
    try { for await (const c of r.body) { chunks.push(Buffer.from(c)); n += c.length; if (n >= cap) break; } } catch {}
    ac.abort(); clearTimeout(tm);
    const b = Buffer.concat(chunks);
    return { status: r.status, type: r.headers.get("content-type") || "", body: b, url: r.url };
  };
  try {
    let r = await get(s.url, true);
    if (r.status >= 400) return `HTTP ${r.status}`;
    let txt = r.body.subarray(0, 4096).toString("utf8");
    if (/^#EXTM3U/.test(txt.trim())) {
      r = await get(s.url, false); txt = r.body.toString("utf8");
      const lines = txt.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
      let mediaUrl = r.url;
      if (/#EXT-X-STREAM-INF/.test(txt)) {
        mediaUrl = new URL(lines[0], r.url).href;
        const m = await get(mediaUrl, false); if (m.status >= 400) return `variant HTTP ${m.status}`;
        txt = m.body.toString("utf8");
      }
      const seg = txt.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
      if (!seg) return "playlist without segments";
      const d = txt.split(/\r?\n/).filter((l) => l.startsWith("#EXTINF")).reduce((a, l) => a + parseFloat(l.slice(8)), 0);
      let sg = await get(new URL(seg, mediaUrl).href, true);
      if (sg.status >= 400) sg = await get(new URL(seg, mediaUrl).href, false);   // players fetch segments without Range
      if (sg.status >= 400) return `segment HTTP ${sg.status}`;
      const b0 = sg.body[0];
      return `OK hls ${(d / 60).toFixed(0)} min, segment ${sg.status} ${b0 === 0x47 ? "ts" : sg.type || "bytes"}`;
    }
    if (/text\/html/i.test(r.type) || /<html/i.test(txt.slice(0, 500))) return "HTML page, not a video";
    return `OK ${r.status} ${r.type || "?"}`;
  } catch (e) { return "ERR " + (e.cause?.code || e.message); }
}

let okCount = 0;
for (const [i, s] of streams.entries()) {
  const line = `  ${String(i + 1).padStart(2)}. ${s.name || "(no name)"}${s.title ? C.d(" | " + String(s.title).replace(/\n/g, " ⏎ ")) : ""} ${C.d("[" + [s.quality, s.size, s.language].filter(Boolean).join(" • ") + "]")}`;
  console.log(line);
  console.log(C.d(`      ${String(s.url).slice(0, 150)}${s.headers ? "  headers: " + Object.keys(s.headers).join(",") : ""}${s.subtitles ? "  subs: " + s.subtitles.length : ""}`));
  if (CHECK && i < 12) {
    const p = await probe(s);
    if (p.startsWith("OK")) okCount++;
    console.log("      " + (p.startsWith("OK") ? C.g(p) : C.r(p)));
  }
}
if (CHECK) console.log(okCount ? C.g(`✔ ${okCount}/${Math.min(12, streams.length)} checked links play`) : C.r("✖ no checked link plays"));
for (const n of [...new Set(notes)]) console.log(C.y("! " + n));
// (no dispose: pending host promises would trip QuickJS GC assertions; the process exits anyway)
process.exit(streams.length && (!CHECK || okCount) ? 0 : 1);
