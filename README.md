# TJ-Plugins for Nuvio

Streaming providers for the **Nuvio** app (phone and TV): Hindi, dubbed, Bollywood and world movies & series.
They are the TJ-Plugins (SkyStream) plugins, converted to run as Nuvio providers.

## Install

1. Open **Nuvio → Settings → Plugins** (called *Providers* / *Scrapers* in some versions).
2. Add this repository URL:

   ```
   https://raw.githubusercontent.com/Skywave22/Plugins-TJ/main/manifest.json
   ```

3. Turn on the providers you want. Updates arrive automatically when you refresh the repository.

## Providers

| Provider | Content | Movies | Series | Nuvio (phone) | NuvioTV |
|---|---|:-:|:-:|:-:|:-:|
| **Cinezo** | Hindi dubs, multi-audio, English up to 4K, with subtitles (VidNest + ScreenScape servers) | ✅ | ✅ | ✅ | ✅ |
| **ScreenScape** | 30+ "Scape" servers per title: Hindi dubs (MhPly, AwsPly, Citadel), Nitro multi-audio, 4K-Hub | ✅ | ✅ | ✅ | ✅ |
| **CineHD** | TMDB catalog with many servers: MhPly/AwsPly Hindi, Nitro multi-audio, HDHub, Rock HLS, VidAPI | ✅ | ✅ | ✅ | ✅ |
| **CineJoy** | TMDB catalog with Nitro multi-audio, MhPly/AwsPly/Citadel Hindi, StremFx, HDHub, VidAPI, MovieBox | ✅ | ✅ | ✅ | ✅ |
| **FMovies** | MoviesAPI multi-quality HLS with subtitles (limited catalog: its VidLove backup is offline) | ✅ | ✅ | ✅ | ✅ |

More providers are being added one at a time.

### Notes
- Links are checked before they are shown. Links that could not be checked are marked *(may not play)*.
- **NuvioTV** runs a provider's requests one at a time, so providers are slower there than on a phone
  (Cinezo / ScreenScape: about 4–15 s on a phone, about 18–33 s on TV). On TV:
  - providers stop making new requests after 32 s, so they always finish before the app's 60 s limit;
  - Cinezo and ScreenScape ask only the 14 servers that actually return links, instead of all ~31.

## Development

```
npm install
node build.js [id…]       # src/<id>/ → providers/<id>.js and manifest.json (patch version bumps automatically)
```

Each provider lives in `src/<id>/`:

| File | Purpose |
|---|---|
| `plugin.skystream.js` | the TJ-Plugins SkyStream plugin, unchanged |
| `skystream.json` | its SkyStream manifest |
| `nuvio.json` | Nuvio manifest entry (name, description, version, types, formats, logo, languages) |
| `index.js` | Nuvio entry point (`makeProvider`, TMDB or search mode) |

`src/_lib/` provides the SkyStream API on top of Nuvio: `http_get`/`http_post`, crypto and timers (NuvioTV has no
`setTimeout` or `crypto.subtle`). It also resolves TMDB ids (including `tt…` IMDb ids), matches titles and
converts results to Nuvio streams. `getStreams` never throws; on any failure it returns `[]`.

### Testing (runs the real Nuvio JavaScript runtime in QuickJS)

The test tool uses the JavaScript runtime code from the Nuvio apps. Extract it once from local clones
of [NuvioMobile](https://github.com/NuvioMedia/NuvioMobile) and [NuvioTV](https://github.com/NuvioMedia/NuvioTV):

```
node tools/extract-runtime.mjs <NuvioMobile>/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/js/JsBindings.kt \
                               <NuvioTV>/app/src/full/java/com/nuvio/tv/core/plugin/PluginRuntime.kt
```

Then:

```
node tools/test.mjs <id> <tmdbId|tt…> [movie|tv] [season] [episode] [--check] [--tv] [--debug] [--http] [--log]
node tools/test.mjs cinezo 27205 movie --check          # Inception, phone runtime, check every link
node tools/test.mjs cinezo 1396 tv 1 1 --check --tv     # Breaking Bad S01E01, NuvioTV runtime
```

Options:
- `--check`: test that every returned link plays.
- `--tv`: use the NuvioTV runtime (blocking fetch, no timers, CryptoJS).
- `--debug`: show the provider's internal steps.
- `--http`: list every request.

Author: **TJ-Plugins**
