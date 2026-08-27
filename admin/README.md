# Admin paneli kurulumu

Minimal yönetim alanı: Supabase e-posta/şifre girişi + Google Drive’a dosya yükleme.

## 1. Supabase Auth

1. [Supabase](https://supabase.com) projesinde **Authentication → Providers → Email** açık olsun.
2. **Authentication → Users** üzerinden bir admin kullanıcı oluştur.
3. Project Settings → API: `Project URL` ve `anon public` key’i kopyala.
4. `admin/config.example.js` → `admin/config.js` kopyala, değerleri yapıştır.

## 2. Edge Function (Drive upload)

```bash
supabase functions deploy drive-upload
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
supabase secrets set DRIVE_FOLDER_ID='your_folder_id'
```

Google Cloud’da bir service account oluştur, Drive API’yi aç, JSON key indir.
Drive’da hedef klasörü bu service account e-postasına **Editor** olarak paylaş.

## 3. Kullanım

Site kökünde `admin/` yoluna git → giriş yap → dosya yükle.

`admin/config.js` yerel kalabilir; public repoda example kullan, gerçek key’leri hosting env / private config ile yönet.
