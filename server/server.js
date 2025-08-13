// server/server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import { promisify } from 'util';
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

// ── Sağlık kontrolü ───────────────────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  const ok = !!(PROJECT_ID && KEYRING && KEYNAME && kmsKeyPath);
  res.status(200).send(ok ? 'ok' : 'ok (config warning)');
});

// ── API: Kaydet ───────────────────────────────────────────────────────────────
app.post('/api/store', async (req, res) => {
  try {
    const { title = '', secret, unlockDate, email, passphrase } = req.body || {};
    if (!secret || !unlockDate || !email || !passphrase) {
      return res.status(400).json({ error: 'Eksik alan (secret/unlockDate/email/passphrase)' });
    }
    if (!kmsKeyPath) {
      return res.status(500).json({ error: 'Sunucu yapılandırması eksik (KMS anahtarı tanımlı değil).' });
    }

    // 1) Veriyi yerel DEK ile şifrele
    const { key: DEK, iv, ct, tag } = aeadEncrypt(secret);

    // 2) DEK'i KMS ile şifrele → dek_kms (Uint8Array)
    const [encResp] = await kmsClient.encrypt({ name: kmsKeyPath, plaintext: DEK });
    const dek_kms = Buffer.from(encResp.ciphertext); // bu bytes'ı parola ile bir kez daha saracağız

    // 3) Passphrase'ten anahtar türet ve dek_kms'i parolayla sar (AES-GCM)
    const { key: pwKey, salt } = await derivePassKey(passphrase);
    const ivPw = crypto.randomBytes(12);
    const cipherPw = crypto.createCipheriv('aes-256-gcm', pwKey, ivPw);
    const dekPwCt = Buffer.concat([cipherPw.update(dek_kms), cipherPw.final()]);
    const tagPw = cipherPw.getAuthTag();

    // 4) Firestore'a yaz
    const id = genId();
    await col.doc(id).set({
      email,
      title,
      unlockDate, // "YYYY-MM-DD"
      // veri şifre bloğu
      ciphertext: ct.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      // DEK'in KMS çıktısının parola ile sarılmış hali
      dek_pw: dekPwCt.toString('base64'),
      dek_pw_iv: ivPw.toString('base64'),
      dek_pw_tag: tagPw.toString('base64'),
      dek_pw_salt: salt, // scrypt salt
      createdAt: new Date().toISOString()
    });

    // Not: passphrase'i saklamıyoruz; sadece kullanıcıya geri gösteriyoruz
    res.json({ id, passphrase });
  } catch (e) {
    console.error('POST /api/store error:', e);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── API: Geri al ──────────────────────────────────────────────────────────────
app.post('/api/get/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { passphrase } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID gerekli' });
    if (!passphrase) return res.status(400).json({ error: 'Parola gerekli' });
    if (!kmsKeyPath) {
      return res.status(500).json({ error: 'Sunucu yapılandırması eksik (KMS anahtarı tanımlı değil).' });
    }

    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Bulunamadı' });
    const row = snap.data();

    // Tarih kontrolü
    const now = new Date();
    const rd = new Date((row.unlockDate || '') + 'T00:00:00');
    if (isNaN(rd.getTime())) return res.status(500).json({ error: 'Kayıtlı unlockDate geçersiz.' });
    if (now < rd) return res.status(403).json({ error: 'Henüz erişim tarihi gelmedi' });

    // 1) Passphrase'ten key türet → dek_pw'yi çöz → dek_kms elde et
    if (!row.dek_pw || !row.dek_pw_iv || !row.dek_pw_tag || !row.dek_pw_salt) {
      // Eski kayıt (parola katmanı yok). Güvenlik için erişimi reddedebilir veya geriye dönük uyumluluk sağlayabilirsin.
      return res.status(409).json({ error: 'Bu kayıt eski formatta. Parola koruması yok. Yeniden oluşturman gerekir.' });
    }

    try {
      const { key: pwKey } = await derivePassKey(passphrase, row.dek_pw_salt);
      const decPw = crypto.createDecipheriv('aes-256-gcm', pwKey, Buffer.from(row.dek_pw_iv, 'base64'));
      decPw.setAuthTag(Buffer.from(row.dek_pw_tag, 'base64'));
      const dek_kms = Buffer.concat([
        decPw.update(Buffer.from(row.dek_pw, 'base64')),
        decPw.final()
      ]);

      // 2) KMS.decrypt(dek_kms) → DEK
      const [decResp] = await kmsClient.decrypt({
        name: kmsKeyPath,
        ciphertext: dek_kms
      });
      const DEK = Buffer.from(decResp.plaintext);

      // 3) Veriyi çöz
      const secret = aeadDecrypt(
        DEK,
        Buffer.from(row.iv, 'base64'),
        Buffer.from(row.tag, 'base64'),
        Buffer.from(row.ciphertext, 'base64')
      );

      return res.json({ id, title: row.title, secret, releaseDate: row.unlockDate });
    } catch (e) {
      // Parola yanlışsa AES-GCM auth patlar → buraya düşer
      return res.status(401).json({ error: 'Parola yanlış' });
    }
  } catch (e) {
    console.error('POST /api/get/:id error:', e);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── Listen ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server on', PORT));
