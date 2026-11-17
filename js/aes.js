/**
 * Pure JavaScript AES-128-ECB (FIPS-197) Encrypt & Decrypt for idealLED BLE protocol.
 */
(function (global) {
  'use strict';

  const IDEALLED_AES_KEY = new Uint8Array([
    0x34, 0x52, 0x2A, 0x5B, 0x7A, 0x6E, 0x49, 0x2C,
    0x08, 0x09, 0x0A, 0x9D, 0x8D, 0x2A, 0x23, 0xF8
  ]);

  const SBOX = new Uint8Array([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ]);

  const INV_SBOX = new Uint8Array(256);
  for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

  const RCON = new Uint8Array([
    0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
  ]);

  function expandKey128(key16) {
    const rk = new Uint8Array(176);
    rk.set(key16.slice(0, 16));
    let bytes = 16;
    let rconIter = 1;
    const temp = new Uint8Array(4);

    while (bytes < 176) {
      for (let i = 0; i < 4; i++) temp[i] = rk[bytes - 4 + i];
      if (bytes % 16 === 0) {
        const t0 = temp[0];
        temp[0] = SBOX[temp[1]] ^ RCON[rconIter++];
        temp[1] = SBOX[temp[2]];
        temp[2] = SBOX[temp[3]];
        temp[3] = SBOX[t0];
      }
      for (let i = 0; i < 4; i++) {
        rk[bytes] = rk[bytes - 16] ^ temp[i];
        bytes++;
      }
    }
    return rk;
  }

  const ROUND_KEYS = expandKey128(IDEALLED_AES_KEY);

  function gmul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return p;
  }

  function encryptBlock(plain16) {
    const s = new Uint8Array(16);
    s.set(plain16.slice(0, 16));
    const rk = ROUND_KEYS;

    for (let i = 0; i < 16; i++) s[i] ^= rk[i];

    for (let round = 1; round <= 9; round++) {
      for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];

      let tmp = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = tmp;
      tmp = s[2]; s[2] = s[10]; s[10] = tmp;
      tmp = s[6]; s[6] = s[14]; s[14] = tmp;
      tmp = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = tmp;

      for (let c = 0; c < 4; c++) {
        const idx = c * 4;
        const a0 = s[idx], a1 = s[idx + 1], a2 = s[idx + 2], a3 = s[idx + 3];
        s[idx]     = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
        s[idx + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
        s[idx + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
        s[idx + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
      }

      const off = round * 16;
      for (let i = 0; i < 16; i++) s[i] ^= rk[off + i];
    }

    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    let tmp = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = tmp;
    tmp = s[2]; s[2] = s[10]; s[10] = tmp;
    tmp = s[6]; s[6] = s[14]; s[14] = tmp;
    tmp = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = tmp;
    for (let i = 0; i < 16; i++) s[i] ^= rk[160 + i];

    return s;
  }

  function decryptBlock(cipher16) {
    const s = new Uint8Array(16);
    s.set(cipher16.slice(0, 16));
    const rk = ROUND_KEYS;

    for (let i = 0; i < 16; i++) s[i] ^= rk[160 + i];

    for (let round = 9; round >= 1; round--) {
      let tmp = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = tmp;
      tmp = s[2]; s[2] = s[10]; s[10] = tmp;
      tmp = s[6]; s[6] = s[14]; s[14] = tmp;
      tmp = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = tmp;

      for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];

      const off = round * 16;
      for (let i = 0; i < 16; i++) s[i] ^= rk[off + i];

      for (let c = 0; c < 4; c++) {
        const idx = c * 4;
        const a0 = s[idx], a1 = s[idx + 1], a2 = s[idx + 2], a3 = s[idx + 3];
        s[idx]     = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
        s[idx + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
        s[idx + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
        s[idx + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
      }
    }

    let tmp = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = tmp;
    tmp = s[2]; s[2] = s[10]; s[10] = tmp;
    tmp = s[6]; s[6] = s[14]; s[14] = tmp;
    tmp = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = tmp;

    for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    for (let i = 0; i < 16; i++) s[i] ^= rk[i];

    return s;
  }

  function bytesToHex(arr) {
    return Array.from(arr)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  function bytesToAscii(arr) {
    return Array.from(arr)
      .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
  }

  function selfTest() {
    const sample = new Uint8Array([0x05, 0x54, 0x55, 0x52, 0x4E, 0x01, 0,0,0,0,0,0,0,0,0,0]);
    const enc = encryptBlock(sample);
    const dec = decryptBlock(enc);
    const matches = sample.every((v, i) => v === dec[i]);
    // Verify against known ciphertext from 8none1/idealLED att_protocol.md:
    // 84dd5042374150897ac82f39110968a8
    const knownHex = '84 DD 50 42 37 41 50 89 7A C8 2F 39 11 09 68 A8';
    return {
      ok: matches && bytesToHex(enc) === knownHex,
      encHex: bytesToHex(enc)
    };
  }

  global.IdealAes = {
    encrypt: encryptBlock,
    decrypt: decryptBlock,
    bytesToHex,
    bytesToAscii,
    selfTest
  };
})(typeof window !== 'undefined' ? window : globalThis);
