/**
 * idealLED BLE Protocol Builder (8none1/idealLED TYPE1 + TYPE2 + Legacy fallback).
 * Supports: Power, 5-bit/8-bit RGB + Dual Gradient, Multi-Color Effects (MULT + 960a),
 * Graffiti Per-Pixel Paint (DOOD), Bulk Collection Paint (DOOT / DOOTCP / DTARTCY),
 * Lamp Count (LAMPN), Firmware Version (VE), Time Sync (TIME), and Legacy fff3 commands.
 */
(function (global) {
  'use strict';

  const UUIDS = {
    SERVICE_PRIMARY: '0000fff0-0000-1000-8000-00805f9b34fb',
    SERVICE_FALLBACK: '0000ffe0-0000-1000-8000-00805f9b34fb',
    SERVICE_AE00: '0000ae00-0000-1000-8000-00805f9b34fb',
    WRITE_CMD: 'd44bc439-abfd-45a2-b575-925416129600',
    WRITE_DATA: 'd44bc439-abfd-45a2-b575-92541612960a',
    NOTIFY: 'd44bc439-abfd-45a2-b575-925416129601',
    LEGACY_WRITE: '0000fff3-0000-1000-8000-00805f9b34fb',
    LEGACY_NOTIFY: '0000fff4-0000-1000-8000-00805f9b34fb',
    DESCRIPTOR_FW: '00002901-0000-1000-8000-00805f9b34fb'
  };

  const TYPE1_MODELS = ['R002-15', 'R003-01', 'R004-01', 'R005-03'];
  const TYPE2_MODELS = ['R011-04', 'R012-01'];
  const FIRMWARE_OVERRIDE = {
    'TR2503R004-01': 'TYPE2'
  };

  function detectCommandType(fwString) {
    if (!fwString || typeof fwString !== 'string') return 'TYPE2';
    const clean = fwString.replace(/\0/g, '').trim();
    for (const [prefix, type] of Object.entries(FIRMWARE_OVERRIDE)) {
      if (clean.startsWith(prefix)) return type;
    }
    const firstR = clean.indexOf('R');
    const secondR = firstR !== -1 ? clean.indexOf('R', firstR + 1) : -1;
    const model = secondR !== -1 ? clean.slice(secondR) : clean;
    if (TYPE1_MODELS.includes(model)) return 'TYPE1';
    if (TYPE2_MODELS.includes(model)) return 'TYPE2';
    return 'TYPE2';
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  }

  function scaleChannel(val8, brightnessPct, fiveBitSafe) {
    const scaled = Math.round((clamp(val8, 0, 255) * clamp(brightnessPct, 0, 100)) / 100);
    return fiveBitSafe ? (scaled >> 3) : scaled;
  }

  /**
   * Build encrypted command packet(s) + optional unencrypted colour data packet(s).
   * Returns array of steps: { target: 'cmd' | 'data', label, desc, raw: Uint8Array, encrypt: boolean }
   */
  const Commands = {
    power(on, protocolType = 'TYPE2') {
      const buf = new Uint8Array(16);
      if (protocolType === 'TYPE1') {
        if (on) {
          buf.set([0x06, 0x4C, 0x45, 0x44, 0x4F, 0x4E]); // LEDON
        } else {
          buf.set([0x06, 0x4C, 0x45, 0x44, 0x4F, 0x46, 0x46]); // LEDOFF
        }
        return [{ target: 'cmd', label: on ? 'LEDON' : 'LEDOFF', desc: on ? 'ВКЛ (TYPE1)' : 'ВЫКЛ (TYPE1)', raw: buf, encrypt: true }];
      }
      if (protocolType === 'LEGACY') {
        buf.set([0x06, 0x54, 0x55, 0x52, 0x4E, 0x01, on ? 0x01 : 0x00]);
        return [{ target: 'cmd', label: 'TURN', desc: on ? 'ВКЛ (Legacy)' : 'ВЫКЛ (Legacy)', raw: buf, encrypt: true }];
      }
      // TYPE2 (8none1/idealLED default)
      buf.set([0x05, 0x54, 0x55, 0x52, 0x4E, on ? 0x01 : 0x00]);
      return [{ target: 'cmd', label: 'TURN', desc: on ? 'ВКЛ (01)' : 'ВЫКЛ (00)', raw: buf, encrypt: true }];
    },

    color(r, g, b, options = {}) {
      const {
        protocolType = 'TYPE2',
        brightness = 100,
        fiveBitSafe = true,
        r2 = r,
        g2 = g,
        b2 = b
      } = options;

      const buf = new Uint8Array(16);

      if (protocolType === 'LEGACY') {
        const sr = scaleChannel(r, brightness, false);
        const sg = scaleChannel(g, brightness, false);
        const sb = scaleChannel(b, brightness, false);
        buf.set([0x08, 0x43, 0x4F, 0x4C, 0x4F, 0x52, 0x01, sr, sg, sb]);
        return [{ target: 'cmd', label: 'COLOR', desc: `RGB(${sr},${sg},${sb})`, raw: buf, encrypt: true }];
      }

      const sr1 = scaleChannel(r, brightness, fiveBitSafe);
      const sg1 = scaleChannel(g, brightness, fiveBitSafe);
      const sb1 = scaleChannel(b, brightness, fiveBitSafe);

      if (protocolType === 'TYPE1') {
        // Note TYPE1 order in const.py: offset 5=G, 6=R, 7=B
        buf.set([0x07, 0x43, 0x4F, 0x4C, 0x4F, sg1, sr1, sb1]);
        return [{ target: 'cmd', label: 'COLO', desc: `5bit G:${sg1} R:${sr1} B:${sb1}`, raw: buf, encrypt: true }];
      }

      // TYPE2 SGLS: 0F 53 47 4C 53 00 00 64 50 [r1] [g1] [b1] [r2] [g2] [b2] 32
      const sr2 = scaleChannel(r2, brightness, fiveBitSafe);
      const sg2 = scaleChannel(g2, brightness, fiveBitSafe);
      const sb2 = scaleChannel(b2, brightness, fiveBitSafe);
      buf.set([0x0F, 0x53, 0x47, 0x4C, 0x53, 0x00, 0x00, 0x64, 0x50, sr1, sg1, sb1, sr2, sg2, sb2, 0x32]);
      return [{
        target: 'cmd',
        label: 'SGLS',
        desc: `${fiveBitSafe ? '5-bit' : '8-bit'} (${sr1},${sg1},${sb1})`,
        raw: buf,
        encrypt: true
      }];
    },

    effect(effectId, options = {}) {
      const {
        protocolType = 'TYPE2',
        reverse = false,
        speed = 50,
        brightness = 100,
        palette = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }]
      } = options;

      // Safety clamp from 8none1/idealLED: > 11 on TYPE2 can damage controller
      const safeId = clamp(effectId, 0, 11);
      const spd = clamp(speed, 1, 100);
      const bri = clamp(brightness, 0, 100);

      if (protocolType === 'LEGACY') {
        const buf = new Uint8Array(16);
        buf.set([0x05, 0x4D, 0x4F, 0x44, 0x45, clamp(effectId, 1, 255)]);
        return [{ target: 'cmd', label: 'MODE', desc: `#${effectId}`, raw: buf, encrypt: true }];
      }

      if (protocolType === 'TYPE1') {
        const lightBuf = new Uint8Array(16);
        lightBuf.set([0x06, 0x4C, 0x49, 0x47, 0x48, 0x54, safeId]);
        const p1 = new Uint8Array([0x0E, 0x45, 0x46, 0x46, safeId, 0x07, 0x03, 0xFF, 0x00, 0x00, 0xFF, 0x80, 0x00, 0xFF, 0xFF, 0x00]);
        const p2 = new Uint8Array([0x0E, 0x45, 0x46, 0x46, safeId, 0x07, 0x13, 0x00, 0xFF, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0xFF]);
        const p3 = new Uint8Array([0x0E, 0x45, 0x46, 0x46, safeId, 0x07, 0x21, 0x80, 0x00, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        return [
          { target: 'cmd', label: 'LIGHT', desc: `Effect #${safeId} (TYPE1)`, raw: lightBuf, encrypt: true },
          { target: 'cmd', label: 'EFF-1', desc: `Palette part 1`, raw: p1, encrypt: true },
          { target: 'cmd', label: 'EFF-2', desc: `Palette part 2`, raw: p2, encrypt: true },
          { target: 'cmd', label: 'EFF-3', desc: `Palette part 3`, raw: p3, encrypt: true }
        ];
      }

      // TYPE2: MULT + unencrypted palette on 960a
      const colors = (palette && palette.length > 0 ? palette : [{ r: 255, g: 0, b: 0 }]).slice(0, 7);
      const multBuf = new Uint8Array(16);
      multBuf.set([
        0x0A, 0x4D, 0x55, 0x4C, 0x54,
        safeId,
        reverse ? 0x01 : 0x00,
        0x64,
        spd,
        colors.length,
        bri
      ]);

      const dataBuf = new Uint8Array(2 + colors.length * 3);
      dataBuf[0] = colors.length * 3;
      dataBuf[1] = 0x00;
      colors.forEach((c, idx) => {
        const off = 2 + idx * 3;
        dataBuf[off]     = Math.round((clamp(c.r, 0, 255) * bri) / 100);
        dataBuf[off + 1] = Math.round((clamp(c.g, 0, 255) * bri) / 100);
        dataBuf[off + 2] = Math.round((clamp(c.b, 0, 255) * bri) / 100);
      });

      return [
        { target: 'cmd', label: 'MULT', desc: `Effect #${safeId} spd=${spd}% bri=${bri}% rev=${reverse ? 1 : 0}`, raw: multBuf, encrypt: true },
        { target: 'data', label: 'PALETTE', desc: `${colors.length} цветов → 960a`, raw: dataBuf, encrypt: false }
      ];
    },

    graffitiPixel(ledIndex, r, g, b, options = {}) {
      const {
        isSingle = true,
        mode = 2, // 0=flash, 1=fade, 2=solid
        speed = 50,
        brightness = 100
      } = options;

      const idx = clamp(ledIndex, 0, 1024);
      const buf = new Uint8Array(16);
      buf.set([
        0x0D, 0x44, 0x4F, 0x4F, 0x44,
        isSingle ? 0x01 : 0x00,
        (idx >> 8) & 0xFF,
        idx & 0xFF,
        clamp(mode, 0, 2),
        clamp(speed, 0, 100),
        clamp(r, 0, 255),
        clamp(g, 0, 255),
        clamp(b, 0, 255),
        clamp(brightness, 0, 100),
        0x00,
        0x00
      ]);

      const modeNames = { 0: 'Flash', 1: 'Fade', 2: 'Solid' };
      return [{
        target: 'cmd',
        label: 'DOOD',
        desc: isSingle ? `LED #${idx} ${modeNames[clamp(mode, 0, 2)]}` : `Flood (${r},${g},${b})`,
        raw: buf,
        encrypt: true
      }];
    },

    /**
     * Bulk Paint Collection (DOOT -> 960a chunks -> DOOTCP -> DTARTCY)
     * Uses RLE grouping for adjacent identical pixels + 5-bit safe scaling.
     */
    bulkPaint(pixels, options = {}) {
      const { fiveBitSafe = true, brightness = 100 } = options;
      if (!Array.isArray(pixels) || pixels.length === 0) return [];

      // RLE compress adjacent identical pixels
      const runs = [];
      for (const px of pixels) {
        const r = scaleChannel(px.r, brightness, fiveBitSafe);
        const g = scaleChannel(px.g, brightness, fiveBitSafe);
        const b = scaleChannel(px.b, brightness, fiveBitSafe);
        const mode = clamp(px.mode ?? 2, 0, 2);
        const speed = clamp(px.speed ?? 50, 1, 100);
        const prev = runs[runs.length - 1];
        if (prev && prev.r === r && prev.g === g && prev.b === b && prev.mode === mode && prev.speed === speed && prev.count < 250) {
          prev.count++;
        } else {
          runs.push({ count: 1, r, g, b, mode, speed });
        }
      }

      // Max 10 runs per BLE packet (~72 bytes) for safe CoreBluetooth/Bluefy MTU
      const CHUNK_SIZE = 10;
      const chunks = [];
      for (let i = 0; i < runs.length; i += CHUNK_SIZE) {
        chunks.push(runs.slice(i, i + CHUNK_SIZE));
      }

      const steps = [];
      const doot = new Uint8Array(16);
      doot.set([0x04, 0x44, 0x4F, 0x4F, 0x54, chunks.length & 0xFF]);
      steps.push({ target: 'cmd', label: 'DOOT', desc: `Start bulk (${chunks.length} pkts, ${runs.length} runs)`, raw: doot, encrypt: true });

      chunks.forEach((chunk, seq) => {
        const buf = new Uint8Array(2 + chunk.length * 7);
        buf[0] = (buf.length - 1) & 0xFF;
        buf[1] = seq & 0xFF;
        chunk.forEach((run, j) => {
          const off = 2 + j * 7;
          buf[off]     = 0x00;
          buf[off + 1] = run.count;
          buf[off + 2] = run.r;
          buf[off + 3] = run.g;
          buf[off + 4] = run.b;
          buf[off + 5] = run.mode;
          buf[off + 6] = run.speed;
        });
        steps.push({ target: 'data', label: `BULK #${seq}`, desc: `${chunk.length} runs → 960a`, raw: buf, encrypt: false });
      });

      const dootcp = new Uint8Array(16);
      dootcp.set([0x06, 0x44, 0x4F, 0x4F, 0x54, 0x43, 0x50]);
      steps.push({ target: 'cmd', label: 'DOOTCP', desc: 'Commit bulk', raw: dootcp, encrypt: true });

      const dtartcy = new Uint8Array(16);
      dtartcy.set([0x08, 0x44, 0x54, 0x41, 0x52, 0x54, 0x43, 0x59, 0x01]);
      steps.push({ target: 'cmd', label: 'DTARTCY', desc: 'Apply collection', raw: dtartcy, encrypt: true });

      return steps;
    },

    lampCount(count, protocolType = 'TYPE2') {
      const val = clamp(count, 1, 1024);
      const hi = (val >> 8) & 0xFF;
      const lo = val & 0xFF;
      const buf = new Uint8Array(16);
      if (protocolType === 'LEGACY') {
        buf.set([0x08, 0x4C, 0x45, 0x44, 0x4E, 0x55, 0x4D, hi, lo]);
        return [{ target: 'cmd', label: 'LEDNUM', desc: `${val} LED`, raw: buf, encrypt: true }];
      }
      buf.set([0x09, 0x4C, 0x41, 0x4D, 0x50, 0x4E, hi, lo, hi, lo]);
      return [{ target: 'cmd', label: 'LAMPN', desc: `${val} LED`, raw: buf, encrypt: true }];
    },

    getVersion() {
      const pcb = new Uint8Array(16);
      pcb.set([0x03, 0x56, 0x45, 0x00]);
      const fw = new Uint8Array(16);
      fw.set([0x03, 0x56, 0x45, 0x01]);
      return [
        { target: 'cmd', label: 'VE (PCB)', desc: 'Запрос версии PCB', raw: pcb, encrypt: true },
        { target: 'cmd', label: 'VE (FW)', desc: 'Запрос версии прошивки', raw: fw, encrypt: true }
      ];
    },

    syncTime(date = new Date()) {
      const buf = new Uint8Array(16);
      // 15 54 49 4D 45 [dayOfWeek 1..7] [hour] [min] [sec] ...
      const dow = date.getDay() === 0 ? 7 : date.getDay();
      buf.set([
        0x15, 0x54, 0x49, 0x4D, 0x45,
        dow,
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        0xA5, 0x5A, 0xA5, 0x01, 0x02, 0x06, 0x09
      ]);
      return [{
        target: 'cmd',
        label: 'TIME',
        desc: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`,
        raw: buf,
        encrypt: true
      }];
    },

    legacyBrightness(brightness) {
      const val = clamp(brightness, 0, 100);
      const buf = new Uint8Array(16);
      buf.set([0x06, 0x4C, 0x49, 0x47, 0x48, 0x54, val]);
      return [{ target: 'cmd', label: 'LIGHT', desc: `${val}%`, raw: buf, encrypt: true }];
    },

    legacySpeed(speed) {
      const val = clamp(speed, 0, 100);
      const buf = new Uint8Array(16);
      buf.set([0x06, 0x53, 0x50, 0x45, 0x45, 0x44, val]);
      return [{ target: 'cmd', label: 'SPEED', desc: `${val}%`, raw: buf, encrypt: true }];
    },

    legacyRgbOrder(orderId) {
      const val = clamp(orderId, 1, 6);
      const buf = new Uint8Array(16);
      buf.set([0x04, 0x52, 0x47, 0x42, val]);
      return [{ target: 'cmd', label: 'RGB', desc: `Order #${val}`, raw: buf, encrypt: true }];
    }
  };

  global.IdealProtocol = {
    UUIDS,
    detectCommandType,
    Commands
  };
})(typeof window !== 'undefined' ? window : globalThis);
