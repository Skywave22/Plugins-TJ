// HiStream for Nuvio — converted from the TJ-Plugins SkyStream plugin (plugin.skystream.js, embedded as-is).
import make from "./plugin.skystream.js";
import manifest from "./skystream.json";
import { makeProvider } from "../_lib/adapter.js";
import { nxHooks } from "../_lib/nxsha.js";

export const getStreams = makeProvider({ id: "histream", name: "HiStream", make, manifest, mode: "tmdb", hooks: nxHooks });
