/* Admin — Supabase Auth + Drive upload via Edge Function */

(function () {
  const loginView = document.getElementById("loginView");
  const panelView = document.getElementById("panelView");
  const configView = document.getElementById("configView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");
  const fileLabel = document.getElementById("fileLabel");
  const fileDrop = document.getElementById("fileDrop");
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadMsg = document.getElementById("uploadMsg");
  const uploadLog = document.getElementById("uploadLog");

  const cfg = window.ADMIN_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !String(cfg.SUPABASE_URL).includes("YOUR_PROJECT") &&
    cfg.SUPABASE_ANON_KEY !== "YOUR_ANON_KEY";

  if (!configured || !window.supabase) {
    configView.hidden = false;
    return;
  }

  const supabase = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  const uploadUrl =
    cfg.DRIVE_UPLOAD_URL ||
    `${cfg.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/drive-upload`;

  function show(view) {
    loginView.hidden = view !== "login";
    panelView.hidden = view !== "panel";
    configView.hidden = true;
  }

  function setMsg(el, text, type) {
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("error", type === "error");
    el.classList.toggle("ok", type === "ok");
  }

  async function refreshSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      userEmail.textContent = session.user.email || "";
      show("panel");
    } else {
      show("login");
    }
    return session;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(loginError, "");
    loginBtn.disabled = true;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    loginBtn.disabled = false;

    if (error) {
      setMsg(loginError, error.message || "Giriş başarısız.", "error");
      return;
    }
    await refreshSession();
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    show("login");
  });

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    fileLabel.textContent = f ? f.name : "Dosya seç veya sürükle";
  });

  ["dragenter", "dragover"].forEach((ev) => {
    fileDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      fileDrop.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    fileDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      fileDrop.classList.remove("dragover");
    });
  });
  fileDrop.addEventListener("drop", (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      fileInput.files = files;
      fileLabel.textContent = files[0].name;
    }
  });

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(uploadMsg, "");

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setMsg(uploadMsg, "Bir dosya seç.", "error");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      show("login");
      return;
    }

    uploadBtn.disabled = true;
    setMsg(uploadMsg, "Yükleniyor…", "ok");

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: cfg.SUPABASE_ANON_KEY
        },
        body
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || payload.message || `HTTP ${res.status}`);
      }

      setMsg(uploadMsg, "Yükleme tamam.", "ok");
      const li = document.createElement("li");
      const when = new Date().toLocaleString("tr-TR");
      if (payload.webViewLink) {
        li.innerHTML = `${when} — <a href="${payload.webViewLink}" target="_blank" rel="noopener">${file.name}</a>`;
      } else {
        li.textContent = `${when} — ${file.name}`;
      }
      uploadLog.prepend(li);
      uploadForm.reset();
      fileLabel.textContent = "Dosya seç veya sürükle";
    } catch (err) {
      setMsg(
        uploadMsg,
        err.message || "Yükleme başarısız. Edge Function ve Drive secret’larını kontrol et.",
        "error"
      );
    } finally {
      uploadBtn.disabled = false;
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      userEmail.textContent = session.user.email || "";
      show("panel");
    } else {
      show("login");
    }
  });

  refreshSession();
})();
