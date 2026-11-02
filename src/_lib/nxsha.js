// nxsha (ScreenScape "Scape" servers), used by several TJ-Plugins providers.
// On NuvioTV every request blocks and runs one after another, so asking all ~31 nxsha servers takes
// 25–35 s and leaves no time to check the links. There, only the servers that actually return links are
// asked (measured on movies and series), Hindi ones first. Phones keep the full list (requests run in parallel).
import { nativeTimers } from "./timers.js";

export var NX_TV_SERVERS = [
  "mhbox", "awsind", "rive-citadel", "nitro", "em-8", "xdownloader", "castle", "k4khdhub",
  "streamflix", "vidapi", "hdhub4u-direct", "rive-flowcast", "vixolity", "k4khdhub-direct",
];

export function nxTvServers(plain) {
  if (nativeTimers) return plain;
  var s = String(plain);
  if (s.indexOf('"servers"') < 0) return plain;
  var o = JSON.parse(s);
  if (!o || !Array.isArray(o.servers)) return plain;
  var keep = o.servers.filter(function (x) { return x && NX_TV_SERVERS.indexOf(x.scraper) >= 0; });
  if (!keep.length) return plain;
  keep.sort(function (a, b) { return NX_TV_SERVERS.indexOf(a.scraper) - NX_TV_SERVERS.indexOf(b.scraper); });
  o.servers = keep;
  return JSON.stringify(o);
}

// VidPi (nxsha "vidapi") links: the playlists work with nxsha's Referer, but their segment host rejects it
// (Cloudflare 403) and serves them fine without it. Nuvio sends the same headers for playlist and segments.
export function nxStream(o) {
  if (o && o.headers && /\/pl\/H4sI/.test(o.url)) {
    Object.keys(o.headers).forEach(function (k) {
      if (/^(referer|origin)$/i.test(k) && /nxsha/i.test(o.headers[k])) delete o.headers[k];
    });
  }
  return o;
}

export var nxHooks = { afterDecrypt: nxTvServers, stream: nxStream };
