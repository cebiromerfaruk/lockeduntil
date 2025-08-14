// server/server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import { promisify } from 'util';
import dgram from 'dgram';
import { Firestore } from '@google-cloud/firestore';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { customAlphabet } from 'nanoid';

const scryptAsync = promisify(crypto.scrypt);

// ── App setup ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // server/public/encrypt.html & retrieve.html

// ── ENV ────────────────────────────────────────────────────────────────────────
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || '';
const LOCATION   = process.env.KMS_LOCATION || 'europe-west1';
const KEYRING    = process.env.KMS_KEYRING || '';
const KEYNAME    = process.env.KMS_KEYNAME || '';

const kmsClient = new KeyManagementServiceClient();
let kmsKeyPath = null;
try {
  if (PROJECT_ID && KEYRING && KEYNAME) {
    kmsKeyPath = kmsClient.cryptoKeyPath(PROJECT_ID, LOCATION, KEYRING, KEYNAME);
  }
} catch (e) {
  console.error('KMS key path oluşturulamadı:', e);
}

const db = new Firestore();
const col = db.collection('vault');
const genId = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12);

// ── NTP Time ───────────────────────────────────────────────────────────────────
let lastTrustedTime = new Date();

async function fetchNtpTime(host = 'time.google.com', port = 123, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const pkt = Buffer.alloc(48);
    pkt[0] = 0x1b; // LI=0, VN=3, Mode=3 (client)

    const onError = (err) => {
      client.close();
      reject(err);
    };

    client.once('error', onError);
    client.once('message', (msg) => {
      client.close();
      const secs = msg.readUIntBE(40, 4) - 2208988800; // NTP epoch to Unix epoch
      const frac = msg.readUIntBE(44, 4) / 2 ** 32;
      const ms = secs * 1000 + frac * 1000;
      resolve(new Date(ms));
    });

    client.send(pkt, port, host, (err) => {
      if (err) onError(err);
    });

    setTimeout(() => onError(new Error('NTP timeout')), timeout);
  });
}

async function getTrustedTime() {
  try {
    lastTrustedTime = await fetchNtpTime();
    return lastTrustedTime;
  } catch (e) {
    console.error('NTP zaman alınamadı, son bilinen zaman kullanılacak:', e);
    return lastTrustedTime;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function aeadEncrypt(plain) {
  const iv = crypto.randomBytes(12);
  const key = crypto.randomBytes(32); // DEK
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { key, iv, ct, tag };
}

function aeadDecrypt(key, iv, tag, ct) {
  const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(tag);
  const out = Buffer.concat([dec.update(ct), dec.final()]);
  return out.toString('utf8');
}

async function derivePassKey(passphrase, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, 'base64') : crypto.randomBytes(16);
  const key = await scryptAsync(passphrase, salt, 32);
  return { key: Buffer.from(key), salt: salt.toString('base64') };
}

async function wrapDek(dek_kms, passphrase) {
  const { key: pwKey, salt } = await derivePassKey(passphrase);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', pwKey, iv);
  const ct = Buffer.concat([cipher.update(dek_kms), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct: ct.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64'), salt };
}

async function unwrapDek(block, passphrase) {
  const { key: pwKey } = await derivePassKey(passphrase, block.salt);
  const dec = crypto.createDecipheriv('aes-256-gcm', pwKey, Buffer.from(block.iv, 'base64'));
  dec.setAuthTag(Buffer.from(block.tag, 'base64'));
  const dek_kms = Buffer.concat([
    dec.update(Buffer.from(block.ct, 'base64')),
    dec.final()
  ]);
  return dek_kms;
}

function formatDateTR(dateStr) {
  const parts = (dateStr || '').split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

const messages = {
  tr: {
    ID_REQUIRED: 'ID gerekli',
    PASS_REQUIRED: 'Parola gerekli',
    CONFIG_MISSING: 'Sunucu yapılandırması eksik (KMS anahtarı tanımlı değil).',
    NOT_FOUND: 'Bulunamadı',
    PASS_WRONG: 'Parola yanlış',
    INVALID_UNLOCK: 'Kayıtlı unlockDate geçersiz.',
    PASSWORD_AVAILABLE: (date) => `Gizli metin ${formatDateTR(date)} tarihinde çözülebilir`,
    SERVER_ERROR: 'Sunucu hatası',
    DATE_PAST: 'Seçilen tarih geçmişte olmamalı',
    DATE_BEFORE: 'Yeni tarih mevcut tarihten önce olamaz',
    NO_FIELDS: 'Güncellenecek alan yok',
    MISSING_FIELDS: 'Eksik alan (secret/email/masterPass/viewPass)'
  },
  en: {
    ID_REQUIRED: 'ID required',
    PASS_REQUIRED: 'Password required',
    CONFIG_MISSING: 'Server misconfiguration (KMS key not set).',
    NOT_FOUND: 'Not found',
    PASS_WRONG: 'Incorrect password',
    INVALID_UNLOCK: 'Stored unlockDate is invalid.',
    PASSWORD_AVAILABLE: (date) => `Secret text can be decrypted on ${formatDateTR(date)}`,
    SERVER_ERROR: 'Server error',
    DATE_PAST: 'Selected date must not be in the past',
    DATE_BEFORE: 'New date cannot be before the current date',
    NO_FIELDS: 'Nothing to update',
    MISSING_FIELDS: 'Missing fields (secret/email/masterPass/viewPass)'
  }
};

function t(lang, key, ...args) {
  const dict = messages[lang] || messages.tr;
  const val = dict[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ── Sağlık kontrolü ───────────────────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  const ok = !!(PROJECT_ID && KEYRING && KEYNAME && kmsKeyPath);
  res.status(200).send(ok ? 'ok' : 'ok (config warning)');
});

// Güvenilir zamanı istemciye döner
app.get('/api/time', async (req, res) => {
  const now = await getTrustedTime();
  res.json({ now: now.toISOString() });
});

// ── API: Kaydet ───────────────────────────────────────────────────────────────
app.post('/api/store', async (req, res) => {
  try {
    const now = await getTrustedTime();
    const { title = '', secret, unlockDate = null, email, masterPass, viewPass, lang } = req.body || {};
    const L = lang === 'en' ? 'en' : 'tr';
    if (!secret || !email || !masterPass || !viewPass) {
      return res.status(400).json({ error: t(L, 'MISSING_FIELDS') });
    }
    if (!kmsKeyPath) {
      return res.status(500).json({ error: t(L, 'CONFIG_MISSING') });
    }

    if (unlockDate) {
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      const rd = new Date(unlockDate + 'T00:00:00Z');
      if (isNaN(rd.getTime()) || rd < today) {
        return res.status(400).json({ error: t(L, 'DATE_PAST') });
      }
    }

    // 1) Veriyi yerel DEK ile şifrele
    const { key: DEK, iv, ct, tag } = aeadEncrypt(secret);

    // 2) DEK'i KMS ile şifrele → dek_kms (Uint8Array)
    const [encResp] = await kmsClient.encrypt({ name: kmsKeyPath, plaintext: DEK });
    const dek_kms = Buffer.from(encResp.ciphertext); // bu bytes'ı parola ile bir kez daha saracağız

    // 3) DEK'i master ve görüntüleme parolalarıyla ayrı ayrı sar
    const dek_master = await wrapDek(dek_kms, masterPass);
    const dek_view = await wrapDek(dek_kms, viewPass);

    // 4) Firestore'a yaz
    const id = genId();
    await col.doc(id).set({
      email,
      title,
      unlockDate: unlockDate || null, // "YYYY-MM-DD" veya null
      // veri şifre bloğu
      ciphertext: ct.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      // DEK'in KMS çıktısının parolalarla sarılmış halleri
      dek_master,
      dek_view,
      createdAt: now.toISOString()
    });

    // Not: parolaları saklamıyoruz; sadece kullanıcıya geri gösteriyoruz
    res.json({ id, masterPass, viewPass });
  } catch (e) {
    console.error('POST /api/store error:', e);
    res.status(500).json({ error: t(L, 'SERVER_ERROR') });
  }
});

// ── API: Geri al ──────────────────────────────────────────────────────────────
app.post('/api/get/:id', async (req, res) => {
  const { lang } = req.body || {};
  const L = lang === 'en' ? 'en' : 'tr';
  try {
    const id = req.params.id;
    const { passphrase } = req.body || {};
    if (!id) return res.status(400).json({ error: t(L, 'ID_REQUIRED') });
    if (!passphrase) return res.status(400).json({ error: t(L, 'PASS_REQUIRED') });
    if (!kmsKeyPath) {
      return res.status(500).json({ error: t(L, 'CONFIG_MISSING') });
    }

    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: t(L, 'NOT_FOUND') });
    const row = snap.data();
    const now = await getTrustedTime();

    let dek_kms;
    let owner = false;
    try {
      dek_kms = await unwrapDek(row.dek_master, passphrase);
      owner = true;
    } catch (_) {
      try {
        dek_kms = await unwrapDek(row.dek_view, passphrase);
      } catch (e) {
        return res.status(401).json({ error: t(L, 'PASS_WRONG') });
      }
    }

    // Tarih kontrolü (varsa)
    if (row.unlockDate) {
      const rd = new Date(row.unlockDate + 'T00:00:00Z');
      if (isNaN(rd.getTime())) return res.status(500).json({ error: t(L, 'INVALID_UNLOCK') });
      if (now < rd) {
        if (owner) {
          return res.json({ id, unlockDate: row.unlockDate, email: row.email, owner: true, message: t(L, 'PASSWORD_AVAILABLE', row.unlockDate) });
        }
        return res.status(403).json({ error: t(L, 'PASSWORD_AVAILABLE', row.unlockDate) });
      }
    }

    // Tarih kısıtlaması yok veya geçti → veriyi çöz
    const [decResp] = await kmsClient.decrypt({ name: kmsKeyPath, ciphertext: dek_kms });
    const DEK = Buffer.from(decResp.plaintext);
    const secret = aeadDecrypt(
      DEK,
      Buffer.from(row.iv, 'base64'),
      Buffer.from(row.tag, 'base64'),
      Buffer.from(row.ciphertext, 'base64')
    );

    if (owner) {
      return res.json({ id, title: row.title, secret, unlockDate: row.unlockDate, email: row.email, owner: true });
    }
    return res.json({ id, title: row.title, secret });
  } catch (e) {
    console.error('POST /api/get/:id error:', e);
    res.status(500).json({ error: t(L, 'SERVER_ERROR') });
  }
});

// ── API: Güncelle ─────────────────────────────────────────────────────────────
app.post('/api/update/:id', async (req, res) => {
  const { lang } = req.body || {};
  const L = lang === 'en' ? 'en' : 'tr';
  try {
    const id = req.params.id;
    const { passphrase, unlockDate, email } = req.body || {};
    if (!id) return res.status(400).json({ error: t(L, 'ID_REQUIRED') });
    if (!passphrase) return res.status(400).json({ error: t(L, 'PASS_REQUIRED') });

    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: t(L, 'NOT_FOUND') });
    const row = snap.data();
    const now = await getTrustedTime();

    try {
      await unwrapDek(row.dek_master, passphrase);
    } catch (e) {
      return res.status(401).json({ error: t(L, 'PASS_WRONG') });
    }

    const upd = {};
    if (unlockDate) {
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      const rd = new Date(unlockDate + 'T00:00:00Z');
      if (isNaN(rd.getTime()) || rd < today) {
        return res.status(400).json({ error: t(L, 'DATE_PAST') });
      }
      if (row.unlockDate) {
        const curr = new Date(row.unlockDate + 'T00:00:00Z');
        if (rd < curr) {
          return res.status(400).json({ error: t(L, 'DATE_BEFORE') });
        }
      }
      upd.unlockDate = unlockDate;
    }
    if (email) {
      upd.email = email;
    }
    if (Object.keys(upd).length === 0) {
      return res.status(400).json({ error: t(L, 'NO_FIELDS') });
    }

    await col.doc(id).update(upd);
    res.json({ id, ...upd });
  } catch (e) {
    console.error('POST /api/update/:id error:', e);
    res.status(500).json({ error: t(L, 'SERVER_ERROR') });
  }
});

// ── API: Sil ─────────────────────────────────────────────────────────────
app.post('/api/delete/:id', async (req, res) => {
  const { lang } = req.body || {};
  const L = lang === 'en' ? 'en' : 'tr';
  try {
    const id = req.params.id;
    const { passphrase } = req.body || {};
    if (!id) return res.status(400).json({ error: t(L, 'ID_REQUIRED') });
    if (!passphrase) return res.status(400).json({ error: t(L, 'PASS_REQUIRED') });

    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: t(L, 'NOT_FOUND') });
    const row = snap.data();
    await getTrustedTime(); // zaman eşitlemesi için

    try {
      await unwrapDek(row.dek_master, passphrase);
    } catch (e) {
      return res.status(401).json({ error: t(L, 'PASS_WRONG') });
    }

    await col.doc(id).delete();
    res.json({ id, deleted: true });
  } catch (e) {
    console.error('POST /api/delete/:id error:', e);
    res.status(500).json({ error: t(L, 'SERVER_ERROR') });
  }
});

// ── Listen ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server on', PORT));
