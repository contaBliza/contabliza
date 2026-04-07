const STORAGE_KEYS = {
  SESSION: "contabliza_session",
  USERS: "contabliza_users",
  SETTINGS: "contabliza_settings",
  MOVIMIENTOS: "contabliza_movimientos",
  NOTIFICATIONS: "contabliza_notifications"
};
// Migracion de sesion (cb_session -> contabliza_session)
(function migrateSessionKey(){
  try{
    const oldKey = "cb_session";
    const newKey = STORAGE_KEYS.SESSION;
    if(!localStorage.getItem(newKey)){
      const raw = localStorage.getItem(oldKey);
      if(raw){
        localStorage.setItem(newKey, raw);
        localStorage.removeItem(oldKey);
      }
    }
  }catch(e){
    console.warn("Migracion sesion fallida:", e);
  }
})();

// Limpieza de claves viejas
(function purgeDoubleEntryKeys(){
  try{
    ["contabiliza_accounts", "contabiliza_asientos"].forEach((k) => {
      if(localStorage.getItem(k) !== null){
        localStorage.removeItem(k);
      }
    });
  }catch(e){
    console.warn("Limpieza de claves viejas fallida:", e);
  }
})();

/* =============================
   HELPERS BASE
   ============================= */

function load(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    console.error("Error loading storage key:", key, e);
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function remove(key) {
  localStorage.removeItem(key);
}

const DEFAULT_MEDIOS = [
  { id: "caja", name: "Efectivo" },
  { id: "banco", name: "Tarjeta Débito" },
  { id: "tarjeta", name: "Tarjeta de Crédito" }
];

function normalizeMedios(medios) {
  const base = Array.isArray(medios) ? medios : [];
  const legacyMap = {
    caja: "Caja",
    banco: "Banco",
    tarjeta: "Tarjeta"
  };

  return DEFAULT_MEDIOS.map((medio) => {
    const saved = base.find(item => item?.id === medio.id);
    if (!saved) return { ...medio };

    const name = String(saved.name || "").trim();
    if (!name || name === legacyMap[medio.id]) {
      return { ...medio };
    }
    return { id: medio.id, name };
  });
}

/* =============================
   SESSION
   ============================= */

function getSession() {
  const persistent = load(STORAGE_KEYS.SESSION);
  if (persistent) return persistent;
  try {
    const temp = sessionStorage.getItem("contabliza_session_temp");
    return temp ? JSON.parse(temp) : null;
  } catch (e) {
    console.warn("Error loading temporary session:", e);
    return null;
  }
}

function setSession(user) {
  save(STORAGE_KEYS.SESSION, user);
}

function clearSession() {
  remove(STORAGE_KEYS.SESSION);
}

/* =============================
   USERS (demo / base)
   ============================= */

function getUsers() {
  return load(STORAGE_KEYS.USERS, []);
}

function saveUsers(users) {
  save(STORAGE_KEYS.USERS, users);
}

/* Seed inicial */
(function seedUsers() {
  const users = getUsers();
  if (users.length === 0) {
    saveUsers([
      {
        id: 1,
        user: "admin",
        pass: "1234",
        nombre: "Administrador"
      }
    ]);
  }
})();

/* =============================
   NOTIFICACIONES
   ============================= */

function getNotifications() {
  return load(STORAGE_KEYS.NOTIFICATIONS, []);
}

function saveNotifications(list) {
  save(STORAGE_KEYS.NOTIFICATIONS, list);
}

function addNotification(item) {
  const list = getNotifications();
  list.push({
    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    title: item?.title || "Notificacion",
    createdAt: new Date().toISOString(),
    read: false,
    ...item
  });
  saveNotifications(list);
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:notifications-updated"));
  }
}

function markAllNotificationsRead() {
  const list = getNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(list);
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:notifications-updated"));
  }
}

function markNotificationRead(id) {
  const list = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(list);
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:notifications-updated"));
  }
}

function clearNotifications() {
  saveNotifications([]);
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:notifications-updated"));
  }
}

/* =============================
   SETTINGS / PREFERENCIAS
   ============================= */

function getSettings() {
  const fallback = {
    moneda: "UYU",
    formatoFecha: "YYYY-MM-DD",
    categorias: ["Ventas", "Compras", "Servicios", "Impuestos", "Sueldos", "Otros"],
    medios: DEFAULT_MEDIOS.map(m => ({ ...m }))
  };

  const settings = load(STORAGE_KEYS.SETTINGS, fallback);
  const normalized = {
    ...fallback,
    ...(settings || {}),
    medios: normalizeMedios(settings?.medios),
    categorias: Array.isArray(settings?.categorias) && settings.categorias.length ? settings.categorias : fallback.categorias
  };

  if (JSON.stringify(settings) !== JSON.stringify(normalized)) {
    save(STORAGE_KEYS.SETTINGS, normalized);
  }

  return normalized;
}

function saveSettings(settings) {
  save(STORAGE_KEYS.SETTINGS, settings);
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:settings-updated"));
  }
}

function getMedios() {
  const s = getSettings();
  if (Array.isArray(s?.medios) && s.medios.length) return s.medios;
  return DEFAULT_MEDIOS.map(m => ({ ...m }));
}

function getCategorias() {
  const s = getSettings();
  if (Array.isArray(s?.categorias) && s.categorias.length) return s.categorias;
  return ["Ventas", "Compras", "Servicios", "Impuestos", "Sueldos", "Otros"];
}

/* =============================
   UTILIDADES
   ============================= */

function isLogged() {
  return !!getSession();
}

/* =============================
   MOVIMIENTOS (ingresos / egresos simples)
   ============================= */

function getMovimientos() {
  return load(STORAGE_KEYS.MOVIMIENTOS, []);
}

function saveMovimientos(list) {
  save(STORAGE_KEYS.MOVIMIENTOS, list);
}

function listMovimientosSortedDesc() {
  return getMovimientos().slice().sort((a, b) => {
    const fa = a.fecha || "";
    const fb = b.fecha || "";
    if (fa === fb) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    }
    return String(fb).localeCompare(String(fa));
  });
}

function addMovimiento(mov) {
  if (!mov) throw new Error("Movimiento invalido");
  const monto = Number(mov.monto || 0);
  if (!mov.tipo || !mov.fecha || !mov.medioId || !monto || monto <= 0) {
    throw new Error("Faltan campos obligatorios");
  }

  const list = getMovimientos();
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

  const record = {
    id,
    tipo: mov.tipo,
    monto,
    moneda: mov.moneda || (getSettings()?.moneda || "UYU"),
    fecha: mov.fecha,
    concepto: mov.concepto || "",
    medioId: mov.medioId,
    createdAt: new Date().toISOString()
  };

  if (mov.categoria) record.categoria = String(mov.categoria).trim();
  if (Array.isArray(mov.tags) && mov.tags.length) record.tags = mov.tags;
  if (mov.factura) record.factura = mov.factura;
  if (mov.adjuntoName) record.adjuntoName = mov.adjuntoName;
  if (mov.adjuntoDataUrl) record.adjuntoDataUrl = mov.adjuntoDataUrl;
  if (mov.adjuntoMime) record.adjuntoMime = mov.adjuntoMime;

  list.push(record);
  saveMovimientos(list);
  return id;
}

function deleteMovimiento(id) {
  saveMovimientos(getMovimientos().filter(m => m.id !== id));
}

function updateMovimiento(id, patch) {
  if(!id) throw new Error("ID invalido");
  const list = getMovimientos();
  const idx = list.findIndex(m => m.id === id);
  if(idx < 0) return false;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  saveMovimientos(list);
  return true;
}



