// node tools/new-provider.mjs <id> <TJ-Plugins dir> <Name> <logo domain> <tmdb|search> [formats=m3u8,mp4] [description…]
// Add --nx anywhere for providers that use nxsha (shorter server list on NuvioTV).
// Copies a TJ-Plugins SkyStream plugin into src/<id>/ and writes nuvio.json + index.js (versions start at 1.0.0).
import fs from "node:fs";
import path from "node:path";

const NX = process.argv.includes("--nx");
const [id, srcDir, name, domain, mode = "tmdb", formats = "m3u8,mp4", ...desc] = process.argv.slice(2).filter((a) => a !== "--nx");
if (!id || !srcDir || !name || !domain) { console.error("usage: node tools/new-provider.mjs <id> <dir> <Name> <domain> <tmdb|search> [formats] [description]"); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(ROOT, "src", id);
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(srcDir, "plugin.js"), path.join(out, "plugin.skystream.js"));
fs.copyFileSync(path.join(srcDir, "plugin.json"), path.join(out, "skystream.json"));
const sk = JSON.parse(fs.readFileSync(path.join(srcDir, "plugin.json"), "utf8"));
const cats = (sk.categories || []).join(" ");
const types = [];
if (/Movie|Anime/i.test(cats) || !cats) types.push("movie");
if (/Tv|Series|Anime|Drama/i.test(cats) || !cats) types.push("tv");
const nuvio = {
  name,
  description: desc.length ? desc.join(" ") : String(sk.description || name).replace(/\s+/g, " ").slice(0, 300),
  version: "1.0.0",
  supportedTypes: types,
  formats: formats.split(","),
  logo: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  contentLanguage: sk.languages || ["en"],
};
if (!fs.existsSync(path.join(out, "nuvio.json"))) fs.writeFileSync(path.join(out, "nuvio.json"), JSON.stringify(nuvio, null, 2) + "\n");
fs.writeFileSync(path.join(out, "index.js"),
`// ${name} for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";
${NX ? 'import { nxHooks } from "../_lib/nxsha.js";\n' : ""}
export const getStreams = makeProvider({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)}, make, manifest, mode: ${JSON.stringify(mode)}${NX ? ", hooks: nxHooks" : ""} });
`);
console.log(`src/${id}/ ready (${mode}, ${types.join("+")})`);
