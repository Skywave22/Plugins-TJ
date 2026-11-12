// AniHype for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
// AniHype is keyed by AniList ids, Nuvio asks with TMDB ids. findEpisode maps one to the other:
//   arm.haglund.dev  TMDB id -> AniList entries (+ which TMDB season each entry is)
//   movie            -> the MOVIE entry
//   series season S  -> the entries of TMDB season S, in airing order (AniList); episode E is walked across
//                       them (split seasons: "Final Season" 16 eps -> "Part 2" ...)
//   one long entry   -> (One Piece: TMDB splits it into seasons, AniList has one entry) absolute episode number
// When no mapping is found the adapter falls back to AniHype's own search (title + season match).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";
import { request, dbg } from "../_lib/host.js";

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

async function getJson(url, ms, method, body) {
  try {
    var r = await request(method || "GET", url, method === "POST" ? { "Content-Type": "application/json", "Accept": "application/json" } : { "Accept": "application/json" }, body);
    if (!r || Number(r.status) !== 200) return null;
    return JSON.parse(String(r.body || ""));
  } catch (e) { return null; }
}

function dateKey(d) {
  if (!d || !d.year) return 99999999;
  return d.year * 10000 + (d.month || 12) * 100 + (d.day || 28);
}

async function findEpisode(tm, info) {
  var list = await getJson("https://arm.haglund.dev/api/v2/themoviedb?id=" + tm.id, 8000);
  if (!Array.isArray(list) || !list.length) return null;
  list = list.filter(function (x) { return x && x.anilist; });
  if (info.k === "m") {
    var mv = list.filter(function (x) { return x.media === "MOVIE"; });
    if (!mv.length && list.length === 1 && list[0].media !== "TV") mv = list;
    dbg("[anihype] movie -> " + (mv[0] ? mv[0].anilist : "none"));
    return mv.length ? JSON.stringify({ id: mv[0].anilist, ep: 1, title: tm.title }) : null;
  }
  var tv = list.filter(function (x) { return x.media !== "MOVIE" && x.media !== "MUSIC"; });
  var S = info.S || 1, E = info.E || 1;
  var cands = tv.filter(function (x) { return x["themoviedb-season"] === S; });
  if (cands.length > 1) {
    var same = cands.filter(function (x) { return x["thetvdb-season"] == null || x["thetvdb-season"] === S; });
    if (same.length) cands = same;
  }
  if (!cands.length) {
    // one AniList entry for the whole show (no per-season mapping): absolute episode number
    var whole = tv.filter(function (x) { return x["themoviedb-season"] == null && (x.media === "TV" || x.media === "ONA"); });
    if (whole.length !== 1) return null;
    var abs = E;
    if (S > 1) {
      var d = await getJson("https://api.themoviedb.org/3/tv/" + tm.id + "?api_key=" + TMDB_KEY, 8000);
      if (!d || !d.seasons) return null;
      d.seasons.forEach(function (s) { if (s.season_number > 0 && s.season_number < S) abs += s.episode_count || 0; });
    }
    dbg("[anihype] S" + S + "E" + E + " -> " + whole[0].anilist + " ep " + abs + " (absolute)");
    return JSON.stringify({ id: whole[0].anilist, ep: abs, title: tm.title });
  }
  if (cands.length === 1) {
    dbg("[anihype] S" + S + "E" + E + " -> " + cands[0].anilist + " ep " + E);
    return JSON.stringify({ id: cands[0].anilist, ep: E, title: tm.title });
  }
  // several AniList entries in this TMDB season: order by start date and walk the episode number
  var ids = cands.map(function (x) { return x.anilist; });
  var q = "{Page(perPage:25){media(id_in:[" + ids.join(",") + "],type:ANIME){id episodes format startDate{year month day}}}}";
  var g = await getJson("https://graphql.anilist.co", 8000, "POST", JSON.stringify({ query: q }));
  var media = (g && g.data && g.data.Page && g.data.Page.media) || [];
  if (!media.length) return JSON.stringify({ id: ids[0], ep: E, title: tm.title });
  media = media.filter(function (m) { return m.format !== "SPECIAL" || media.length === 1; })
    .sort(function (a, b) { return dateKey(a.startDate) - dateKey(b.startDate); });
  var left = E;
  for (var i = 0; i < media.length; i++) {
    var n = media[i].episodes;
    if (!n || left <= n || i === media.length - 1) {
      dbg("[anihype] S" + S + "E" + E + " -> " + media[i].id + " ep " + left + " (split season)");
      return JSON.stringify({ id: media[i].id, ep: left, title: tm.title });
    }
    left -= n;
  }
  return null;
}

export const getStreams = makeProvider({ id: "anihype", name: "AniHype", make, manifest, mode: "search", findEpisode: findEpisode });
