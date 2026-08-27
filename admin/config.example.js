/**
 * Copy this file to config.js and fill in your Supabase project values.
 * Do not commit real secrets if the repo is public — anon key is public-safe
 * but keep service-role keys only in Edge Function secrets.
 */
window.ADMIN_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY",
  /** Optional override; defaults to SUPABASE_URL/functions/v1/drive-upload */
  DRIVE_UPLOAD_URL: ""
};
