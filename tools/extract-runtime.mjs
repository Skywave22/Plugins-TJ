#!/usr/bin/env node
// Extracts the plugin JS runtime (polyfills + getStreams call wrapper) verbatim from the Nuvio app
// source (NuvioMedia/NuvioMobile, JsBindings.kt) and the Android TV app (NuvioMedia/NuvioTV,
// core/plugin/PluginRuntime.kt), so tools/test.mjs runs providers in the same environment as the apps.
// Usage: node tools/extract-runtime.mjs <path/to/JsBindings.kt> [<path/to/NuvioTV PluginRuntime.kt>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const kt = fs.readFileSync(process.argv[2], "utf8");
const blocks = {};
const re = /(?:val|fun)\s+(\w+)(?:\(\))?\s*(?::\s*String)?\s*=\s*"""([\s\S]*?)"""\.trimIndent\(\)/g;
let m;
while ((m = re.exec(kt))) blocks[m[1]] = m[2];
const expand = (s) => s.replace(/\$\{'\$'\}/g, "$").replace(/\$\{(\w+)\(\)\}/g, (_, n) => {
  if (!(n in blocks)) throw new Error("missing block " + n);
  return expand(blocks[n]);
});
const left = (s) => { const t = s.match(/\$\{?[A-Za-z_]/g); return t ? t.length : 0; };
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "runtime");
const head = "// Extracted verbatim from NuvioMedia/NuvioMobile composeApp/.../plugins/runtime/js/JsBindings.kt (GPL-3.0) for local testing only.\n";
for (const [name, file] of [["staticPolyfillCode", "polyfill.js"], ["staticCallCode", "call.js"]]) {
  const code = expand(blocks[name]);
  fs.writeFileSync(path.join(out, file), head + code + "\n");
  console.log(file, code.length, "chars; unexpanded templates:", left(code));
}
console.log("blocks:", Object.keys(blocks).join(", "));
if (process.argv[3]) {
  const tv = fs.readFileSync(process.argv[3], "utf8");
  const body = (fn) => {
    const i = tv.indexOf("private fun " + fn + "(): String");
    const a = tv.indexOf('"""', i) + 3, b = tv.indexOf('"""', a);
    const lines = tv.slice(a, b).split("\n");
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(ind)).join("\n").trim();
  };
  const tvHead = "// Extracted verbatim from NuvioMedia/NuvioTV app/src/full/.../core/plugin/PluginRuntime.kt (GPL-3.0) for local testing only.\n";
  for (const [fn, file] of [["getStaticPolyfillCode", "tv-polyfill.js"], ["getStaticCallCode", "tv-call.js"]]) {
    const code = body(fn);
    fs.writeFileSync(path.join(out, file), tvHead + code + "\n");
    console.log(file, code.length, "chars; templates:", left(code));
  }
}
