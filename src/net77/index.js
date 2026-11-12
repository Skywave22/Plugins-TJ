// Net77 for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
// skystream.json sets masterLink: one link per title = NetMirror's own master playlist (every quality
// and every audio language; pick the language in the player's audio menu).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";
import { nativeTimers } from "../_lib/timers.js";

const inner = makeProvider({ id: "net77", name: "Net77", make, manifest, mode: "search" });

// NetMirror signs a video only after its ~35-second "ads" check, which can't finish within
// NuvioTV's time limit (no new requests after ~32 s), so on TV it stops at once instead of
// holding a scraper slot for nothing. Phones and tablets (native timers) get the full run.
export async function getStreams(tmdbId, mediaType, season, episode) {
  if (!nativeTimers) return [];
  return inner(tmdbId, mediaType, season, episode);
}
