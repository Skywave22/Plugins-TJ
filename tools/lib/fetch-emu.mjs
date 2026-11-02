// OkHttp-like request used by tools/test.mjs: what the Nuvio apps' native fetch bridge returns.
//  - default UA unless the key is exactly "User-Agent"; Accept-Encoding stripped (OkHttp gzips itself)
//  - redirects followed unless followRedirects === false
//  - body read up to 1 MB, then "\n...[truncated]"; repeated headers joined with ","; values capped at 8 KB
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MAX_BODY = 1024 * 1024;
const OKHTTP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// NUVIO_CURL=<regex|all>: send matching requests through curl. Some hosts (GDFlix) reject Node's TLS
// fingerprint but accept curl's — and OkHttp's, which the apps use — so this keeps tests honest.
function curlRe() { const v = process.env.NUVIO_CURL; return v ? (v === "all" ? /./ : new RegExp(v, "i")) : null; }

function curlFetch({ url, method, headers, bodyKind, body, followRedirects, timeoutMs }) {
  return new Promise((resolve) => {
    const hf = path.join(os.tmpdir(), "nf-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".h");
    const args = ["-s", "-S", "--compressed", "-X", method, "-D", hf, "-m", String(Math.ceil(timeoutMs / 1000)), "-o", "-"];
    if (followRedirects !== false) args.push("-L");
    for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
    if (bodyKind === "text" && method !== "GET" && method !== "HEAD") args.push("--data-binary", "@-");
    if (bodyKind === "base64") args.push("--data-binary", "@-");
    args.push(url);
    const p = spawn("curl", args);
    const chunks = []; let n = 0, truncated = false, err = "";
    p.stdout.on("data", (c) => { if (truncated) return; chunks.push(c); n += c.length; if (n > MAX_BODY) { truncated = true; p.kill(); } });
    p.stderr.on("data", (c) => (err += c));
    if (bodyKind === "text") p.stdin.end(body); else if (bodyKind === "base64") p.stdin.end(Buffer.from(body, "base64")); else p.stdin.end();
    p.on("close", () => {
      let raw = ""; try { raw = fs.readFileSync(hf, "latin1"); fs.unlinkSync(hf); } catch {}
      const blocks = raw.split(/\r?\n\r?\n/).filter((b) => /^HTTP\//.test(b));
      if (!blocks.length) return resolve({ error: "curl: " + err.trim().slice(0, 80), out: { ok: false, status: 0, statusText: "Fetch failed", url, body: "", bodyBase64: "", headers: {} } });
      let final = url;
      blocks.slice(0, -1).forEach((b) => { const m = b.match(/^location:\s*(.+)$/im); if (m) final = new URL(m[1].trim(), final).href; });
      const last = blocks[blocks.length - 1].split(/\r?\n/);
      const status = +(last[0].split(" ")[1] || 0);
      const rh = {}, sc = [];
      last.slice(1).forEach((l) => { const i = l.indexOf(":"); if (i < 0) return; const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
        if (k === "set-cookie") sc.push(v); else rh[k] = rh[k] ? rh[k] + "," + v : v; });
      if (sc.length) rh["set-cookie"] = sc.join(",");
      for (const k of Object.keys(rh)) if (rh[k].length > 8192) rh[k] = rh[k].slice(0, 8192 - 15) + "\n...[truncated]";
      const buf = Buffer.concat(chunks).subarray(0, MAX_BODY);
      resolve({ truncated, out: { ok: status >= 200 && status < 300, status, url: final, statusText: "", body: buf.toString("utf8") + (truncated ? "\n...[truncated]" : ""), bodyBase64: buf.toString("base64"), headers: rh } });
    });
  });
}

export async function nativeFetch({ url, method = "GET", headers = {}, bodyKind = "none", body = "", followRedirects = true, timeoutMs = 60000 }) {
  headers = { ...headers };
  for (const k of Object.keys(headers)) if (/^accept-encoding$/i.test(k)) delete headers[k];
  if (!Object.prototype.hasOwnProperty.call(headers, "User-Agent")) headers["User-Agent"] = OKHTTP_UA;
  const CURL_RE = curlRe();
  if (CURL_RE && CURL_RE.test(url)) return curlFetch({ url, method, headers, bodyKind, body, followRedirects, timeoutMs });
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const init = { method, headers, redirect: followRedirects === false ? "manual" : "follow", signal: ac.signal };
    if (bodyKind === "text" && method !== "GET" && method !== "HEAD") init.body = body;
    if (bodyKind === "base64") init.body = Buffer.from(body, "base64");
    const res = await fetch(url, init);
    const chunks = []; let n = 0, truncated = false;
    try { for await (const c of res.body || []) { chunks.push(Buffer.from(c)); n += c.length; if (n > MAX_BODY) { truncated = true; break; } } } catch {}
    const buf = Buffer.concat(chunks).subarray(0, MAX_BODY);
    const rh = {};
    res.headers.forEach((v, k) => { rh[k.toLowerCase()] = v; });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) rh["set-cookie"] = sc.join(",");
    for (const k of Object.keys(rh)) if (rh[k].length > 8192) rh[k] = rh[k].slice(0, 8192 - 15) + "\n...[truncated]";
    return { truncated, out: { ok: res.status >= 200 && res.status < 300, status: res.status, url: res.url || url, statusText: res.statusText,
      body: buf.toString("utf8") + (truncated ? "\n...[truncated]" : ""), bodyBase64: buf.toString("base64"), headers: rh } };
  } catch (e) {
    return { error: String(e.cause?.code || e.message), out: { ok: false, status: 0, statusText: String(e.message || "Fetch failed"), url, body: "", bodyBase64: "", headers: {} } };
  } finally { clearTimeout(tm); ac.abort(); }
}

// `node tools/lib/fetch-emu.mjs` with a JSON request on stdin: the synchronous TV bridge (spawnSync)
if (process.argv[1] && process.argv[1].endsWith("fetch-emu.mjs")) {
  let input = "";
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", async () => { const r = await nativeFetch(JSON.parse(input)); process.stdout.write(JSON.stringify(r), () => process.exit(0)); });
}
