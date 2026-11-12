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
| **RiveStream** | Citadel, Prvibd, River, Kutti, HindiSk servers plus MhPly/AwsPly/VidPi/HDHub: Hindi, English, Tamil, Telugu, Urdu | ✅ | ✅ | ✅ | ✅ |
| **Vidbox** | Nxsha multi-language servers (TMDB ids, 1:1 matching): Hindi first, then English, Tamil, Telugu, Urdu | ✅ | ✅ | ✅ | ✅ |
| **HiStream** | HiStream player servers: Hindi first, Bollywood, Hindi series and platform originals | ✅ | ✅ | ✅ | ✅ |
| **ZXCStream** | Ad-free Main Server (vidstuck): Orion original audio + Hindi dub up to 1080p, Atlas, Daedalus, with subtitles | ✅ | ✅ | ✅ | ✅ |
| **MoviesHubHD** | VidNest player network (Delta, Zeta, Alfa, Beta, Catflix…): Hindi + English, multi-audio, up to 4K, subtitles | ✅ | ✅ | ✅ | ✅ |
| **KatMovieHD** | Hollywood & web series in Hindi dubbed / dual audio: StreamTape, HubCloud, GDFlix (searches the site by title) | ✅ | ✅ | ✅ | ✅ |
| **SSR Movies** | Hindi dubbed / dual audio movies (480p–4K): Watch HLS, HubCloud, GDFlix. Best for movies; complete-season packs often have no playable file | ✅ | ✅ | ✅ | ✅ |
| **DesiSerials** | Daily Hindi TV serials & reality shows (Star Plus, Zee, Sony, Colors, Sab, &TV). Episodes matched by TMDB air date. | — | ✅ | ✅ | ✅ |
| **DesiDubAnime** | Hindi / Tamil / Telugu dubbed anime (series + movies) with English subtitles. Plays the VidMoly mirror; the site's own P2P player is currently down, so some episodes have no link. | ✅ | ✅ | ✅ | ✅ |
| **Bingr** | Movies, TV & anime from bingr.one: Prism multi-audio (Hindi, Telugu, Tamil, English, French…) up to 1080p, Edge, Nimbus, Citadel (Hindi/Tamil/Telugu/Kannada dubs), with subtitles | ✅ | ✅ | ✅ | ✅ |
| **AniHype** | Anime from anihype.sbs: TryEmbed Sub + English Dub (1080p), Katana Sub (1080p), Uqload (Japanese + English audio), Orion (Japanese, English, Hindi, Tamil, Telugu, Malayalam, Kannada, French; HEVC), Mikaza Hindi Dub, with English subtitles. TMDB titles are mapped to the right AniList season / part | ✅ | ✅ | ✅ | ✅ |
| **RareAnimes** | Hindi, Tamil, Telugu and Malayalam dubbed anime, cartoons and animated movies from rareanimes.mov (Rare Toons India) - every audio language of an episode, direct HD files from StreamBeta | ✅ | ✅ | ✅ | ✅ |
| **SubDubAnime** | Hindi and English dubbed (and subbed) anime series and movies from subdubanime.site, up to 1080p - every language version of a title (Hindi Dubbed, Hindi Fan Dubbed, English Dubbed…) | ✅ | ✅ | ✅ | ✅ |

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
- `--curl <regex|all>`: send matching requests through curl. Some file hosts (GDFlix) reject Node's TLS
  fingerprint but accept curl's and OkHttp's (the apps), e.g. `--curl "kmhd|gdflix"`.

Author: **TJ-Plugins**
