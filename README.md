# Gelecek Kasası (lockeduntil)

Gelecek Kasası, önemli bilgilerinizi belirlediğiniz tarihe kadar kimsenin açamayacağı şekilde koruyan hafif bir zaman kilitli kasa uygulamasıdır. Veriler AES-256-GCM ile şifrelenir, Google Cloud KMS üzerinden anahtar yönetimi yapılır ve Firestore'da güvenle saklanır.

## Özellikler

- 🔐 **Zaman kilidi:** Her mesaj için açılma tarihini belirleyebilirsiniz.
- 🗝️ **Çift parola sistemi:** Kayıt sahibi ve görüntüleyici için iki ayrı parola üretilir.
- ☁️ **Bulut destekli altyapı:** Firestore ve KMS ile ölçeklenebilir güvenlik.
- 🌐 **Web arayüzü ve API:** `server/public` altındaki sayfalar veya REST API ile etkileşim.

## Başlangıç

```
cd server
npm install
npm start
```

Sunucu varsayılan olarak `8080` portunu dinler.

KMS ve Firestore yapılandırması için aşağıdaki ortam değişkenlerini tanımlamanız gerekir:

```
GOOGLE_CLOUD_PROJECT  # Google Cloud proje kimliği
KMS_LOCATION          # Varsayılan: europe-west1
KMS_KEYRING           # KMS anahtar halkası
KMS_KEYNAME           # KMS anahtar adı
```

## Lisans

MIT

