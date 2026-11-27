<p align="center">
  <b>🇬🇧 English</b> • <a href="README.ru.md">🇷🇺 Русский</a> • <a href="README.uk.md">🇺🇦 Українська</a>
</p>

# idealLED — Web Bluetooth Controller

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Web Bluetooth](https://img.shields.io/badge/Web_Bluetooth-BLE-0082FC?logo=bluetooth&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](#tech-stack)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-CDN-06B6D4?logo=tailwindcss&logoColor=white)](#tech-stack)
[![Docker](https://img.shields.io/badge/Docker-Nginx_1.27-2496ED?logo=docker&logoColor=white)](#docker-deployment--auto-deploy)

A browser-based Web Bluetooth Low Energy (BLE) controller for addressable and RGB LED strips powered by **idealLED (`ISP-*` / `IDL-*` / `IDEALLED`)** controllers — with no official mobile app required.

> **Why this project exists:** For many users, the official App Store / Google Play app fails to connect to LED strips, freezes while scanning, or drops the connection. This controller communicates directly over BLE using the reverse-engineered protocol documented by [8none1/idealLED](https://github.com/8none1/idealLED).

---

## Features

- **iPhone, Desktop & Android support** — runs on iPhone via the free **Bluefy** browser and on Windows/macOS/Linux/Android via **Google Chrome** or **Microsoft Edge**.
- **Automatic BLE protocol detection** — detects and supports:
  - `TYPE2` (`TURN`, `SGLS`, `MULT`, `DOOD`, `DOOT` + `DOOTCP` + `DTARTCY`, `LAMPN`, `VE`, `TIME`)
  - `TYPE1` (`LEDON`/`LEDOFF`, `COLO`, `LIGHT`, `EFF`)
  - `LEGACY` (`fff3` / `fff4`: `TURN`, `COLOR`, `MODE`, `LIGHT`, `SPEED`, `RGB`, `LEDNUM`)
  - Pure JS **AES-128-ECB** packet encryption/decryption (`js/aes.js`) with built-in self-test and live incoming notification (`9601` / `fff4`) decryption.
- **Color picker & power-regulator protection** — interactive HSV color wheel, RGB sliders & numeric inputs, HEX input, saved favorites in `localStorage` (up to 16 colors), dual gradient (`SGLS`), and 5-bit power-regulator protection (`>> 3`).
- **Live 60 FPS LED strip preview** — real-time HTML5 `<canvas>` diffuser simulation reflecting static colors, dual gradients, dynamic effects, speed, reverse direction, and graffiti pixels.
- **Built-in effects & custom palette** — 10 dynamic effects (`#01`–`#10`, clamped `0–11` for controller safety) + Static (`#0`), animation speed (`1–100%`), reverse direction toggle, custom palette editor (up to 7 colors), and 6 preset themes (Rainbow, Fire, Ocean, Cyberpunk, Sunset, Holiday).
- **Random Mode (Auto-DJ)** — automatic rotation of effects, palettes, or static colors on a configurable interval (presets `10s`, `30s`, `1m`, `5m`, `15m`, or custom `>= 3s` / minutes), customizable effect pool (strobe `#4` excluded by default), optional random speed/direction, and live countdown.
- **Daily Schedule, Sleep Timer & Wake Lock** — daily Auto-On (with restore, random, warm white, or rainbow action) and Auto-Off at specific clock times, Sleep Timer (`15` / `30` / `60` / `120` min), and Screen Wake Lock toggle.
- **Graffiti & Bulk Paint** — per-pixel LED painting (`DOOD` with Solid / Fade / Flash modes and live or batch mode) or whole-strip bulk upload (`DOOT` + RLE compression + `960a` chunks + `DOOTCP` + `DTARTCY`), flood fill, and rainbow fill.
- **Strip settings & BLE diagnostics** — configurable LED count (`1–1024`), RGB channel order (`RGB`, `RBG`, `GRB`, `GBR`, `BRG`, `BGR`), firmware version query (`VE`), controller clock sync (`TIME`), and a live TX/RX packet inspector showing RAW and AES-encrypted hex payloads.

---

## How to Use

### 1. Connecting from iPhone (iOS)
Apple disables Web Bluetooth in standard Safari, so iOS requires the **Bluefy** browser:
1. Install the free **Bluefy** browser from the App Store and grant Bluetooth permission on first launch.
2. Open your hosted URL in Bluefy (for example, `https://led.mriamys.site`).
3. Tap **Connect** (**«Подключить»** — or **All BLE** / **«Все BLE»** if the strip is not shown under the `ISP`/`IDL`/`IDEALLED` prefix filter) and select your `ISP-...` or `IDL-...` device.

### 2. Connecting from Desktop or Android
1. Open the web app in **Google Chrome** or **Microsoft Edge** (over HTTPS or `localhost`).
2. Enable Bluetooth and click **Connect** (**«Подключить»**).

### 3. Modes, Random DJ & Schedule
- **Color** — pick a static color on the HSV wheel or sliders, enable *Dual Gradient*, or save colors to *My Colors*.
- **Effects** — select effects `01–10`, adjust speed, reverse direction, and edit up to 7 palette colors.
- **Random & Timer**:
  - Enable **Random Mode**, set an interval (e.g., 30 seconds or 5 minutes), and choose what to alternate. Tap effect chips to include/exclude effects (such as strobe).
  - Under **Schedule**, enable *Auto-On* (e.g., `09:00`) and *Auto-Off* (e.g., `21:00`).
  - > **Important:** The LED controller hardware has no non-volatile alarm clock, so **Random Mode and Daily Schedules fire only while this page remains open and connected via Bluetooth** (ideal for an old phone/tablet or desktop tab with **Keep Screen Awake / Wake Lock** enabled).

---

## Add Shortcut to Phone Home Screen

### iPhone (iOS) — One-Tap Launch Directly in Bluefy
Because Safari home-screen bookmarks open inside Safari (which lacks Web Bluetooth), create an iOS **Shortcuts** bookmark that launches directly in **Bluefy**:

1. Make sure **Bluefy** is installed.
2. Open the built-in iOS **Shortcuts** app and tap **`+`** in the top-right corner.
3. Add the **URL** action and paste:
   ```text
   bluefy://open?url=https://led.mriamys.site
   ```
   *(replace the domain with your own if self-hosting)*.
4. Add the **Open URLs** action.
5. Tap the top title/arrow → **Add to Home Screen**, pick an icon/name (`idealLED`), and tap **Add**.

*(Tip: you can also open this guide and copy the deep link directly inside the web app via the **«📲 На экран»** button in the header.)*

### Android / Desktop (Chrome / Edge)
1. Open the site in Chrome or Edge.
2. Open **Menu (⋮)** → **Add to Home screen** (or **Install app**).

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (`js/aes.js`, `js/protocol.js`, `js/app.js`), HTML5 Canvas, Tailwind CSS (CDN), custom CSS (`css/styles.css`), PWA Manifest (`manifest.webmanifest`)
- **Cryptography & Protocol:** Pure JS AES-128-ECB (`FIPS-197`), Web Bluetooth API (`fff0` / `ffe0` / `ae00` services, `9600` / `960a` / `9601` & `fff3` / `fff4` characteristics)
- **Server & Deployment:** `nginx:1.27-alpine`, Docker Compose, GitHub Actions

---

## Docker Deployment & Auto-Deploy

```bash
docker compose up -d --build
```

- The container runs `nginx:1.27-alpine` and binds to `127.0.0.1:8088:80`.
- Because Web Bluetooth requires a **secure context (HTTPS)** on non-localhost origins, put a reverse proxy (e.g., system Nginx with TLS) in front of `http://127.0.0.1:8088`.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) automates SSH deployment on push to `main` using repository secrets `SSH_HOST`, `SSH_USER`, and `SSH_KEY`.

---

## Project Structure

```text
.
├── .github/workflows/deploy.yml   # GitHub Actions SSH auto-deploy
├── css/styles.css                 # Custom glassmorphism & slider styling
├── js/
│   ├── aes.js                     # Pure JS AES-128-ECB encryption/decryption + self-test
│   ├── protocol.js                # idealLED BLE packet builders (TYPE2, TYPE1, LEGACY)
│   └── app.js                     # Web Bluetooth queue, UI, canvas preview, DJ & scheduler
├── docker-compose.yml             # Nginx container bound to 127.0.0.1:8088
├── Dockerfile                     # nginx:1.27-alpine static image
├── icon.svg                       # App / PWA SVG icon
├── index.html                     # Single-page Web Bluetooth studio UI
├── LICENSE                        # Apache-2.0 License
├── manifest.webmanifest           # PWA manifest
├── nginx.conf                     # Nginx SPA & caching configuration
└── NOTICE                         # Attribution & protocol credit notice
```

---

## License & Attribution

Licensed under the **Apache License, Version 2.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

- Original Web Bluetooth Studio & UI: **mriamys** ([github.com/mriamys/ideal-led](https://github.com/mriamys/ideal-led))
- BLE protocol reverse-engineering & command reference: **8none1** ([8none1/idealLED](https://github.com/8none1/idealLED))

If you find this project useful or want to build your own improvements, feel free to **fork** the repository on GitHub and link back to [https://github.com/mriamys/ideal-led](https://github.com/mriamys/ideal-led)!
