// TMDB lookup: Nuvio only gives a TMDB id (or an IMDb tt id), the sites need title + year.
var FALLBACK_KEY = "439c478a771f35c05022f9feabcca01c";
var API = "https://api.themoviedb.org/3";

function apiKey() {
  try { if (typeof TMDB_API_KEY === "string" && TMDB_API_KEY.trim()) return TMDB_API_KEY.trim(); } catch (e) {}
  return FALLBACK_KEY;
}

async function getJson(path) {
  var keys = [apiKey()];
  if (keys[0] !== FALLBACK_KEY) keys.push(FALLBACK_KEY);   // a user key that stopped working must not break every provider
  for (var i = 0; i < keys.length; i++) {
    try {
      var r = await fetch(API + path + (path.indexOf("?") >= 0 ? "&" : "?") + "api_key=" + keys[i], { headers: { Accept: "application/json" } });
      if (r.ok) { var j = await r.json(); if (j) return j; }
    } catch (e) {}
  }
  return null;
}

function latin(s) { return /^[\x00-\x7f\u00c0-\u024f\u2018-\u201f\s]+$/.test(String(s || "")); }

// → { id, type: "movie"|"tv", title, original, year, imdb, alts: [...], runtime } or null
export async function tmdbInfo(rawId, mediaType) {
  var type = /^(tv|series|show)$/i.test(String(mediaType || "")) ? "tv" : "movie";
  var id = String(rawId || "").trim().replace(/^tmdb[:/]/, "");
  if (/^tt\d+/.test(id)) {
    var f = await getJson("/find/" + id.match(/^tt\d+/)[0] + "?external_source=imdb_id");
    var hit = f && ((type === "tv" ? f.tv_results : f.movie_results) || [])[0];
    if (!hit && f) { hit = (f.movie_results || [])[0] || (f.tv_results || [])[0]; if (hit) type = f.movie_results && f.movie_results[0] ? "movie" : "tv"; }
    if (!hit) return null;
    id = String(hit.id);
  }
  id = id.replace(/\D.*$/, "");
  if (!id) return null;
  var d = await getJson("/" + type + "/" + id + "?append_to_response=external_ids,alternative_titles");
  if (!d || !d.id) return null;
  var title = type === "tv" ? d.name : d.title;
  var original = type === "tv" ? d.original_name : d.original_title;
  var date = (type === "tv" ? d.first_air_date : d.release_date) || "";
  var altList = ((d.alternative_titles || {}).titles || (d.alternative_titles || {}).results || [])
    .filter(function (a) { return /^(US|GB|IN|PK)$/.test(a.iso_3166_1) && latin(a.title); })
    .map(function (a) { return a.title; });
  var alts = [];
  [original].concat(altList).forEach(function (t) {
    if (t && latin(t) && t !== title && alts.indexOf(t) < 0) alts.push(t);
  });
  return {
    id: d.id, type: type, title: title || original || "", original: original || "", year: +date.slice(0, 4) || 0,
    imdb: d.imdb_id || (d.external_ids || {}).imdb_id || "", alts: alts.slice(0, 3),
    runtime: d.runtime || ((d.episode_run_time || [])[0]) || 0, seasons: d.number_of_seasons || 0,
  };
}
