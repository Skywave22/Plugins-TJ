// URL helpers for TMDB-based plugins that use site-style URLs instead of JSON.
export function slugify(t) {
  return String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
