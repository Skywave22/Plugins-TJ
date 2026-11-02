// FMovies for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";
import { slugify } from "../_lib/urls.js";

var SITE = String(manifest.baseUrl || "https://fmoviess.tv").replace(/\/+$/, "");
function itemUrl(tm) { return SITE + "/" + (tm.type === "tv" ? "tv" : "movie") + "/" + tm.id + "/" + slugify(tm.title); }

export const getStreams = makeProvider({
  id: "fmovies", name: "FMovies", make, manifest, mode: "tmdb",
  itemUrl: itemUrl,
  episodeUrl: function (tm, info) { return info.k === "s" ? itemUrl(tm) + "?season=" + info.S + "&episode=" + info.E : itemUrl(tm); },
});
