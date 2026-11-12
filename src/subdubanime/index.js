// SubDubAnime for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
// The site's catalog is keyed by TMDB id, so no search: the plugin's TMDB mode ({ orig, kind, s, e }) collects
// every language version of the title (Hindi Dubbed, Hindi Fan Dubbed, English Dubbed...).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";

export const getStreams = makeProvider({
  id: "subdubanime", name: "SubDubAnime", make, manifest, mode: "tmdb", direct: true,
  episodeUrl: function (tm, info) {
    return JSON.stringify(info.k === "s"
      ? { orig: tm.id, kind: "tv", s: info.S, e: info.E, t: tm.title }
      : { orig: tm.id, kind: "movie", t: tm.title });
  }
});
