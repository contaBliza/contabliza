// =============================
// ContaBliza — app.js (Fase 4) — PATCH 2026-01-27

/* =====================================================
   COMPATIBILIDAD / FALLBACKS
   ===================================================== */
(function ensureUUID(){
  // Fallback si el navegador no soporta crypto.randomUUID()
  if(typeof crypto === "undefined") return;
  if(!crypto.randomUUID){
    crypto.randomUUID = function(){
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
})();

const CB_KEYS = {
  SESSION: "contabliza_session",
  SESSION_TEMP: "contabliza_session_temp",
  REMEMBER: "contabliza_remember_me",
  NOTIFICATIONS: "contabliza_notifications"
};

// Compatibilidad: sesiones guardadas antes del checkbox "Recordarme".
(function cbMigrateRememberLegacy(){
  try{
    if(localStorage.getItem(CB_KEYS.SESSION) && localStorage.getItem(CB_KEYS.REMEMBER) === null){
      localStorage.setItem(CB_KEYS.REMEMBER, "1");
    }
  }catch{}
})();

/* =====================================================
   SESIÓN: GUARD + HELPERS
   ===================================================== */
function cbGetSession(){
  try{
    const raw = localStorage.getItem(CB_KEYS.SESSION) || sessionStorage.getItem(CB_KEYS.SESSION_TEMP);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function cbIsLogged(){
  const s = cbGetSession();
  return !!(s && (s.user || s.idNumber));
}

async function cbGetSupabaseSession(){
  try{
    if(!window.cbSupabase) return null;
    const { data, error } = await window.cbSupabase.auth.getSession();
    if(error) throw error;
    return data?.session || null;
  }catch(error){
    console.warn("Supabase session error:", error);
    return null;
  }
}

async function cbRequireSession(){
  // Si estás en /pages/ (o cualquier html interno) y no hay sesión, redirige a login
  const path = (location.pathname || "").toLowerCase();
  const isIndex = path.endsWith("/index.html") || path.endsWith("/");

  // Consideramos internas a: /pages/*.html (ajustá si tu carpeta cambia)
  const isInternal = path.includes("/pages/");

  if(isIndex || !isInternal || cbIsLogged()) return;

  const supabaseSession = await cbGetSupabaseSession();
  if(!supabaseSession){
    location.href = "../index.html";
  }
}

/* =====================================================
   NAVBAR / LOGOUT (opcional)
   ===================================================== */
function cbWireLogout(){
  const buttons = [
    document.getElementById("btnLogout"),
    ...Array.from(document.querySelectorAll("[data-action='logout']"))
  ].filter(Boolean);

  if(!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem(CB_KEYS.SESSION);
      localStorage.removeItem(CB_KEYS.REMEMBER);
      sessionStorage.removeItem(CB_KEYS.SESSION_TEMP);
      if(window.cbSupabase){
        window.cbSupabase.auth.signOut().finally(() => {
          location.href = "../index.html";
        });
      }else{
        location.href = "../index.html";
      }
    });
  });
}

function cbWireBack(){
  const btnBack = document.querySelector("[data-nav='back']");
  if(!btnBack) return;

  btnBack.addEventListener("click", (e) => {
    e.preventDefault();
    if(history.length > 1) history.back();
  });
}

function cbWireMenú(){
  const btnMenú = document.querySelector("[data-nav='menu'], [data-nav='Menú']");
  const drawer = document.getElementById("navDrawer");
  if(!btnMenú || !drawer) return;

  const closeDrawer = () => drawer.classList.remove("is-open");

  btnMenú.addEventListener("click", (e) => {
    e.preventDefault();
    drawer.classList.add("is-open");
  });

  drawer.addEventListener("click", (e) => {
    const target = e.target;
    if(target && target.closest("[data-nav='close']")) closeDrawer();
    if(target && target.closest(".nav-drawer-item")) closeDrawer();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeDrawer();
  });
}

function cbEnsureMetasNavItem(){
  const drawerPanel = document.querySelector(".nav-drawer-panel");
  if(!drawerPanel || drawerPanel.querySelector("[data-nav-link='metas']")) return;

  const configLink = Array.from(drawerPanel.querySelectorAll("a.nav-drawer-item"))
    .find(link => (link.getAttribute("href") || "").includes("config.html"));
  const metasLink = document.createElement("a");
  metasLink.className = "nav-drawer-item";
  metasLink.href = "./metas.html";
  metasLink.setAttribute("data-nav-link", "metas");
  metasLink.innerHTML = `
    <span class="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 3v3"></path>
        <path d="M21 12h-3"></path>
      </svg>
    </span>
    <span>Metas</span>
  `;

  if(configLink){
    drawerPanel.insertBefore(metasLink, configLink);
  }else{
    const divider = drawerPanel.querySelector(".nav-drawer-divider");
    drawerPanel.insertBefore(metasLink, divider || null);
  }
}

function cbGetNotificationsCount(){
  try{
    if(typeof getNotifications === "function"){
      return getNotifications().filter(n => !n.read).length;
    }
    const raw = localStorage.getItem(CB_KEYS.NOTIFICATIONS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(n => !n.read).length : 0;
  }catch{
    return 0;
  }
}

function cbUpdateNotificationsBadge(){
  const buttons = Array.from(document.querySelectorAll("[data-action='notifications']"));
  if(!buttons.length) return;

  const count = cbGetNotificationsCount();
  const label = count > 99 ? "99+" : String(count);

  buttons.forEach(btn => {
    let badge = btn.querySelector(".nav-badge");
    if(!badge){
      badge = document.createElement("span");
      badge.className = "nav-badge";
      btn.appendChild(badge);
    }
    badge.textContent = label;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  });
}

function cbFormatDateShort(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(Number.isNaN(d)) return "";
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

function cbEscapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cbGetNotificationsList(){
  try{
    if(typeof getNotifications === "function") return getNotifications();
    const raw = localStorage.getItem(CB_KEYS.NOTIFICATIONS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch{
    return [];
  }
}

function cbEnsureNotificationsPanel(){
  if(document.getElementById("notifPanel")) return;

  const panel = document.createElement("div");
  panel.id = "notifPanel";
  panel.className = "notif-panel";
  panel.innerHTML = `
    <div class="notif-header">
      <span>Notificaciones</span>
      <div class="notif-actions">
        <button class="btn-secondary" id="notifMarkAll" type="button">Leído</button>
        <button class="btn-secondary" id="notifClear" type="button">Limpiar</button>
      </div>
    </div>
    <div class="notif-list" id="notifList"></div>
  `;
  document.body.appendChild(panel);

  const markAllBtn = document.getElementById("notifMarkAll");
  const clearBtn = document.getElementById("notifClear");

  markAllBtn.addEventListener("click", () => {
    if(typeof markAllNotificationsRead === "function"){
      markAllNotificationsRead();
    }else{
      const list = cbGetNotificationsList().map(n => ({ ...n, read: true }));
      localStorage.setItem(CB_KEYS.NOTIFICATIONS, JSON.stringify(list));
      window.dispatchEvent(new Event("cb:notifications-updated"));
    }
  });

  clearBtn.addEventListener("click", () => {
    if(typeof clearNotifications === "function"){
      clearNotifications();
    }else{
      localStorage.removeItem(CB_KEYS.NOTIFICATIONS);
      window.dispatchEvent(new Event("cb:notifications-updated"));
    }
  });
}

function cbRenderNotificationsPanel(){
  cbEnsureNotificationsPanel();
  const listEl = document.getElementById("notifList");
  if(!listEl) return;

  const list = cbGetNotificationsList().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if(!list.length){
    listEl.innerHTML = `<div class="notif-empty">No tienes notificaciones.</div>`;
    return;
  }

  listEl.innerHTML = list.map(n => {
    const title = n.title || "Notificación";
    const meta = cbFormatDateShort(n.createdAt);
    const unread = n.read ? "" : "unread";
    return `
      <div class="notif-item ${unread}" data-notif-id="${cbEscapeHtml(n.id)}">
        <div class="notif-title">${cbEscapeHtml(title)}</div>
        <div class="notif-meta">${cbEscapeHtml(meta)}</div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll("[data-notif-id]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-notif-id");
      if(typeof markNotificationRead === "function"){
        markNotificationRead(id);
      }else{
        const updated = cbGetNotificationsList().map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem(CB_KEYS.NOTIFICATIONS, JSON.stringify(updated));
        window.dispatchEvent(new Event("cb:notifications-updated"));
      }
      const path = (location.pathname || "").toLowerCase();
      const href = path.includes("/pages/") ? "./calendario.html" : "pages/calendario.html";
      location.href = href;
    });
  });
}

function cbToggleNotificationsPanel(forceOpen = null){
  cbEnsureNotificationsPanel();
  const panel = document.getElementById("notifPanel");
  if(!panel) return;
  const open = forceOpen === null ? !panel.classList.contains("is-open") : forceOpen;
  panel.classList.toggle("is-open", open);
  if(open) cbRenderNotificationsPanel();
}

function cbWireNotifications(){
  const buttons = Array.from(document.querySelectorAll("[data-action='notifications']"));
  if(!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      cbToggleNotificationsPanel();
    });
  });

  document.addEventListener("click", (e) => {
    const panel = document.getElementById("notifPanel");
    if(!panel || !panel.classList.contains("is-open")) return;
    const target = e.target;
    const clickedBell = target.closest?.("[data-action='notifications']");
    if(clickedBell) return;
    if(!panel.contains(target)){
      cbToggleNotificationsPanel(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape"){
      cbToggleNotificationsPanel(false);
    }
  });
}

// Ejecuta guard y logout hook siempre (no rompe si no aplica)
(function bootGuards(){
  try{ cbRequireSession(); }catch(e){ console.warn("Guard error:", e); }
  try{ cbWireLogout(); }catch(e){ console.warn("Logout hook error:", e); }
  try{ cbWireBack(); }catch(e){ console.warn("Back hook error:", e); }
  try{ cbEnsureMetasNavItem(); }catch(e){ console.warn("Metas nav error:", e); }
  try{ cbWireMenú(); }catch(e){ console.warn("Menú hook error:", e); }
  try{ cbUpdateNotificationsBadge(); }catch(e){ console.warn("Badge error:", e); }
  try{ cbWireNotifications(); }catch(e){ console.warn("Notif hook error:", e); }
})();

document.addEventListener("DOMContentLoaded", () => {
  cbUpdateNotificationsBadge();
});

window.addEventListener("storage", (e) => {
  if(e.key === CB_KEYS.NOTIFICATIONS) cbUpdateNotificationsBadge();
});

window.addEventListener("cb:notifications-updated", () => {
  cbUpdateNotificationsBadge();
  cbRenderNotificationsPanel();
});

// =============================
// ContaBliza — app.js (Fase 4)
// Login + Nuevo Movimiento + Dashboard + Lista + Mayor + Estadísticas
// =============================

// ===========================================\r\n// LOGIN (index.html)\r\n// ===========================================
(function initLogin(){
  const form = document.getElementById("loginForm");
  if(!form) return;

  // Sesion persistente: si ya esta logueado, entra directo al home.
  if(cbIsLogged()){
    window.location.href = "pages/home.html";
    return;
  }

  const forgot = document.getElementById("forgotLink");
  const register = document.getElementById("registerLink");
  const remember = document.getElementById("rememberDevice");
  const submitBtn = form.querySelector("button[type='submit']");
  const loginTitle = document.querySelector(".login-card h2");
  const loginSub = document.querySelector(".login-sub");
  const loginHint = document.querySelector(".login-hint");
  let authMode = "login";

  cbGetSupabaseSession().then((session) => {
    if(session) window.location.href = "pages/home.html";
  });

  if(remember){
    remember.checked = localStorage.getItem(CB_KEYS.REMEMBER) === "1";
  }

  function isEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function getAuthRedirectUrl(){
    return new URL("index.html", window.location.href).href;
  }

  function setAuthMode(mode){
    authMode = mode === "register" ? "register" : "login";
    if(loginTitle) loginTitle.textContent = authMode === "register" ? "Crear cuenta" : "Iniciar sesión";
    if(loginSub) loginSub.textContent = authMode === "register" ? "Registrá tu cuenta en la nube" : "Accedé a tu cuenta";
    if(submitBtn) submitBtn.textContent = authMode === "register" ? "Crear cuenta" : "Ingresar";
    if(register) register.textContent = authMode === "register" ? "Ya tengo cuenta" : "Registrarse";
    if(loginHint){
      loginHint.textContent = authMode === "register"
        ? "Usá un email real y una contraseña de al menos 6 caracteres."
        : "Demo rápida: `admin` / `1234`";
    }
  }

  async function signInWithSupabase(email, pass){
    const { error } = await window.cbSupabase.auth.signInWithPassword({
      email,
      password: pass
    });
    if(error) throw error;
  }

  async function signUpWithSupabase(email, pass, idType, idNumber){
    const { data, error } = await window.cbSupabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          display_name: email.split("@")[0],
          document_type: idType,
          document_number: idNumber
        }
      }
    });
    if(error) throw error;
    return data;
  }

  if(forgot){
    forgot.addEventListener("click", (e) => {
      e.preventDefault();
      const email = document.getElementById("user")?.value.trim() || prompt("Ingresá tu email para recuperar contraseña:");
      if(!email) return;
      if(!window.cbSupabase){
        alert("Supabase no está disponible en este momento.");
        return;
      }
      if(!isEmail(email)){
        alert("Ingresá un email válido.");
        return;
      }
      window.cbSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl()
      })
        .then(({ error }) => {
          if(error) throw error;
          alert("Te enviamos un email para recuperar la contraseña.");
        })
        .catch((error) => {
          alert(error?.message || "No se pudo enviar el email de recuperación.");
        });
    });
  }

  if(register){
    register.addEventListener("click", (e) => {
      e.preventDefault();
      setAuthMode(authMode === "register" ? "login" : "register");
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = document.getElementById("user")?.value.trim() || "";
    const pass = document.getElementById("pass")?.value.trim() || "";
    const idType = document.getElementById("idType")?.value || "";
    const idNumber = document.getElementById("idNumber")?.value.trim() || "";
    const rememberDevice = !!remember?.checked;

    if(!user || !pass || !idType || !idNumber){
      alert("Completa todos los campos.");
      return;
    }

    if(window.cbSupabase && isEmail(user)){
      try{
        if(submitBtn) submitBtn.disabled = true;

        if(authMode === "register"){
          const data = await signUpWithSupabase(user, pass, idType, idNumber);
          if(data?.session){
            window.location.href = "pages/home.html";
          }else{
            alert("Cuenta creada. Revisá tu email para confirmar el registro.");
            setAuthMode("login");
          }
          return;
        }

        await signInWithSupabase(user, pass);
        localStorage.removeItem(CB_KEYS.SESSION);
        localStorage.removeItem(CB_KEYS.REMEMBER);
        sessionStorage.removeItem(CB_KEYS.SESSION_TEMP);
        window.location.href = "pages/home.html";
        return;
      }catch(error){
        alert(error?.message || "No se pudo completar la operación con Supabase.");
        return;
      }finally{
        if(submitBtn) submitBtn.disabled = false;
      }
    }

    if(authMode === "register"){
      alert("Para registrarte en Supabase tenés que usar un email válido.");
      return;
    }

    if(typeof getUsers === "function"){
      const users = getUsers();
      const ok = users.find(u => u.user === user && u.pass === pass);
      if(!ok){
        alert("Usuario o contraseña incorrectos.");
        return;
      }
    }

    const session = { user, idType, idNumber, ts: Date.now() };
    if(rememberDevice){
      localStorage.setItem(CB_KEYS.SESSION, JSON.stringify(session));
      localStorage.setItem(CB_KEYS.REMEMBER, "1");
      sessionStorage.removeItem(CB_KEYS.SESSION_TEMP);
      if(typeof setSession === "function") setSession(session);
    }else{
      sessionStorage.setItem(CB_KEYS.SESSION_TEMP, JSON.stringify(session));
      localStorage.removeItem(CB_KEYS.SESSION);
      localStorage.removeItem(CB_KEYS.REMEMBER);
    }

    window.location.href = "pages/home.html";
  });

  setAuthMode("login");
})();











