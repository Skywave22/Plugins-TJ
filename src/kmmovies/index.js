// KMMovies for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";

const inner = makeProvider({ id: "kmmovies", name: "KMMovies", make, manifest, mode: "search" });

// Movies only: the site's series files are whole seasons in one file (single
// episodes are on magiclinks.lol behind a Cloudflare check), so an episode
// request can't be answered with the right video.
export async function getStreams(tmdbId, mediaType, season, episode) {
  if (String(mediaType || "").toLowerCase() !== "movie") return [];
  return inner(tmdbId, mediaType, season, episode);
}
