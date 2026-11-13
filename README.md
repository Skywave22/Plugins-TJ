<div align="center">

# TJ-Plugins for Nuvio

**25 streaming providers for Nuvio — movies, series, anime and Asian dramas, on phone and TV.**

[![Providers](https://img.shields.io/badge/providers-25-6f42c1?style=flat-square)](#providers)
[![Phone + TV](https://img.shields.io/badge/Nuvio-phone_%26_TV-2ea44f?style=flat-square)](#compatibility)
[![SkyStream](https://img.shields.io/badge/also_for-SkyStream-f59e0b?style=flat-square)](https://github.com/Skywave22/TJ-Plugins)

[Install](#install) · [Providers](#providers) · [Compatibility](#compatibility) · [Development](#development)

</div>

---

## Install

**1.** Open **Nuvio** → **Settings** → **Plugins** *(called Providers or Scrapers in some versions)*

**2.** Paste this repository URL:

```txt
https://raw.githubusercontent.com/Skywave22/Plugins-TJ/main/manifest.json
```

**3.** Turn on the providers you want — links appear under the **Streams** tab of any movie or episode.

> **Updating:** refresh the repository in Settings. New versions arrive automatically, with no reinstall.

---

## Providers

Each provider is the matching [TJ-Plugins](https://github.com/Skywave22/TJ-Plugins) SkyStream plugin, converted to run natively inside Nuvio.

### 🎬 Movies & series

| Provider | What you get | Movies | Series |
|---|---|:-:|:-:|
| **Cinezo** | Hindi dubs and multi-audio up to 4K with subtitles (VidNest + ScreenScape servers) | ✅ | ✅ |
| **ScreenScape** | 30+ "Scape" servers per title: Hindi dubs (MhPly, AwsPly, Citadel), Nitro multi-audio, 4K-Hub | ✅ | ✅ |
| **CineHD** | Many servers: MhPly / AwsPly Hindi, Nitro multi-audio, HDHub, Rock HLS, VidAPI | ✅ | ✅ |
| **CineJoy** | Nitro multi-audio, MhPly / AwsPly / Citadel Hindi, StremFx, HDHub, VidAPI, MovieBox | ✅ | ✅ |
| **Bingr** | Movies, TV and anime from bingr.one: Prism multi-audio (Hindi, Telugu, Tamil, English, French…) up to 1080p, Edge, Nimbus, Citadel dubs, subtitles in up to 20 languages | ✅ | ✅ |
| **Nxsha** | The site's own rows and search, with its multi-server links (Nitro, Citadel, Prism, HubCloud, 4K-Hub, mahalala, CastVid…) in every audio track | ✅ | ✅ |
| **Zenix** | The site player's Orion links in every audio track offered — Original, Hindi, Tamil, Telugu, French, Spanish… up to 1080p | ✅ | ✅ |
| **RiveStream** | Citadel, Prvibd, River, Kutti and HindiSk servers plus MhPly / AwsPly / VidPi / HDHub: Hindi, English, Tamil, Telugu, Urdu | ✅ | ✅ |
| **Vidbox** | Nxsha multi-language servers, TMDB-matched 1:1: Hindi first, then English, Tamil, Telugu, Urdu | ✅ | ✅ |
| **HiStream** | HiStream player servers: Hindi first, Bollywood, Hindi series and platform originals | ✅ | ✅ |
| **MoviesHubHD** | VidNest player network (Delta, Zeta, Alfa, Beta, Catflix…): Hindi + English, multi-audio, up to 4K | ✅ | ✅ |
| **FMovies** | MoviesAPI multi-quality HLS with subtitles (limited catalogue — its VidLove backup is offline) | ✅ | ✅ |
| **ZXCStream** | Ad-free Main Server (vidstuck): Orion original audio + Hindi dub up to 1080p, Atlas, Daedalus, with subtitles | ✅ | ✅ |

### 🇮🇳 Hindi & Bollywood

| Provider | What you get | Movies | Series |
|---|---|:-:|:-:|
| **KatMovieHD** | Hollywood and web series in Hindi dubbed / dual audio — StreamTape, HubCloud, GDFlix | ✅ | ✅ |
| **SSR Movies** | Hindi dubbed / dual audio movies in 480p–4K — Watch HLS, HubCloud, GDFlix | ✅ | ✅ |
| **KMMovies** | Bollywood, Hollywood, South, Hindi dubbed and dual-audio movies from kmmovies.beer — direct files up to 1080p | ✅ | ❌ |
| **HiCine** | Hollywood, Bollywood, K-Drama and anime, dual audio Hindi, up to 1080p — FSL, PixelDrain and more | ✅ | ✅ |

### 🍥 Anime

| Provider | What you get | Movies | Series |
|---|---|:-:|:-:|
| **AniHype** | TryEmbed Sub + English Dub, Katana Sub (1080p), Uqload, Orion (8 languages, HEVC) and Mikaza Hindi Dub, with English subtitles | ✅ | ✅ |
| **DesiDubAnime** | Hindi / Tamil / Telugu dubbed anime with English subtitles — plays the VidMoly mirror | ✅ | ✅ |
| **PikaHD** | Anime in Hindi, English and Japanese (dual audio) — HubCloud, GDFlix and StreamTape up to 1080p | ✅ | ✅ |
| **RareAnimes** | Hindi, Tamil, Telugu and Malayalam dubbed anime, cartoons and animated movies — direct HD files | ✅ | ✅ |
| **SubDubAnime** | Hindi and English dubbed (and subbed) anime up to 1080p — every language version of a title | ✅ | ✅ |

### 🌸 Asian dramas

| Provider | What you get | Movies | Series |
|---|---|:-:|:-:|
| **KatDrama** | Korean and Chinese dramas and movies in Hindi, dual audio and English — HubCloud and StreamTape | ✅ | ✅ |
| **KDMaza** | Korean, Chinese and Turkish dramas, Korean movies and anime in Hindi / Urdu — HubCloud and GDFlix | ❌ | ✅ |

### 📺 OTT catalogues

| Provider | What you get | Movies | Series |
|---|---|:-:|:-:|
| **Net77** | Netflix, Prime Video and JioHotstar titles — one 1080p link per title with every audio language it has, plus subtitles. Takes about 40 s (NetMirror's own check) | ✅ | ✅ |

> **Best all-round start:** **Cinezo**, **ScreenScape** and **Nxsha** cover most popular titles with Hindi audio first. Add **AniHype** for anime and **KatDrama** for K-dramas.

---

## Compatibility

<a id="compatibility"></a>

| | Nuvio (phone / tablet) | Nuvio TV |
|---|:-:|:-:|
| **All providers except Net77** | ✅ | ✅ |
| **Net77** | ✅ | ❌ *(TV runtime has no session store for its check)* |

**On TV, providers are slower.** Nuvio TV runs a provider's requests one at a time, so a provider that takes 4–15 s on a phone takes about 18–33 s on TV (Cinezo, ScreenScape). To stay inside the app's 60 s limit:

- providers stop making new requests after **32 s**, so they always finish in time;
- Cinezo and ScreenScape ask only the **14 servers that actually return links** instead of all ~31.

---

## Good to know

- **Links are checked before they are shown.** Links that could not be checked are marked *(may not play)*.
- **Hindi and the best quality come first** in the stream list where a provider offers a choice.
- **A provider showing nothing** usually means the site moved or is down — refresh the repository for an update.
- **GDFlix / HubCloud** files play in Nuvio; desktop tools may meet a Cloudflare check instead.

---

<a id="development"></a>

## Development

<details>
<summary><b>Build, layout and the test runtime</b></summary>

<br>

```bash
npm install
node build.js [id…]       # src/<id>/ → providers/<id>.js and manifest.json (patch bump automatic)
```

Each provider lives in `src/<id>/`:

| File | Purpose |
|---|---|
| `plugin.skystream.js` | the TJ-Plugins SkyStream plugin, unchanged |
| `skystream.json` | its SkyStream manifest |
| `nuvio.json` | Nuvio manifest entry (name, description, version, types, formats, logo, languages) |
| `index.js` | Nuvio entry point (`makeProvider`, TMDB or search mode) |

`src/_lib/` provides the SkyStream API on top of Nuvio — `http_get` / `http_post`, crypto and timers (Nuvio TV has no `setTimeout` or `crypto.subtle`). It also resolves TMDB ids (including `tt…` IMDb ids), matches titles and converts results to Nuvio streams. `getStreams` never throws: on any failure it returns `[]`.

### Testing — the real Nuvio runtime in QuickJS

Extract the runtime once from local clones of [NuvioMobile](https://github.com/NuvioMedia/NuvioMobile) and [NuvioTV](https://github.com/NuvioMedia/NuvioTV):

```bash
node tools/extract-runtime.mjs <NuvioMobile>/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/js/JsBindings.kt \
                               <NuvioTV>/app/src/full/java/com/nuvio/tv/core/plugin/PluginRuntime.kt
```

Then:

```bash
node tools/test.mjs <id> <tmdbId|tt…> [movie|tv] [season] [episode] [--check] [--tv] [--debug]
node tools/test.mjs cinezo 27205 movie --check      # Inception, phone runtime, every link checked
```

</details>

---

<div align="center">
<sub>

Made by **TJ-Plugins** · Providers only link to media that third-party websites host publicly. Nothing is hosted in this repository.

</sub>
</div>
