/**
 * idealLED BLE Studio — Modern UI, Web Bluetooth (Bluefy iOS + Chrome),
 * Auto-Random Effect/Color DJ, Daily On/Off Scheduler, Sleep Timer, WakeLock & Graffiti.
 */
(function () {
  'use strict';

  const { UUIDS, detectCommandType, Commands } = window.IdealProtocol;
  const { encrypt, decrypt, bytesToHex, bytesToAscii, selfTest } = window.IdealAes;

  const STORAGE_FAVORITES_KEY = 'idealled_favorite_colors_v3';
  const STORAGE_AUTOMATION_KEY = 'idealled_automation_v1';

  const COLOR_PRESETS = [
    { name: 'Тёплый',    hex: '#FFD28A', r: 255, g: 210, b: 138 },
    { name: 'Холодный',  hex: '#F4F8FF', r: 244, g: 248, b: 255 },
    { name: 'Красный',   hex: '#FF1E1E', r: 255, g: 30,  b: 30  },
    { name: 'Оранжевый', hex: '#FF6B00', r: 255, g: 107, b: 0   },
    { name: 'Жёлтый',    hex: '#FFD600', r: 255, g: 214, b: 0   },
    { name: 'Зелёный',   hex: '#00E65B', r: 0,   g: 230, b: 91  },
    { name: 'Бирюзовый', hex: '#00D4FF', r: 0,   g: 212, b: 255 },
    { name: 'Синий',     hex: '#1E5BFF', r: 30,  g: 91,  b: 255 },
    { name: 'Фиолет.',   hex: '#9D00FF', r: 157, g: 0,   b: 255 },
    { name: 'Розовый',   hex: '#FF1E8A', r: 255, g: 30,  b: 138 }
  ];

  const BUILTIN_EFFECTS = [
    { id: 0,  name: 'Статичный', desc: 'Ровное свечение',     bar: 'bg-sky-400' },
    { id: 1,  name: 'Эффект 01', desc: 'Плавный спектр',      bar: 'effect-bar-rainbow' },
    { id: 2,  name: 'Эффект 02', desc: 'Бегущая волна',       bar: 'effect-bar-ocean' },
    { id: 3,  name: 'Эффект 03', desc: 'Цветовой поток',      bar: 'effect-bar-cyber' },
    { id: 4,  name: 'Эффект 04', desc: 'Динамичный строб',    bar: 'effect-bar-fire' },
    { id: 5,  name: 'Эффект 05', desc: 'Мягкое дыхание',      bar: 'effect-bar-pulse' },
    { id: 6,  name: 'Эффект 06', desc: 'Падающая комета',     bar: 'effect-bar-ocean' },
    { id: 7,  name: 'Эффект 07', desc: 'Секционный бег',      bar: 'effect-bar-rainbow' },
    { id: 8,  name: 'Эффект 08', desc: 'Искры и вспышки',     bar: 'effect-bar-cyber' },
    { id: 9,  name: 'Эффект 09', desc: 'Градиентный перелив', bar: 'effect-bar-fire' },
    { id: 10, name: 'Эффект 10', desc: 'Смешанный цикл',      bar: 'effect-bar-rainbow' }
  ];

  const PALETTE_PRESETS = {
    rainbow: [
      { r: 255, g: 0, b: 0 }, { r: 255, g: 127, b: 0 }, { r: 255, g: 255, b: 0 },
      { r: 0, g: 255, b: 0 }, { r: 0, g: 212, b: 255 }, { r: 30, g: 91, b: 255 },
      { r: 160, g: 0, b: 255 }
    ],
    fire: [
      { r: 255, g: 0, b: 0 }, { r: 255, g: 60, b: 0 }, { r: 255, g: 140, b: 0 },
      { r: 255, g: 210, b: 40 }, { r: 255, g: 40, b: 0 }
    ],
    ocean: [
      { r: 0, g: 255, b: 200 }, { r: 0, g: 180, b: 255 }, { r: 0, g: 80, b: 255 },
      { r: 60, g: 0, b: 220 }, { r: 0, g: 220, b: 255 }
    ],
    cyberpunk: [
      { r: 255, g: 0, b: 140 }, { r: 0, g: 240, b: 255 }, { r: 140, g: 0, b: 255 },
      { r: 255, g: 40, b: 90 }
    ],
    sunset: [
      { r: 255, g: 50, b: 80 }, { r: 255, g: 120, b: 30 }, { r: 255, g: 200, b: 60 },
      { r: 180, g: 40, b: 140 }
    ],
    xmas: [
      { r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 255, g: 200, b: 40 },
      { r: 255, g: 255, b: 255 }
    ]
  };

  const RGB_ORDERS = { 1: 'RGB', 2: 'RBG', 3: 'GRB', 4: 'GBR', 5: 'BRG', 6: 'BGR' };

  const state = {
    isConnected: false,
    deviceName: '',
    bleDevice: null,
    cmdChar: null,
    dataChar: null,
    notifyChar: null,
    preferredWriteMode: {},

    protocolMode: 'AUTO',
    detectedType: 'TYPE2',
    firmwareVersion: '',

    isOn: true,
    r: 0, g: 212, b: 255,
    h: 190, s: 1.0, v: 1.0,
    useDualColor: false,
    r2: 157, g2: 0, b2: 255,
    fiveBitSafe: true,

    brightness: 80,
    speed: 50,
    reverse: false,
    modeId: 0,
    effectPalette: PALETTE_PRESETS.rainbow.map(c => ({ ...c })),

    ledCount: 60,
    rgbOrder: 1,

    graffitiMode: 2,
    graffitiSpeed: 60,
    graffitiLiveSend: true,
    pixels: [],

    // Random & Schedule state
    randomEnabled: false,
    randomIntervalSec: 30,
    randomKind: 'effects_palette', // effects_palette | effects_only | colors | mix
    randomSpeedReverse: true,
    randomEffectPool: [1, 2, 3, 5, 6, 7, 8, 9, 10], // Exclude strobe (#4) by default, user can toggle any
    randomNextSwitchAt: 0,

    schedOnEnabled: false,
    schedOnTime: '09:00',
    schedOnAction: 'restore',
    schedOffEnabled: false,
    schedOffTime: '21:00',
    lastTriggeredOnMinute: '',
    lastTriggeredOffMinute: '',

    sleepOffAt: 0,
    wakeLock: null,

    favorites: [],
    packetLogs: []
  };

  function activeProtocol() {
    return state.protocolMode === 'AUTO' ? state.detectedType : state.protocolMode;
  }

  function initPixelsArray(count) {
    const prev = state.pixels;
    const next = [];
    for (let i = 0; i < count; i++) {
      next.push(prev[i] ? { ...prev[i] } : { r: 0, g: 0, b: 0, mode: 2, speed: 60 });
    }
    state.pixels = next;
  }

  function showGlobalError(msg) {
    const banner = document.getElementById('globalErrorBanner');
    const textEl = document.getElementById('globalErrorText');
    if (banner && textEl) {
      textEl.textContent = String(msg);
      banner.classList.remove('hidden');
    }
  }
  window.onerror = (m, s, l, c, err) => { showGlobalError(err?.stack || `${m} (${l}:${c})`); return false; };
  window.addEventListener('unhandledrejection', e => showGlobalError(`Promise Error: ${e.reason?.message || e.reason}`));

  // Color Helpers
  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60)       { r1 = c; g1 = x; }
    else if (h < 120) { r1 = x; g1 = c; }
    else if (h < 180) { g1 = c; b1 = x; }
    else if (h < 240) { g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; b1 = c; }
    else              { r1 = c; b1 = x; }
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * (((bn - rn) / d) + 2);
      else h = 60 * (((rn - gn) / d) + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  function rgbToHex(r, g, b) {
    const h = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function hexToRgb(hex) {
    const c = String(hex).replace(/[^0-9A-Fa-f]/g, '');
    if (c.length === 3) return { r: parseInt(c[0]+c[0], 16), g: parseInt(c[1]+c[1], 16), b: parseInt(c[2]+c[2], 16) };
    if (c.length === 6) return { r: parseInt(c.slice(0,2), 16), g: parseInt(c.slice(2,4), 16), b: parseInt(c.slice(4,6), 16) };
    return null;
  }

  // Timeout & BLE Write
  function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Таймаут (${ms} мс): ${label}`)), ms);
      })
    ]).finally(() => clearTimeout(timer));
  }

  async function writeCharacteristicSmart(char, dataBytes) {
    const uuid = char.uuid;
    const mode = state.preferredWriteMode[uuid];
    const props = char.properties || {};

    if (mode === 'withoutResponse' && char.writeValueWithoutResponse) {
      await withTimeout(char.writeValueWithoutResponse(dataBytes), 4000, 'writeWithoutResponse');
      return;
    }
    if (mode === 'withResponse' && char.writeValueWithResponse) {
      await withTimeout(char.writeValueWithResponse(dataBytes), 4000, 'writeWithResponse');
      return;
    }
    if (mode === 'legacy') {
      await withTimeout(char.writeValue(dataBytes), 4000, 'writeValue');
      return;
    }

    if ((props.writeWithoutResponse || props.writeWithoutResponse === undefined) && typeof char.writeValueWithoutResponse === 'function') {
      try {
        await withTimeout(char.writeValueWithoutResponse(dataBytes), 4000, 'writeWithoutResponse');
        state.preferredWriteMode[uuid] = 'withoutResponse';
        return;
      } catch (e) {
        logDiagnostic(`writeValueWithoutResponse (${uuid.slice(4,8)}) отклонён: ${e.message}`, true);
      }
    }

    if (typeof char.writeValueWithResponse === 'function') {
      try {
        await withTimeout(char.writeValueWithResponse(dataBytes), 4000, 'writeWithResponse');
        state.preferredWriteMode[uuid] = 'withResponse';
        return;
      } catch (e) {
        logDiagnostic(`writeValueWithResponse (${uuid.slice(4,8)}) отклонён: ${e.message}`, true);
      }
    }

    await withTimeout(char.writeValue(dataBytes), 4000, 'writeValue');
    state.preferredWriteMode[uuid] = 'legacy';
  }

  class BleCommandQueue {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
      this.debounceTimers = new Map();
    }

    enqueueDebounced(key, stepsFactory, delayMs = 55) {
      if (this.debounceTimers.has(key)) clearTimeout(this.debounceTimers.get(key));
      const timer = setTimeout(() => {
        this.debounceTimers.delete(key);
        this.enqueueSteps(stepsFactory(), key);
      }, delayMs);
      this.debounceTimers.set(key, timer);
    }

    enqueueSteps(steps, coalesceKey = null) {
      if (!Array.isArray(steps) || steps.length === 0) return;
      if (coalesceKey) {
        this.queue = this.queue.filter(item => item.coalesceKey !== coalesceKey);
      }
      steps.forEach((step, idx) => {
        this.queue.push({ step, coalesceKey: idx === 0 ? coalesceKey : null });
      });
      this.processNext();
    }

    async processNext() {
      if (this.isProcessing || this.queue.length === 0) return;
      this.isProcessing = true;
      try {
        while (this.queue.length > 0) {
          const { step } = this.queue.shift();
          if (!state.isConnected) continue;

          const payload = step.encrypt ? encrypt(step.raw) : step.raw;
          const char = step.target === 'data' ? (state.dataChar || state.cmdChar) : state.cmdChar;
          if (!char) continue;
          const charTag = step.target === 'data' ? '960a' : char.uuid.slice(4, 8);

          appendPacketLog({
            dir: 'TX',
            charTag,
            label: step.label,
            desc: step.desc,
            rawHex: bytesToHex(step.raw),
            encHex: step.encrypt ? bytesToHex(payload) : 'UNENCRYPTED'
          });

          try {
            await writeCharacteristicSmart(char, payload);
            if (this.queue.length > 0) await new Promise(r => setTimeout(r, 25));
          } catch (err) {
            logDiagnostic(`Ошибка BLE записи (${step.label}): ${err.message}`, true);
            showToast(`Ошибка BLE: ${err.message}`, 'error');
          }
        }
      } finally {
        this.isProcessing = false;
      }
    }
  }

  const bleQueue = new BleCommandQueue();

  // BLE Connect / Disconnect (hardened for Bluefy iOS)
  let connectAttemptId = 0;

  async function findIdealLedService(server) {
    for (const uuid of [UUIDS.SERVICE_PRIMARY, UUIDS.SERVICE_FALLBACK]) {
      try {
        logDiagnostic(`Поиск сервиса ${uuid.slice(4,8)}...`);
        const svc = await withTimeout(server.getPrimaryService(uuid), 5000, `getPrimaryService(${uuid.slice(4,8)})`);
        logDiagnostic(`Найден сервис: ${svc.uuid}`);
        return svc;
      } catch (e) {
        logDiagnostic(`Сервис ${uuid.slice(4,8)}: ${e.message}`, true);
      }
    }
    const all = await withTimeout(server.getPrimaryServices(), 6000, 'getPrimaryServices');
    const match = all.find(s => /fff0|ffe0/i.test(s.uuid)) || all.find(s => !/1800|1801|180a/i.test(s.uuid));
    if (match) return match;
    throw new Error(`Не найден сервис fff0/ffe0 (есть: ${all.map(s => s.uuid.slice(4,8)).join(', ') || 'пусто'})`);
  }

  async function connectBle(usePrefixFilter) {
    if (!('bluetooth' in navigator)) {
      showToast('Откройте сайт на iPhone в приложении Bluefy!', 'error');
      return;
    }

    const attemptId = ++connectAttemptId;
    const isAborted = () => attemptId !== connectAttemptId;

    try {
      state.preferredWriteMode = {};
      updateConnectionStatus('connecting', 'Поиск...');
      logDiagnostic(usePrefixFilter ? 'Шаг 1/4: Поиск ISP/IDL/IDEALLED...' : 'Шаг 1/4: Поиск всех BLE...');

      const optionalServices = [UUIDS.SERVICE_PRIMARY, UUIDS.SERVICE_FALLBACK, UUIDS.SERVICE_AE00];
      const options = usePrefixFilter
        ? {
            filters: [{ namePrefix: 'ISP' }, { namePrefix: 'IDL' }, { namePrefix: 'IDEALLED' }],
            optionalServices
          }
        : { acceptAllDevices: true, optionalServices };

      const device = await navigator.bluetooth.requestDevice(options);
      if (isAborted()) return;

      state.bleDevice = device;
      device.removeEventListener('gattserverdisconnected', handleBleDisconnected);
      device.addEventListener('gattserverdisconnected', handleBleDisconnected);

      const devName = device.name || device.id || 'idealLED';
      updateConnectionStatus('connecting', `GATT ${devName}...`);
      logDiagnostic(`Шаг 2/4: Выбрано "${devName}", подключение GATT...`);

      let server;
      try {
        server = await withTimeout(device.gatt.connect(), 10000, 'gatt.connect');
      } catch (connErr) {
        if (isAborted()) return;
        logDiagnostic(`Повтор GATT (${connErr.message})...`, true);
        await new Promise(r => setTimeout(r, 400));
        if (isAborted()) return;
        server = await withTimeout(device.gatt.connect(), 10000, 'gatt.connect (retry)');
      }
      if (isAborted()) return;

      await new Promise(r => setTimeout(r, 350));
      if (isAborted()) return;
      if (!device.gatt.connected) throw new Error('Лента сбросила соединение');

      updateConnectionStatus('connecting', 'Сервисы...');
      const service = await findIdealLedService(server);
      if (isAborted()) return;

      updateConnectionStatus('connecting', 'Характеристики...');
      const chars = await withTimeout(service.getCharacteristics(), 6000, 'getCharacteristics');
      if (isAborted()) return;

      const cmdChar =
        chars.find(c => c.uuid.toLowerCase() === UUIDS.WRITE_CMD) ||
        chars.find(c => c.uuid.toLowerCase() === UUIDS.LEGACY_WRITE) ||
        chars.find(c => c.uuid.toLowerCase().includes('fff3')) ||
        chars.find(c => c.properties.writeWithoutResponse || c.properties.write);

      if (!cmdChar) throw new Error('Не найдена характеристика записи (9600 / fff3)');

      const dataChar = chars.find(c => c.uuid.toLowerCase() === UUIDS.WRITE_DATA) || null;
      const notifyChar =
        chars.find(c => c.uuid.toLowerCase() === UUIDS.NOTIFY) ||
        chars.find(c => c.uuid.toLowerCase() === UUIDS.LEGACY_NOTIFY) ||
        chars.find(c => c.properties.notify) || null;

      state.cmdChar = cmdChar;
      state.dataChar = dataChar;
      state.notifyChar = notifyChar;
      state.detectedType = cmdChar.uuid.toLowerCase() === UUIDS.WRITE_CMD ? 'TYPE2' : 'LEGACY';

      state.isConnected = true;
      state.deviceName = devName;
      updateProtocolBadge();
      updateConnectionStatus('connected', devName);
      showToast(`Подключено к ${devName}`, 'success');

      try {
        if (typeof cmdChar.getDescriptor === 'function') {
          const desc = await withTimeout(cmdChar.getDescriptor(UUIDS.DESCRIPTOR_FW), 2000, 'getDescriptor');
          const val = await withTimeout(desc.readValue(), 2000, 'readDescriptor');
          const fw = bytesToAscii(new Uint8Array(val.buffer)).replace(/\./g, '').trim();
          if (fw) {
            state.firmwareVersion = fw;
            state.detectedType = detectCommandType(fw);
            updateProtocolBadge();
            logDiagnostic(`Прошивка: "${fw}" → ${state.detectedType}`);
          }
        }
      } catch (descErr) {
        logDiagnostic(`Дескриптор 2901 пропущен (${descErr.message})`);
      }

      if (notifyChar) {
        try {
          await withTimeout(notifyChar.startNotifications(), 2500, 'startNotifications');
          notifyChar.addEventListener('characteristicvaluechanged', handleBleNotification);
          logDiagnostic(`Notify активен: ${notifyChar.uuid.slice(0,8)}`);
        } catch (nErr) {
          logDiagnostic(`Notify пропущен (${nErr.message})`, true);
        }
      }

      await new Promise(r => setTimeout(r, 80));
      if (activeProtocol() !== 'LEGACY') bleQueue.enqueueSteps(Commands.getVersion());
      bleQueue.enqueueSteps(Commands.power(state.isOn, activeProtocol()), 'POWER');
    } catch (err) {
      if (isAborted()) return;
      if (err?.name === 'NotFoundError') {
        logDiagnostic('Выбор устройства отменён');
      } else {
        logDiagnostic(`Ошибка подключения: ${err?.message || err}`, true);
        showToast(`Ошибка: ${err?.message || err}`, 'error');
      }
      updateConnectionStatus('disconnected');
    }
  }

  function disconnectBle() {
    if (state.bleDevice?.gatt?.connected) state.bleDevice.gatt.disconnect();
    else handleBleDisconnected();
  }

  function handleBleDisconnected() {
    state.isConnected = false;
    state.cmdChar = null;
    state.dataChar = null;
    state.notifyChar = null;
    state.deviceName = '';
    updateConnectionStatus('disconnected');
    logDiagnostic('BLE соединение закрыто');
    showToast('Лента отключена', 'info');
  }

  function handleBleNotification(event) {
    const raw = new Uint8Array(event.target.value.buffer);
    let decHex = '—', ascii = '';
    if (raw.length === 16) {
      const dec = decrypt(raw);
      decHex = bytesToHex(dec);
      ascii = bytesToAscii(dec);
      if (ascii.includes('R0') || ascii.includes('TR')) {
        const cleanFw = ascii.replace(/[^A-Za-z0-9._-]/g, '');
        if (cleanFw.length >= 4) {
          state.firmwareVersion = cleanFw;
          state.detectedType = detectCommandType(cleanFw);
          updateProtocolBadge();
        }
      }
    }
    appendPacketLog({
      dir: 'RX',
      charTag: 'notify',
      label: 'NOTIFY',
      desc: ascii ? `ASCII: ${ascii}` : `${raw.length}B`,
      rawHex: bytesToHex(raw),
      encHex: decHex
    });
  }

  function updateProtocolBadge() {
    const badge = document.getElementById('protocolBadge');
    const fwText = state.firmwareVersion ? ` • ${state.firmwareVersion}` : '';
    badge.textContent = `Протокол: ${activeProtocol()}${fwText}`;
  }

  function updateConnectionStatus(status, label = '') {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const group = document.getElementById('connectButtonsGroup');
    const btnDisc = document.getElementById('btnDisconnect');
    const btnCancel = document.getElementById('btnCancelConnect');

    if (status === 'connected') {
      dot.className = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-surface-950 shadow-[0_0_10px_#34d399]';
      text.textContent = label || 'Подключено';
      text.className = 'text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30';
      group.classList.add('hidden');
      btnDisc.classList.remove('hidden');
      btnCancel?.classList.add('hidden');
    } else if (status === 'connecting') {
      dot.className = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 ring-2 ring-surface-950 animate-ping';
      text.textContent = label || 'Подключение...';
      text.className = 'text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/30';
      btnCancel?.classList.remove('hidden');
    } else {
      dot.className = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-slate-500 ring-2 ring-surface-950';
      text.textContent = 'Не подключено';
      text.className = 'text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10';
      group.classList.remove('hidden');
      btnDisc.classList.add('hidden');
      btnCancel?.classList.add('hidden');
    }
  }

  // Color Wheel Canvas
  const wheelCanvas = document.getElementById('colorWheelCanvas');
  const wheelCtx = wheelCanvas.getContext('2d');
  let wheelGeom = null;
  let wheelDragTarget = null;

  function resizeAndDrawColorWheel() {
    const wrapper = document.getElementById('wheelWrapper');
    if (!wrapper || wrapper.offsetParent === null) return;
    const size = Math.max(200, Math.floor(wrapper.getBoundingClientRect().width || 240));
    const dpr = window.devicePixelRatio || 1;
    wheelCanvas.width = size * dpr;
    wheelCanvas.height = size * dpr;
    wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2, cy = size / 2;
    const outerR = size / 2 - 6;
    const ringWidth = Math.max(24, Math.round(size * 0.115));
    const innerR = outerR - ringWidth;
    const sqHalf = Math.floor((innerR - 10) * Math.SQRT1_2);
    wheelGeom = { size, cx, cy, outerR, innerR, sqLeft: cx - sqHalf, sqTop: cy - sqHalf, sqSize: sqHalf * 2 };
    drawColorWheel();
  }

  function drawColorWheel() {
    if (!wheelGeom) return;
    const { size, cx, cy, outerR, innerR, sqLeft, sqTop, sqSize } = wheelGeom;
    wheelCtx.clearRect(0, 0, size, size);

    for (let angle = 0; angle < 360; angle++) {
      wheelCtx.beginPath();
      wheelCtx.arc(cx, cy, (outerR + innerR) / 2, ((angle - 0.8) * Math.PI) / 180, ((angle + 0.8) * Math.PI) / 180);
      wheelCtx.lineWidth = outerR - innerR;
      wheelCtx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      wheelCtx.stroke();
    }

    wheelCtx.save();
    wheelCtx.beginPath();
    if (wheelCtx.roundRect) wheelCtx.roundRect(sqLeft, sqTop, sqSize, sqSize, 10);
    else wheelCtx.rect(sqLeft, sqTop, sqSize, sqSize);
    wheelCtx.clip();

    wheelCtx.fillStyle = `hsl(${state.h}, 100%, 50%)`;
    wheelCtx.fillRect(sqLeft, sqTop, sqSize, sqSize);

    const satGrad = wheelCtx.createLinearGradient(sqLeft, 0, sqLeft + sqSize, 0);
    satGrad.addColorStop(0, 'rgba(255,255,255,1)');
    satGrad.addColorStop(1, 'rgba(255,255,255,0)');
    wheelCtx.fillStyle = satGrad;
    wheelCtx.fillRect(sqLeft, sqTop, sqSize, sqSize);

    const valGrad = wheelCtx.createLinearGradient(0, sqTop, 0, sqTop + sqSize);
    valGrad.addColorStop(0, 'rgba(0,0,0,0)');
    valGrad.addColorStop(1, 'rgba(0,0,0,1)');
    wheelCtx.fillStyle = valGrad;
    wheelCtx.fillRect(sqLeft, sqTop, sqSize, sqSize);
    wheelCtx.restore();

    const hueRad = (state.h * Math.PI) / 180;
    const midR = (outerR + innerR) / 2;
    drawHandle(cx + Math.cos(hueRad) * midR, cy + Math.sin(hueRad) * midR, `hsl(${state.h}, 100%, 50%)`);
    drawHandle(sqLeft + state.s * sqSize, sqTop + (1 - state.v) * sqSize, rgbToHex(state.r, state.g, state.b));
  }

  function drawHandle(x, y, fill) {
    wheelCtx.save();
    wheelCtx.beginPath();
    wheelCtx.arc(x, y, 8.5, 0, Math.PI * 2);
    wheelCtx.fillStyle = fill;
    wheelCtx.fill();
    wheelCtx.lineWidth = 2.5;
    wheelCtx.strokeStyle = '#ffffff';
    wheelCtx.shadowColor = 'rgba(0,0,0,0.75)';
    wheelCtx.shadowBlur = 6;
    wheelCtx.stroke();
    wheelCtx.restore();
  }

  function updateWheelFromPoint(clientX, clientY, isStart) {
    if (!wheelGeom) return;
    const rect = wheelCanvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const { cx, cy, outerR, innerR, sqLeft, sqTop, sqSize } = wheelGeom;

    if (isStart) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist >= innerR - 6 && dist <= outerR + 8) wheelDragTarget = 'ring';
      else if (x >= sqLeft - 8 && x <= sqLeft + sqSize + 8 && y >= sqTop - 8 && y <= sqTop + sqSize + 8) wheelDragTarget = 'square';
      else { wheelDragTarget = null; return; }
    }

    if (wheelDragTarget === 'ring') {
      let angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      state.h = angle;
      const rgb = hsvToRgb(state.h, state.s, state.v);
      applyColorChange(rgb.r, rgb.g, rgb.b, false, true);
    } else if (wheelDragTarget === 'square') {
      state.s = Math.max(0, Math.min(1, (x - sqLeft) / sqSize));
      state.v = Math.max(0, Math.min(1, 1 - (y - sqTop) / sqSize));
      const rgb = hsvToRgb(state.h, state.s, state.v);
      applyColorChange(rgb.r, rgb.g, rgb.b, false, true);
    }
  }

  // Commands & UI State
  function sendCurrentColorBle() {
    bleQueue.enqueueDebounced('COLOR', () => Commands.color(state.r, state.g, state.b, {
      protocolType: activeProtocol(),
      brightness: state.brightness,
      fiveBitSafe: state.fiveBitSafe,
      r2: state.useDualColor ? state.r2 : state.r,
      g2: state.useDualColor ? state.g2 : state.g,
      b2: state.useDualColor ? state.b2 : state.b
    }), 55);
  }

  function sendCurrentEffectBle() {
    bleQueue.enqueueDebounced('EFFECT', () => Commands.effect(state.modeId, {
      protocolType: activeProtocol(),
      reverse: state.reverse,
      speed: state.speed,
      brightness: state.brightness,
      palette: state.effectPalette
    }), 60);
  }

  function applyColorChange(r, g, b, recalcHsv = true, sendBle = true) {
    state.r = Math.max(0, Math.min(255, Math.round(r)));
    state.g = Math.max(0, Math.min(255, Math.round(g)));
    state.b = Math.max(0, Math.min(255, Math.round(b)));

    if (recalcHsv) {
      const hsv = rgbToHsv(state.r, state.g, state.b);
      if (hsv.s > 0.01) state.h = hsv.h;
      state.s = hsv.s;
      state.v = hsv.v;
    }

    const hex = rgbToHex(state.r, state.g, state.b);
    document.getElementById('sliderR').value = state.r;
    document.getElementById('numR').value = state.r;
    document.getElementById('sliderG').value = state.g;
    document.getElementById('numG').value = state.g;
    document.getElementById('sliderB').value = state.b;
    document.getElementById('numB').value = state.b;
    document.getElementById('hexInput').value = hex;
    document.getElementById('activeColorSwatch').style.backgroundColor = hex;
    document.getElementById('activeRgbText').textContent = `${state.r}, ${state.g}, ${state.b}`;
    document.getElementById('graffitiBrushPreview').style.backgroundColor = hex;

    document.documentElement.style.setProperty('--accent-r', state.r);
    document.documentElement.style.setProperty('--accent-g', state.g);
    document.documentElement.style.setProperty('--accent-b', state.b);

    drawColorWheel();

    if (sendBle) {
      if (state.modeId !== 0 && state.modeId !== 999) applyModeSelection(0, false);
      sendCurrentColorBle();
    }
  }

  function applyBrightnessChange(val, sendBle = true) {
    state.brightness = Math.max(0, Math.min(100, Math.round(val)));
    document.getElementById('brightnessSlider').value = state.brightness;
    document.getElementById('brightnessValueLabel').textContent = `${state.brightness}%`;
    document.getElementById('telemetryBrightness').textContent = `${state.brightness}%`;

    if (sendBle) {
      const proto = activeProtocol();
      if (proto === 'LEGACY') bleQueue.enqueueDebounced('LIGHT', () => Commands.legacyBrightness(state.brightness), 55);
      else if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
      else sendCurrentColorBle();
    }
  }

  function applySpeedChange(val, sendBle = true) {
    state.speed = Math.max(1, Math.min(100, Math.round(val)));
    document.getElementById('speedSlider').value = state.speed;
    document.getElementById('speedValueLabel').textContent = `${state.speed}%`;
    if (sendBle) {
      if (activeProtocol() === 'LEGACY') bleQueue.enqueueDebounced('SPEED', () => Commands.legacySpeed(state.speed), 55);
      else if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
    }
  }

  function applyPowerChange(isOn, sendBle = true) {
    state.isOn = Boolean(isOn);
    const btn = document.getElementById('btnPower');
    const label = document.getElementById('btnPowerLabel');
    const sub = document.getElementById('powerSubtitle');
    btn.setAttribute('aria-pressed', String(state.isOn));

    if (state.isOn) {
      btn.className = 'btn-tactile power-orb-on flex items-center justify-center sm:justify-start gap-3.5 px-5 py-3.5 rounded-2xl border cursor-pointer shrink-0';
      label.textContent = 'ВКЛЮЧЕНО';
      sub.textContent = 'Нажмите чтобы выключить';
      sub.className = 'block text-[11px] text-emerald-300/90';
    } else {
      btn.className = 'btn-tactile power-orb-off flex items-center justify-center sm:justify-start gap-3.5 px-5 py-3.5 rounded-2xl border cursor-pointer shrink-0';
      label.textContent = 'ВЫКЛЮЧЕНО';
      sub.textContent = 'Нажмите чтобы включить';
      sub.className = 'block text-[11px] text-slate-400';
    }

    if (sendBle) {
      bleQueue.enqueueSteps(Commands.power(state.isOn, activeProtocol()), 'POWER');
    }
  }

  function applyModeSelection(modeId, sendBle = true) {
    state.modeId = modeId;
    const preset = BUILTIN_EFFECTS.find(m => m.id === modeId);
    const title = modeId === 999 ? 'Граффити' : (preset ? preset.name : `Эффект #${modeId}`);

    document.getElementById('activeModeBadge').textContent = title;
    document.getElementById('telemetryMode').textContent = title;

    document.querySelectorAll('.mode-card').forEach(card => {
      const id = Number(card.dataset.modeId);
      if (id === state.modeId) {
        card.classList.add('bg-sky-500/15', 'border-sky-400/60', 'ring-1', 'ring-sky-400/35');
        card.classList.remove('border-white/5');
      } else {
        card.classList.remove('bg-sky-500/15', 'border-sky-400/60', 'ring-1', 'ring-sky-400/35');
        card.classList.add('border-white/5');
      }
    });

    if (sendBle) {
      if (modeId === 0) sendCurrentColorBle();
      else if (modeId >= 1 && modeId <= 11) sendCurrentEffectBle();
    }
  }

  function applyLedCount(count, sendBle = true) {
    const val = Math.max(1, Math.min(1024, Math.round(count)));
    state.ledCount = val;
    initPixelsArray(val);
    renderGraffitiGrid();
    document.getElementById('ledCountInput').value = val;
    document.getElementById('ledCountBadge').textContent = `${val} шт.`;
    document.getElementById('telemetryLeds').textContent = `${val} LED`;

    if (sendBle) {
      bleQueue.enqueueSteps(Commands.lampCount(val, activeProtocol()), 'LAMPN');
      showToast(`Количество диодов: ${val}`, 'info');
    }
  }

  // ============================================================================
  // RANDOM AUTO-DJ & DAILY ON/OFF SCHEDULER + SLEEP TIMER
  // ============================================================================
  function saveAutomationConfig() {
    try {
      localStorage.setItem(STORAGE_AUTOMATION_KEY, JSON.stringify({
        randomEnabled: state.randomEnabled,
        randomIntervalSec: state.randomIntervalSec,
        randomKind: state.randomKind,
        randomSpeedReverse: state.randomSpeedReverse,
        randomEffectPool: state.randomEffectPool,
        schedOnEnabled: state.schedOnEnabled,
        schedOnTime: state.schedOnTime,
        schedOnAction: state.schedOnAction,
        schedOffEnabled: state.schedOffEnabled,
        schedOffTime: state.schedOffTime
      }));
    } catch {}
  }

  function loadAutomationConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem(STORAGE_AUTOMATION_KEY) || '{}');
      if (typeof cfg.randomEnabled === 'boolean') state.randomEnabled = cfg.randomEnabled;
      if (Number(cfg.randomIntervalSec) >= 3) state.randomIntervalSec = Number(cfg.randomIntervalSec);
      if (cfg.randomKind) state.randomKind = cfg.randomKind;
      if (typeof cfg.randomSpeedReverse === 'boolean') state.randomSpeedReverse = cfg.randomSpeedReverse;
      if (Array.isArray(cfg.randomEffectPool) && cfg.randomEffectPool.length > 0) state.randomEffectPool = cfg.randomEffectPool;
      if (typeof cfg.schedOnEnabled === 'boolean') state.schedOnEnabled = cfg.schedOnEnabled;
      if (cfg.schedOnTime) state.schedOnTime = cfg.schedOnTime;
      if (cfg.schedOnAction) state.schedOnAction = cfg.schedOnAction;
      if (typeof cfg.schedOffEnabled === 'boolean') state.schedOffEnabled = cfg.schedOffEnabled;
      if (cfg.schedOffTime) state.schedOffTime = cfg.schedOffTime;
    } catch {}
  }

  function randomBrightPalette() {
    const baseHue = Math.floor(Math.random() * 360);
    const count = 3 + Math.floor(Math.random() * 4);
    const step = 360 / count;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(hsvToRgb((baseHue + i * step + Math.random() * 25) % 360, 0.9 + Math.random() * 0.1, 1));
    }
    return arr;
  }

  function triggerRandomStep(force = false) {
    if (!state.isOn && !force) return;
    if (!state.isOn && force) applyPowerChange(true, true);

    const pool = state.randomEffectPool.length > 0 ? state.randomEffectPool : [1, 2, 3, 5, 6, 7, 8, 9, 10];
    let kind = state.randomKind;
    if (kind === 'mix') {
      kind = Math.random() < 0.7 ? 'effects_palette' : 'colors';
    }

    if (kind === 'colors') {
      const hue = Math.floor(Math.random() * 360);
      const rgb = hsvToRgb(hue, 0.85 + Math.random() * 0.15, 1);
      applyColorChange(rgb.r, rgb.g, rgb.b, true, true);
      logDiagnostic(`🎲 Рандом цвет: ${rgbToHex(rgb.r, rgb.g, rgb.b)}`);
    } else {
      // Pick different effect from current when possible
      const candidates = pool.filter(id => id !== state.modeId);
      const pickPool = candidates.length > 0 ? candidates : pool;
      const nextEffect = pickPool[Math.floor(Math.random() * pickPool.length)];

      if (kind === 'effects_palette') {
        const presetKeys = Object.keys(PALETTE_PRESETS);
        if (Math.random() < 0.45) {
          const k = presetKeys[Math.floor(Math.random() * presetKeys.length)];
          state.effectPalette = PALETTE_PRESETS[k].map(c => ({ ...c }));
        } else {
          state.effectPalette = randomBrightPalette();
        }
        renderEffectPalette();
      }

      if (state.randomSpeedReverse) {
        state.speed = 35 + Math.floor(Math.random() * 55);
        state.reverse = Math.random() < 0.5;
        document.getElementById('speedSlider').value = state.speed;
        document.getElementById('speedValueLabel').textContent = `${state.speed}%`;
        document.getElementById('reverseToggle').checked = state.reverse;
      }

      applyModeSelection(nextEffect, true);
      logDiagnostic(`🎲 Рандом: Эффект #${nextEffect} (скорость ${state.speed}%)`);
    }

    if (state.randomEnabled) {
      state.randomNextSwitchAt = Date.now() + state.randomIntervalSec * 1000;
    }
  }

  function renderRandomEffectPool() {
    const grid = document.getElementById('randomEffectPoolGrid');
    grid.innerHTML = BUILTIN_EFFECTS.filter(e => e.id >= 1 && e.id <= 10).map(e => {
      const active = state.randomEffectPool.includes(e.id);
      return `<button type="button" data-eid="${e.id}" class="rand-pool-chip btn-tactile px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
        active
          ? 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/50'
          : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
      }">${e.name}</button>`;
    }).join('');

    grid.querySelectorAll('.rand-pool-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.eid);
        const idx = state.randomEffectPool.indexOf(id);
        if (idx !== -1) {
          if (state.randomEffectPool.length === 1) return showToast('Оставьте хотя бы 1 эффект', 'error');
          state.randomEffectPool.splice(idx, 1);
        } else {
          state.randomEffectPool.push(id);
          state.randomEffectPool.sort((a, b) => a - b);
        }
        saveAutomationConfig();
        renderRandomEffectPool();
      });
    });
  }

  function formatDuration(secTotal) {
    const s = Math.max(0, Math.floor(secTotal));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function getNextTimeDiffSec(hhmm) {
    const [hh, mm] = (hhmm || '00:00').split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hh || 0, mm || 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return Math.round((target - now) / 1000);
  }

  function runAutomationTick() {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayMinuteKey = `${now.toDateString()} ${hhmm}`;

    // 1. Random DJ rotation
    const randLabel = document.getElementById('randomCountdownLabel');
    if (state.randomEnabled) {
      if (!state.randomNextSwitchAt) state.randomNextSwitchAt = Date.now() + state.randomIntervalSec * 1000;
      const remSec = Math.ceil((state.randomNextSwitchAt - Date.now()) / 1000);
      if (remSec <= 0) {
        triggerRandomStep(false);
      } else {
        randLabel.textContent = state.isOn ? `Следующий через ${formatDuration(remSec)}` : 'Ждёт включения ленты';
      }
    } else {
      randLabel.textContent = 'Выключено';
    }

    // 2. Daily Auto-On
    if (state.schedOnEnabled && state.schedOnTime === hhmm && state.lastTriggeredOnMinute !== todayMinuteKey) {
      state.lastTriggeredOnMinute = todayMinuteKey;
      logDiagnostic(`☀️ Расписание ${hhmm}: Автовключение (${state.schedOnAction})`);
      showToast(`Расписание: включаю ленту (${hhmm})`, 'success');
      applyPowerChange(true, true);
      if (state.schedOnAction === 'random') {
        state.randomEnabled = true;
        document.getElementById('randomEnabledToggle').checked = true;
        saveAutomationConfig();
        setTimeout(() => triggerRandomStep(true), 200);
      } else if (state.schedOnAction === 'warm') {
        setTimeout(() => applyColorChange(255, 210, 138, true, true), 200);
      } else if (state.schedOnAction === 'rainbow') {
        state.effectPalette = PALETTE_PRESETS.rainbow.map(c => ({ ...c }));
        renderEffectPalette();
        setTimeout(() => applyModeSelection(1, true), 200);
      }
    }

    // 3. Daily Auto-Off
    if (state.schedOffEnabled && state.schedOffTime === hhmm && state.lastTriggeredOffMinute !== todayMinuteKey) {
      state.lastTriggeredOffMinute = todayMinuteKey;
      logDiagnostic(`🌙 Расписание ${hhmm}: Автовыключение`);
      showToast(`Расписание: выключаю ленту (${hhmm})`, 'info');
      applyPowerChange(false, true);
    }

    // 4. Sleep Timer
    const sleepLabel = document.getElementById('sleepStatusLabel');
    const sleepCancel = document.getElementById('sleepCancelBtn');
    if (state.sleepOffAt > 0) {
      const remSleep = Math.ceil((state.sleepOffAt - Date.now()) / 1000);
      if (remSleep <= 0) {
        state.sleepOffAt = 0;
        sleepLabel.textContent = 'Сработал';
        sleepCancel.classList.add('hidden');
        logDiagnostic('💤 Таймер сна: выключаю ленту');
        showToast('Таймер сна выключил ленту', 'info');
        applyPowerChange(false, true);
      } else {
        sleepLabel.textContent = `Выкл через ${formatDuration(remSleep)}`;
        sleepCancel.classList.remove('hidden');
      }
    } else {
      sleepLabel.textContent = 'Не задан';
      sleepCancel.classList.add('hidden');
    }

    // 5. Update Summary & Hero Pill
    const schedParts = [];
    if (state.schedOnEnabled) schedParts.push(`☀️ ${state.schedOnTime} (через ${formatDuration(getNextTimeDiffSec(state.schedOnTime))})`);
    if (state.schedOffEnabled) schedParts.push(`🌙 ${state.schedOffTime} (через ${formatDuration(getNextTimeDiffSec(state.schedOffTime))})`);
    document.getElementById('scheduleNextSummary').textContent = schedParts.length > 0 ? schedParts.join(' • ') : 'Не активно';

    const pill = document.getElementById('activeAutomationPill');
    const heroParts = [];
    if (state.randomEnabled) {
      const rem = Math.max(0, Math.ceil((state.randomNextSwitchAt - Date.now()) / 1000));
      heroParts.push(`🎲 ${formatDuration(rem)}`);
    }
    if (state.sleepOffAt > 0) {
      const remS = Math.max(0, Math.ceil((state.sleepOffAt - Date.now()) / 1000));
      heroParts.push(`💤 ${formatDuration(remS)}`);
    } else if (state.schedOffEnabled) {
      heroParts.push(`🌙 ${state.schedOffTime}`);
    }
    if (heroParts.length > 0) {
      pill.textContent = heroParts.join(' • ');
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  }

  async function setWakeLock(enabled) {
    if (!('wakeLock' in navigator)) {
      showToast('Браузер не поддерживает блокировку сна экрана', 'error');
      document.getElementById('wakeLockToggle').checked = false;
      return;
    }
    try {
      if (enabled) {
        state.wakeLock = await navigator.wakeLock.request('screen');
        showToast('Экран не будет гаснуть', 'success');
      } else if (state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
        showToast('Блокировка сна отключена', 'info');
      }
    } catch (e) {
      showToast(`WakeLock: ${e.message}`, 'error');
      document.getElementById('wakeLockToggle').checked = false;
    }
  }

  // Presets, Favorites & Effects UI
  function renderPresetColors() {
    const grid = document.getElementById('presetColorsGrid');
    grid.innerHTML = COLOR_PRESETS.map(p => `
      <button type="button" data-r="${p.r}" data-g="${p.g}" data-b="${p.b}"
        class="preset-swatch btn-tactile flex flex-col items-center gap-1.5 p-2 rounded-2xl glass-subcard hover:bg-white/10 transition cursor-pointer">
        <span class="w-full h-7 rounded-xl shadow-inner border border-white/20" style="background-color: ${p.hex};"></span>
        <span class="text-[10px] text-slate-300 truncate w-full text-center">${p.name}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.preset-swatch').forEach(btn => {
      btn.addEventListener('click', () => applyColorChange(Number(btn.dataset.r), Number(btn.dataset.g), Number(btn.dataset.b), true, true));
    });
  }

  function loadFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_FAVORITES_KEY) || '[]');
      state.favorites = Array.isArray(parsed) ? parsed : [];
    } catch { state.favorites = []; }
    renderFavorites();
  }

  function saveFavorites() {
    try { localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(state.favorites)); } catch {}
  }

  function renderFavorites() {
    const grid = document.getElementById('favoriteColorsGrid');
    document.getElementById('favoritesCount').textContent = String(state.favorites.length);
    if (state.favorites.length === 0) {
      grid.innerHTML = '<span class="text-xs text-slate-500 italic">Нажмите «+ Сохранить», чтобы добавить любимый оттенок</span>';
      return;
    }
    grid.innerHTML = state.favorites.map((fav, idx) => `
      <div class="inline-flex items-center rounded-xl glass-subcard overflow-hidden">
        <button type="button" data-idx="${idx}" class="fav-apply-btn flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 transition cursor-pointer">
          <span class="w-4 h-4 rounded-md border border-white/25" style="background-color: ${fav.hex};"></span>
          <span class="text-[11px] font-mono text-slate-200">${fav.hex}</span>
        </button>
        <button type="button" data-idx="${idx}" class="fav-del-btn px-2 py-1.5 text-slate-500 hover:text-rose-400 text-xs cursor-pointer">×</button>
      </div>
    `).join('');
    grid.querySelectorAll('.fav-apply-btn').forEach(b => b.addEventListener('click', () => {
      const item = state.favorites[Number(b.dataset.idx)];
      if (item) applyColorChange(item.r, item.g, item.b, true, true);
    }));
    grid.querySelectorAll('.fav-del-btn').forEach(b => b.addEventListener('click', () => {
      state.favorites.splice(Number(b.dataset.idx), 1);
      saveFavorites();
      renderFavorites();
    }));
  }

  function renderModesGrid() {
    const grid = document.getElementById('modesGrid');
    grid.innerHTML = BUILTIN_EFFECTS.map(m => `
      <button type="button" data-mode-id="${m.id}"
        class="mode-card btn-tactile text-left p-3 rounded-2xl glass-subcard hover:bg-white/10 border border-white/5 cursor-pointer flex flex-col justify-between gap-2">
        <div class="w-full h-1.5 rounded-full ${m.bar} opacity-85"></div>
        <div>
          <div class="flex items-center justify-between w-full">
            <span class="text-xs font-bold text-white">${m.name}</span>
            <span class="text-[10px] font-mono text-slate-400">#${m.id}</span>
          </div>
          <span class="text-[11px] text-slate-400 block mt-0.5">${m.desc}</span>
        </div>
      </button>
    `).join('');
    grid.querySelectorAll('.mode-card').forEach(c => {
      c.addEventListener('click', () => applyModeSelection(Number(c.dataset.modeId), true));
    });
  }

  function renderEffectPalette() {
    const container = document.getElementById('effectPaletteList');
    container.innerHTML = state.effectPalette.map((c, idx) => {
      const hex = rgbToHex(c.r, c.g, c.b);
      return `
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
          <input type="color" data-pidx="${idx}" value="${hex}" class="palette-color-input w-6 h-6 rounded-md bg-transparent border-0 cursor-pointer" />
          <span class="text-[10px] font-mono text-slate-300">${hex}</span>
          ${state.effectPalette.length > 1 ? `<button type="button" data-pidx="${idx}" class="palette-del-btn text-slate-500 hover:text-rose-400 text-xs px-1 cursor-pointer">×</button>` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.palette-color-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const rgb = hexToRgb(inp.value);
        if (rgb) {
          state.effectPalette[Number(inp.dataset.pidx)] = rgb;
          renderEffectPalette();
          if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
        }
      });
    });

    container.querySelectorAll('.palette-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.effectPalette.splice(Number(btn.dataset.pidx), 1);
        renderEffectPalette();
        if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
      });
    });
  }

  // Graffiti Painter
  let isPaintingPixels = false;

  function paintPixelAt(index) {
    if (index < 0 || index >= state.pixels.length) return;
    state.pixels[index] = {
      r: state.r, g: state.g, b: state.b,
      mode: state.graffitiMode, speed: state.graffitiSpeed
    };
    const cell = document.querySelector(`.pixel-cell[data-px="${index}"]`);
    if (cell) cell.style.backgroundColor = rgbToHex(state.r, state.g, state.b);
    if (state.modeId !== 999) applyModeSelection(999, false);
    if (state.graffitiLiveSend) {
      bleQueue.enqueueSteps(Commands.graffitiPixel(index, state.r, state.g, state.b, {
        isSingle: true, mode: state.graffitiMode, speed: state.graffitiSpeed, brightness: state.brightness
      }));
    }
  }

  function renderGraffitiGrid() {
    const grid = document.getElementById('graffitiPixelGrid');
    const maxRender = Math.min(state.ledCount, 150);
    grid.innerHTML = state.pixels.slice(0, maxRender).map((px, i) => `
      <button type="button" data-px="${i}" title="LED #${i + 1}"
        class="pixel-cell h-7 rounded-lg border border-white/15 transition-transform active:scale-90 cursor-crosshair flex items-center justify-center text-[9px] font-mono text-white/60"
        style="background-color: ${rgbToHex(px.r, px.g, px.b)};">
        ${i + 1}
      </button>
    `).join('');

    grid.querySelectorAll('.pixel-cell').forEach(cell => {
      const idx = Number(cell.dataset.px);
      cell.addEventListener('pointerdown', e => { e.preventDefault(); isPaintingPixels = true; paintPixelAt(idx); });
      cell.addEventListener('pointerenter', () => { if (isPaintingPixels) paintPixelAt(idx); });
    });
  }
  window.addEventListener('pointerup', () => { isPaintingPixels = false; });

  // 60 FPS Strip Canvas Preview
  const ledCanvas = document.getElementById('ledStripCanvas');
  const ledCtx = ledCanvas.getContext('2d');
  let ledW = 600, ledH = 60;

  function resizeLedCanvas() {
    const wrapper = document.getElementById('ledCanvasWrapper');
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ledW = Math.max(200, Math.floor(rect.width || 600));
    ledH = Math.max(44, Math.floor(rect.height || 60));
    ledCanvas.width = ledW * dpr;
    ledCanvas.height = ledH * dpr;
    ledCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function samplePalette(tNorm) {
    const pal = state.effectPalette;
    if (!pal || pal.length === 0) return { r: state.r, g: state.g, b: state.b };
    if (pal.length === 1) return pal[0];
    const scaled = ((tNorm % 1) + 1) % 1 * pal.length;
    const i0 = Math.floor(scaled) % pal.length;
    const i1 = (i0 + 1) % pal.length;
    const f = scaled - Math.floor(scaled);
    return {
      r: Math.round(pal[i0].r + (pal[i1].r - pal[i0].r) * f),
      g: Math.round(pal[i0].g + (pal[i1].g - pal[i0].g) * f),
      b: Math.round(pal[i0].b + (pal[i1].b - pal[i0].b) * f)
    };
  }

  function startLedCanvasAnimation() {
    function render(nowMs) {
      ledCtx.clearRect(0, 0, ledW, ledH);
      ledCtx.fillStyle = '#04060a';
      ledCtx.fillRect(0, 0, ledW, ledH);

      const displayLeds = Math.max(14, Math.min(64, state.ledCount));
      const padX = 16;
      const step = (ledW - padX * 2) / displayLeds;
      const ledR = Math.max(3, Math.min(7.5, step * 0.35));
      const cy = ledH / 2;
      const speedFactor = 0.25 + (state.speed / 100) * 2.8;
      const dir = state.reverse ? -1 : 1;
      const t = (nowMs / 1000) * speedFactor * dir;
      const bright = state.isOn ? (0.1 + (state.brightness / 100) * 0.9) : 0;

      for (let i = 0; i < displayLeds; i++) {
        const cx = padX + step * (i + 0.5);
        const pos = i / Math.max(1, displayLeds - 1);
        let r = state.r, g = state.g, b = state.b;

        if (!state.isOn || state.brightness === 0) {
          r = 22; g = 28; b = 42;
        } else if (state.modeId === 999) {
          const pxIdx = Math.min(state.pixels.length - 1, Math.floor((i / displayLeds) * state.pixels.length));
          const px = state.pixels[pxIdx] || { r: 0, g: 0, b: 0, mode: 2 };
          r = px.r; g = px.g; b = px.b;
          if (px.mode === 0) {
            const on = Math.sin(nowMs / 160) > 0 ? 1 : 0.1;
            r *= on; g *= on; b *= on;
          } else if (px.mode === 1) {
            const k = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(nowMs / 400));
            r *= k; g *= k; b *= k;
          }
          r = Math.round(r * bright); g = Math.round(g * bright); b = Math.round(b * bright);
        } else {
          if (state.modeId === 0) {
            if (state.useDualColor) {
              r = Math.round(state.r + (state.r2 - state.r) * pos);
              g = Math.round(state.g + (state.g2 - state.g) * pos);
              b = Math.round(state.b + (state.b2 - state.b) * pos);
            }
          } else if (state.modeId === 4) {
            const c = samplePalette(pos + t * 0.15);
            const on = Math.sin(Math.abs(t) * 14) > 0 ? 1 : 0.05;
            r = c.r * on; g = c.g * on; b = c.b * on;
          } else if (state.modeId === 5) {
            const c = samplePalette(pos + t * 0.1);
            const k = 0.1 + 0.9 * (0.5 + 0.5 * Math.sin(Math.abs(t) * 2.5));
            r = c.r * k; g = c.g * k; b = c.b * k;
          } else {
            const c = samplePalette(pos - t * (0.25 + state.modeId * 0.04));
            r = c.r; g = c.g; b = c.b;
          }
          r = Math.round(r * bright); g = Math.round(g * bright); b = Math.round(b * bright);
        }

        if (state.isOn && state.brightness > 0 && (r + g + b) > 10) {
          const glowR = ledR * 2.6;
          const grad = ledCtx.createRadialGradient(cx, cy, ledR * 0.2, cx, cy, glowR);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.72)`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ledCtx.fillStyle = grad;
          ledCtx.beginPath();
          ledCtx.arc(cx, cy, glowR, 0, Math.PI * 2);
          ledCtx.fill();
        }

        ledCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ledCtx.beginPath();
        ledCtx.arc(cx, cy, ledR, 0, Math.PI * 2);
        ledCtx.fill();
      }
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  // Diagnostic Log
  function logDiagnostic(message, isWarn = false) {
    appendPacketLog({ dir: isWarn ? 'WARN' : 'DIAG', label: isWarn ? 'ВНИМАНИЕ' : 'INFO', desc: message });
  }

  function appendPacketLog(entry) {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    state.packetLogs.unshift({ time, ...entry });
    if (state.packetLogs.length > 100) state.packetLogs.pop();
    const countStr = String(state.packetLogs.length);
    document.getElementById('packetCounterBadge').textContent = countStr;
    const hdrCount = document.getElementById('headerLogCount');
    if (hdrCount) hdrCount.textContent = countStr;

    const liveText = document.getElementById('liveDiagText');
    if (liveText) {
      liveText.textContent = `[${time}] ${entry.label}: ${entry.desc}`;
      liveText.className = entry.dir === 'WARN'
        ? 'text-amber-300 truncate'
        : (entry.dir === 'RX' ? 'text-emerald-300 truncate' : 'text-slate-300 truncate');
    }
    renderPacketLogs();
  }

  function renderPacketLogs() {
    const list = document.getElementById('packetLogList');
    if (state.packetLogs.length === 0) {
      list.innerHTML = '<div class="text-slate-500 text-center py-8">Журнал пуст. Нажмите «Подключить».</div>';
      return;
    }
    list.innerHTML = state.packetLogs.map(item => {
      if (item.dir === 'DIAG' || item.dir === 'WARN') {
        const badge = item.dir === 'WARN' ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300';
        return `<div class="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
          <div class="flex items-center gap-1.5"><span class="text-slate-500">${item.time}</span><span class="px-1.5 py-0.5 rounded font-semibold ${badge}">${item.label}</span></div>
          <div class="text-[11px] text-slate-300 break-words">${item.desc}</div>
        </div>`;
      }
      const dirBadge = item.dir === 'TX'
        ? `<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold">TX → ${item.charTag}</span>`
        : `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">RX ← ${item.charTag}</span>`;
      return `<div class="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
        <div class="flex flex-wrap items-center gap-1.5"><span class="text-slate-500">${item.time}</span>${dirBadge}<span class="text-white font-semibold">${item.label}</span><span class="text-slate-400">(${item.desc})</span></div>
        <div class="grid grid-cols-1 gap-0.5 text-[10px] sm:text-[11px] break-all">
          <div><span class="text-slate-500">RAW: </span><span class="text-slate-300">${item.rawHex}</span></div>
          <div><span class="text-slate-500">AES: </span><span class="text-emerald-400">${item.encHex}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const styles = {
      success: 'bg-surface-900/95 border-emerald-400/40 text-emerald-200',
      error:   'bg-surface-900/95 border-rose-400/40 text-rose-200',
      info:    'bg-surface-900/95 border-sky-400/40 text-slate-100'
    };
    toast.className = `pointer-events-auto px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs font-medium transition-all duration-300 translate-y-2 opacity-0 ${styles[type] || styles.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.className = active
        ? 'tab-btn btn-tactile flex-1 min-w-[84px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-white border border-sky-400/40 shadow-lg shadow-sky-500/10 text-xs font-semibold cursor-pointer whitespace-nowrap'
        : 'tab-btn btn-tactile flex-1 min-w-[84px] py-2.5 px-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-transparent text-xs font-medium cursor-pointer whitespace-nowrap';
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.dataset.panel === tabName) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    });
    if (tabName === 'color') setTimeout(resizeAndDrawColorWheel, 15);
  }

  // Event Listeners
  function initEventListeners() {
    document.getElementById('btnCloseErrorBanner').addEventListener('click', () => document.getElementById('globalErrorBanner').classList.add('hidden'));
    document.getElementById('btnConnectAll').addEventListener('click', () => connectBle(false));
    document.getElementById('btnConnectIsp').addEventListener('click', () => connectBle(true));
    document.getElementById('btnDisconnect').addEventListener('click', disconnectBle);
    document.getElementById('btnOpenLogsQuick').addEventListener('click', () => switchTab('settings'));

    const modal = document.getElementById('homeGuideModal');
    document.getElementById('btnOpenHomeGuide').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('btnCloseHomeGuide').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    document.getElementById('btnCopyBluefyUrl').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('bluefy://open?url=https://led.mriamys.site');
        showToast('Ссылка для Bluefy скопирована', 'success');
      } catch {
        showToast('Скопируйте ссылку вручную', 'error');
      }
    });

    document.getElementById('btnCopySiteUrl')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('https://led.mriamys.site');
        showToast('Адрес сайта скопирован', 'success');
      } catch {}
    });

    document.getElementById('btnCancelConnect')?.addEventListener('click', () => {
      connectAttemptId++;
      if (state.bleDevice?.gatt?.connected) state.bleDevice.gatt.disconnect();
      logDiagnostic('Подключение сброшено пользователем', true);
      updateConnectionStatus('disconnected');
    });

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    document.getElementById('btnPower').addEventListener('click', () => applyPowerChange(!state.isOn, true));
    document.getElementById('brightnessSlider').addEventListener('input', e => applyBrightnessChange(Number(e.target.value), true));
    document.querySelectorAll('.brightness-preset').forEach(b => b.addEventListener('click', () => applyBrightnessChange(Number(b.dataset.brightness), true)));

    wheelCanvas.addEventListener('pointerdown', e => { wheelCanvas.setPointerCapture?.(e.pointerId); updateWheelFromPoint(e.clientX, e.clientY, true); });
    wheelCanvas.addEventListener('pointermove', e => { if (wheelDragTarget) updateWheelFromPoint(e.clientX, e.clientY, false); });
    wheelCanvas.addEventListener('pointerup', e => { wheelDragTarget = null; wheelCanvas.releasePointerCapture?.(e.pointerId); });
    wheelCanvas.addEventListener('touchstart', e => { if (e.touches[0]) { e.preventDefault(); updateWheelFromPoint(e.touches[0].clientX, e.touches[0].clientY, true); } }, { passive: false });
    wheelCanvas.addEventListener('touchmove', e => { if (wheelDragTarget && e.touches[0]) { e.preventDefault(); updateWheelFromPoint(e.touches[0].clientX, e.touches[0].clientY, false); } }, { passive: false });
    wheelCanvas.addEventListener('touchend', () => { wheelDragTarget = null; });

    ['R', 'G', 'B'].forEach(ch => {
      const slider = document.getElementById(`slider${ch}`);
      const num = document.getElementById(`num${ch}`);
      slider.addEventListener('input', () => applyColorChange(
        ch === 'R' ? Number(slider.value) : state.r,
        ch === 'G' ? Number(slider.value) : state.g,
        ch === 'B' ? Number(slider.value) : state.b,
        true, true
      ));
      num.addEventListener('change', () => {
        const v = Math.max(0, Math.min(255, Number(num.value) || 0));
        applyColorChange(ch === 'R' ? v : state.r, ch === 'G' ? v : state.g, ch === 'B' ? v : state.b, true, true);
      });
    });

    const hexInput = document.getElementById('hexInput');
    hexInput.addEventListener('change', () => {
      const rgb = hexToRgb(hexInput.value);
      if (rgb) applyColorChange(rgb.r, rgb.g, rgb.b, true, true);
      else hexInput.value = rgbToHex(state.r, state.g, state.b);
    });

    document.getElementById('btnSaveFavorite').addEventListener('click', () => {
      const hex = rgbToHex(state.r, state.g, state.b);
      if (state.favorites.some(f => f.hex === hex)) return showToast(`Цвет ${hex} уже сохранён`);
      state.favorites.unshift({ hex, r: state.r, g: state.g, b: state.b });
      if (state.favorites.length > 16) state.favorites.pop();
      saveFavorites(); renderFavorites();
      showToast(`Цвет ${hex} сохранён`, 'success');
    });

    document.getElementById('dualColorToggle').addEventListener('change', e => {
      state.useDualColor = e.target.checked;
      document.getElementById('dualColorWrap').classList.toggle('hidden', !state.useDualColor);
      sendCurrentColorBle();
    });
    document.getElementById('dualColorPicker').addEventListener('input', e => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) { state.r2 = rgb.r; state.g2 = rgb.g; state.b2 = rgb.b; sendCurrentColorBle(); }
    });
    document.getElementById('fiveBitToggle').addEventListener('change', e => {
      state.fiveBitSafe = e.target.checked;
      sendCurrentColorBle();
    });

    // Effects
    document.getElementById('speedSlider').addEventListener('input', e => applySpeedChange(Number(e.target.value), true));
    document.getElementById('reverseToggle').addEventListener('change', e => {
      state.reverse = e.target.checked;
      if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
    });
    document.getElementById('btnAddPaletteColor').addEventListener('click', () => {
      if (state.effectPalette.length >= 7) return showToast('Максимум 7 цветов в эффекте', 'error');
      state.effectPalette.push({ r: state.r, g: state.g, b: state.b });
      renderEffectPalette();
      if (state.modeId >= 1 && state.modeId <= 11) sendCurrentEffectBle();
    });
    document.querySelectorAll('.palette-preset-btn').forEach(b => b.addEventListener('click', () => {
      const p = PALETTE_PRESETS[b.dataset.preset];
      if (p) {
        state.effectPalette = p.map(c => ({ ...c }));
        renderEffectPalette();
        if (state.modeId === 0 || state.modeId === 999) applyModeSelection(1, true);
        else sendCurrentEffectBle();
      }
    }));

    // Random & Scheduler
    const syncIntervalInputs = () => {
      const valEl = document.getElementById('randomIntervalValue');
      const unitEl = document.getElementById('randomIntervalUnit');
      if (state.randomIntervalSec >= 60 && state.randomIntervalSec % 60 === 0) {
        unitEl.value = 'min';
        valEl.value = state.randomIntervalSec / 60;
      } else {
        unitEl.value = 'sec';
        valEl.value = state.randomIntervalSec;
      }
    };

    const updateIntervalFromInputs = () => {
      const v = Math.max(1, Number(document.getElementById('randomIntervalValue').value) || 30);
      const u = document.getElementById('randomIntervalUnit').value;
      state.randomIntervalSec = Math.max(3, u === 'min' ? v * 60 : v);
      state.randomNextSwitchAt = state.randomEnabled ? Date.now() + state.randomIntervalSec * 1000 : 0;
      saveAutomationConfig();
    };

    document.getElementById('randomEnabledToggle').addEventListener('change', e => {
      state.randomEnabled = e.target.checked;
      saveAutomationConfig();
      if (state.randomEnabled) {
        state.randomNextSwitchAt = Date.now() + state.randomIntervalSec * 1000;
        triggerRandomStep(false);
        showToast(`Рандом включён (каждые ${state.randomIntervalSec} сек)`, 'success');
      } else {
        showToast('Рандом выключен', 'info');
      }
      runAutomationTick();
    });

    document.getElementById('btnRandomNextNow').addEventListener('click', () => triggerRandomStep(true));

    document.querySelectorAll('.random-interval-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.randomIntervalSec = Number(b.dataset.sec);
        syncIntervalInputs();
        state.randomNextSwitchAt = state.randomEnabled ? Date.now() + state.randomIntervalSec * 1000 : 0;
        saveAutomationConfig();
        runAutomationTick();
        showToast(`Интервал: ${b.textContent.trim()}`, 'info');
      });
    });

    document.getElementById('randomIntervalValue').addEventListener('change', updateIntervalFromInputs);
    document.getElementById('randomIntervalUnit').addEventListener('change', updateIntervalFromInputs);
    document.getElementById('randomKindSelect').addEventListener('change', e => {
      state.randomKind = e.target.value;
      saveAutomationConfig();
    });
    document.getElementById('randomSpeedReverseToggle').addEventListener('change', e => {
      state.randomSpeedReverse = e.target.checked;
      saveAutomationConfig();
    });

    document.getElementById('schedOnEnabled').addEventListener('change', e => {
      state.schedOnEnabled = e.target.checked;
      saveAutomationConfig();
      runAutomationTick();
    });
    document.getElementById('schedOnTime').addEventListener('change', e => {
      state.schedOnTime = e.target.value || '09:00';
      state.lastTriggeredOnMinute = '';
      saveAutomationConfig();
      runAutomationTick();
    });
    document.getElementById('schedOnAction').addEventListener('change', e => {
      state.schedOnAction = e.target.value;
      saveAutomationConfig();
    });
    document.getElementById('schedOffEnabled').addEventListener('change', e => {
      state.schedOffEnabled = e.target.checked;
      saveAutomationConfig();
      runAutomationTick();
    });
    document.getElementById('schedOffTime').addEventListener('change', e => {
      state.schedOffTime = e.target.value || '21:00';
      state.lastTriggeredOffMinute = '';
      saveAutomationConfig();
      runAutomationTick();
    });

    document.querySelectorAll('.sleep-preset-btn').forEach(b => {
      b.addEventListener('click', () => {
        const mins = Number(b.dataset.min);
        state.sleepOffAt = Date.now() + mins * 60 * 1000;
        runAutomationTick();
        showToast(`Лента выключится через ${mins} мин`, 'success');
      });
    });
    document.getElementById('sleepCancelBtn').addEventListener('click', () => {
      state.sleepOffAt = 0;
      runAutomationTick();
      showToast('Таймер сна отменён', 'info');
    });
    document.getElementById('wakeLockToggle').addEventListener('change', e => setWakeLock(e.target.checked));

    // Graffiti
    document.getElementById('graffitiModeSelect').addEventListener('change', e => { state.graffitiMode = Number(e.target.value); });
    document.getElementById('graffitiSpeedSlider').addEventListener('input', e => {
      state.graffitiSpeed = Number(e.target.value);
      document.getElementById('graffitiSpeedLabel').textContent = `${state.graffitiSpeed}%`;
    });
    document.getElementById('graffitiLiveToggle').addEventListener('change', e => { state.graffitiLiveSend = e.target.checked; });

    document.getElementById('btnGraffitiFlood').addEventListener('click', () => {
      state.pixels.forEach(p => { p.r = state.r; p.g = state.g; p.b = state.b; p.mode = state.graffitiMode; p.speed = state.graffitiSpeed; });
      renderGraffitiGrid();
      applyModeSelection(999, false);
      bleQueue.enqueueSteps(Commands.graffitiPixel(state.ledCount, state.r, state.g, state.b, {
        isSingle: false, mode: state.graffitiMode, speed: state.graffitiSpeed, brightness: state.brightness
      }));
    });
    document.getElementById('btnGraffitiRainbow').addEventListener('click', () => {
      const n = state.pixels.length;
      for (let i = 0; i < n; i++) {
        const rgb = hsvToRgb((i / Math.max(1, n)) * 360, 1, 1);
        state.pixels[i] = { ...rgb, mode: state.graffitiMode, speed: state.graffitiSpeed };
      }
      renderGraffitiGrid();
      applyModeSelection(999, false);
      showToast('Радуга нарисована — нажмите «Применить весь рисунок»', 'info');
    });
    document.getElementById('btnGraffitiClear').addEventListener('click', () => {
      state.pixels.forEach(p => { p.r = 0; p.g = 0; p.b = 0; });
      renderGraffitiGrid();
      applyModeSelection(999, false);
      bleQueue.enqueueSteps(Commands.graffitiPixel(state.ledCount, 0, 0, 0, {
        isSingle: false, mode: 2, speed: 50, brightness: 0
      }));
    });
    document.getElementById('btnBulkPaintSend').addEventListener('click', () => {
      applyModeSelection(999, false);
      const steps = Commands.bulkPaint(state.pixels, { fiveBitSafe: state.fiveBitSafe, brightness: state.brightness });
      bleQueue.enqueueSteps(steps, 'BULK');
      showToast(`Отправка рисунка (${steps.length} пакетов)...`, 'success');
    });

    // Settings
    document.getElementById('protocolSelect').addEventListener('change', e => {
      state.protocolMode = e.target.value;
      updateProtocolBadge();
      showToast(`Протокол: ${activeProtocol()}`, 'info');
    });
    document.querySelectorAll('.ledcount-preset').forEach(b => b.addEventListener('click', () => applyLedCount(Number(b.dataset.ledcount), true)));
    document.getElementById('btnApplyLedCount').addEventListener('click', () => applyLedCount(Number(document.getElementById('ledCountInput').value) || 60, true));
    document.getElementById('btnQueryVersion').addEventListener('click', () => bleQueue.enqueueSteps(Commands.getVersion()));
    document.getElementById('btnSyncTime').addEventListener('click', () => bleQueue.enqueueSteps(Commands.syncTime()));

    document.querySelectorAll('.rgb-order-btn').forEach(b => b.addEventListener('click', () => {
      const val = Number(b.dataset.order);
      state.rgbOrder = val;
      document.getElementById('rgbOrderBadge').textContent = `${val}: ${RGB_ORDERS[val]}`;
      bleQueue.enqueueSteps(Commands.legacyRgbOrder(val), 'RGB');
    }));

    document.getElementById('btnClearLog').addEventListener('click', () => {
      state.packetLogs = [];
      document.getElementById('packetCounterBadge').textContent = '0';
      document.getElementById('headerLogCount').textContent = '0';
      renderPacketLogs();
    });
    document.getElementById('btnCopyLog').addEventListener('click', async () => {
      if (state.packetLogs.length === 0) return showToast('Журнал пуст');
      const txt = state.packetLogs.map(p => p.rawHex
        ? `[${p.time}] ${p.dir} ${p.label} (${p.desc}) | RAW: ${p.rawHex} | AES: ${p.encHex}`
        : `[${p.time}] ${p.dir} ${p.label}: ${p.desc}`
      ).join('\n');
      try { await navigator.clipboard.writeText(txt); showToast('Журнал скопирован', 'success'); }
      catch { showToast('Скопируйте вручную из окна журнала', 'error'); }
    });

    window.addEventListener('resize', () => { resizeLedCanvas(); resizeAndDrawColorWheel(); });
    syncIntervalInputs();
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!('bluetooth' in navigator)) {
      document.getElementById('unsupportedBanner').classList.remove('hidden');
    }

    const aesRes = selfTest();
    const badge = document.getElementById('aesStatusBadge');
    if (aesRes.ok) {
      badge.textContent = 'AES-128-ECB: OK';
      badge.className = 'text-emerald-400';
    } else {
      badge.textContent = 'AES-128-ECB: ERR';
      badge.className = 'text-rose-400';
      showGlobalError('Ошибка шифрования AES-128-ECB');
    }

    loadAutomationConfig();
    initPixelsArray(state.ledCount);
    renderPresetColors();
    renderModesGrid();
    renderEffectPalette();
    renderRandomEffectPool();
    renderGraffitiGrid();
    loadFavorites();
    initEventListeners();

    // Hydrate Automation UI
    document.getElementById('randomEnabledToggle').checked = state.randomEnabled;
    document.getElementById('randomKindSelect').value = state.randomKind;
    document.getElementById('randomSpeedReverseToggle').checked = state.randomSpeedReverse;
    document.getElementById('schedOnEnabled').checked = state.schedOnEnabled;
    document.getElementById('schedOnTime').value = state.schedOnTime;
    document.getElementById('schedOnAction').value = state.schedOnAction;
    document.getElementById('schedOffEnabled').checked = state.schedOffEnabled;
    document.getElementById('schedOffTime').value = state.schedOffTime;

    applyPowerChange(true, false);
    applyColorChange(0, 212, 255, true, false);
    applyBrightnessChange(80, false);
    applySpeedChange(50, false);
    applyModeSelection(0, false);
    updateProtocolBadge();

    resizeLedCanvas();
    resizeAndDrawColorWheel();
    startLedCanvasAnimation();

    setInterval(runAutomationTick, 1000);
    runAutomationTick();
  });
})();
