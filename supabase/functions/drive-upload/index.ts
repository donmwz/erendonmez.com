import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Authenticated upload proxy → Google Drive (service account).
 * Secrets: GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/=+/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${signature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenJson.error_description || "Google token failed");
  }
  return tokenJson.access_token as string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: supabaseAnon,
    },
  });
  if (!userRes.ok) {
    return json({ error: "Invalid session" }, 401);
  }

  const saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const folderId = Deno.env.get("DRIVE_FOLDER_ID");
  if (!saRaw || !folderId) {
    return json(
      { error: "Drive secrets missing (GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID)" },
      500
    );
  }

  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(saRaw);
  } catch {
    return json({ error: "Invalid GOOGLE_SERVICE_ACCOUNT_JSON" }, 500);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "file required" }, 400);
  }

  try {
    const accessToken = await getAccessToken(sa);
    const metadata = {
      name: file.name,
      parents: [folderId],
    };
    const boundary = "erendonmez_upload";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metaPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
    const endPart = `\r\n--${boundary}--`;
    const metaBytes = new TextEncoder().encode(metaPart);
    const endBytes = new TextEncoder().encode(endPart);
    const body = new Uint8Array(metaBytes.length + bytes.length + endBytes.length);
    body.set(metaBytes, 0);
    body.set(bytes, metaBytes.length);
    body.set(endBytes, metaBytes.length + bytes.length);

    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    const driveJson = await driveRes.json();
    if (!driveRes.ok) {
      return json(
        { error: driveJson.error?.message || "Drive upload failed" },
        502
      );
    }
    return json({
      id: driveJson.id,
      name: driveJson.name,
      webViewLink: driveJson.webViewLink,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      500
    );
  }
});
