// Bingr for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";

export const getStreams = makeProvider({ id: "bingr", name: "Bingr", make, manifest, mode: "tmdb", direct: true });
