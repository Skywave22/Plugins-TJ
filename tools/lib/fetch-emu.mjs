// OkHttp-like request used by tools/test.mjs: what the Nuvio apps' native fetch bridge returns.
//  - default UA unless the key is exactly "User-Agent"; Accept-Encoding stripped (OkHttp gzips itself)
//  - redirects followed unless followRedirects === false
//  - body read up to 1 MB, then "\n...[truncated]"; repeated headers joined with ","; values capped at 8 KB
export const MAX_BODY = 1024 * 1024;
const OKHTTP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export async function nativeFetch({ url, method = "GET", headers = {}, bodyKind = "none", body = "", followRedirects = true, timeoutMs = 60000 }) {
  headers = { ...headers };
  for (const k of Object.keys(headers)) if (/^accept-encoding$/i.test(k)) delete headers[k];
  if (!Object.prototype.hasOwnProperty.call(headers, "User-Agent")) headers["User-Agent"] = OKHTTP_UA;
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
