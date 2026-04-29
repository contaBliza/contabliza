const STORAGE_KEYS = {
  SESSION: "contabliza_session",
  USERS: "contabliza_users",
  SETTINGS: "contabliza_settings",
  MOVIMIENTOS: "contabliza_movimientos",
  CALENDARIO: "contabliza_calendario",
  METAS: "contabliza_metas",
  META_ACTIVA: "contabliza_meta_activa",
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

const USER_SCOPED_STORAGE_KEYS = new Set([
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.MOVIMIENTOS,
  STORAGE_KEYS.CALENDARIO,
  STORAGE_KEYS.METAS,
  STORAGE_KEYS.META_ACTIVA,
  STORAGE_KEYS.NOTIFICATIONS
]);

function getScopedUserId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION) || sessionStorage.getItem("contabliza_session_temp");
    if (!raw) return "";
    const session = JSON.parse(raw);
    return session?.supabaseUserId ? String(session.supabaseUserId) : "";
  } catch {
    return "";
  }
}

function getStorageKey(key) {
  const userId = getScopedUserId();
  if (!userId || !USER_SCOPED_STORAGE_KEYS.has(key)) return key;
  return `${key}__${userId}`;
}

let CB_REMOTE_SYNC_PAUSED = false;
const CB_REMOTE_HYDRATED = new Set();

function load(key, fallback = null) {
  try {
    const value = localStorage.getItem(getStorageKey(key));
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    console.error("Error loading storage key:", key, e);
    return fallback;
  }
}

function isStorageQuotaError(error) {
  return !!error && (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function save(key, value) {
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
    if (!CB_REMOTE_SYNC_PAUSED) {
      cbQueueRemoteSync(key, value);
    }
  } catch (error) {
    if (isStorageQuotaError(error)) {
      throw new Error("No hay espacio suficiente para guardar estos datos. Reduce o elimina adjuntos e intenta de nuevo.");
    }
    throw error;
  }
}

function remove(key) {
  localStorage.removeItem(getStorageKey(key));
}

function saveLocalOnly(key, value) {
  try {
    CB_REMOTE_SYNC_PAUSED = true;
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } finally {
    CB_REMOTE_SYNC_PAUSED = false;
  }
}

function cbCanSyncRemote() {
  return !!(window.cbSupabase && getScopedUserId());
}

function cbDispatchDataEvent(name) {
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event(name));
  }
}

function cbLogRemoteError(scope, error) {
  if(error) console.warn(`Supabase sync ${scope}:`, error);
}

function cbQueueRemoteSync(key, value) {
  if(!cbCanSyncRemote()) return;
  try{
    if(key === STORAGE_KEYS.SETTINGS) Promise.resolve(cbSyncSettingsToSupabase(value)).catch(error => cbLogRemoteError("settings", error));
    if(key === STORAGE_KEYS.MOVIMIENTOS) Promise.resolve(cbSyncMovimientosToSupabase(value)).catch(error => cbLogRemoteError("movimientos", error));
    if(key === STORAGE_KEYS.METAS) Promise.resolve(cbSyncMetasToSupabase(value)).catch(error => cbLogRemoteError("metas", error));
    if(key === STORAGE_KEYS.CALENDARIO) Promise.resolve(cbSyncCalendarioToSupabase(value)).catch(error => cbLogRemoteError("calendario", error));
  }catch(error){
    cbLogRemoteError("queue", error);
  }
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

function cbToNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cbIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function cbLocalMovimientoToRow(mov) {
  const userId = getScopedUserId();
  const row = {
    user_id: userId,
    tipo: mov.tipo,
    monto: cbToNumber(mov.monto),
    moneda: mov.moneda || "UYU",
    fecha: mov.fecha,
    concepto: mov.concepto || "",
    medio_id: mov.medioId || mov.medio_id || "",
    categoria: mov.categoria || null,
    factura: mov.factura || null,
    adjunto_name: mov.adjuntoName || mov.adjunto_name || null,
    adjunto_mime: mov.adjuntoMime || mov.adjunto_mime || null,
    updated_at: mov.updatedAt || mov.updated_at || new Date().toISOString()
  };
  if(cbIsUuid(mov.id)) row.id = mov.id;
  if(mov.adjuntoPath || mov.adjunto_path) row.adjunto_path = mov.adjuntoPath || mov.adjunto_path;
  return row;
}

function cbRowToLocalMovimiento(row) {
  const previous = (load(STORAGE_KEYS.MOVIMIENTOS, []) || []).find(item => String(item.id) === String(row.id)) || {};
  return {
    id: row.id,
    tipo: row.tipo,
    monto: cbToNumber(row.monto),
    moneda: row.moneda || "UYU",
    fecha: row.fecha,
    concepto: row.concepto || "",
    medioId: row.medio_id,
    categoria: row.categoria || null,
    factura: row.factura || null,
    adjuntoPath: row.adjunto_path || null,
    adjuntoName: row.adjunto_name || null,
    adjuntoMime: row.adjunto_mime || null,
    adjuntoDataUrl: previous.adjuntoDataUrl || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cbLocalMetaToRow(goal) {
  const row = {
    user_id: getScopedUserId(),
    name: goal.name || "",
    type: goal.type || "otro",
    currency: goal.currency || "USD",
    target: cbToNumber(goal.target),
    saved: cbToNumber(goal.saved),
    monthly: cbToNumber(goal.monthly),
    updated_at: goal.updatedAt || goal.updated_at || new Date().toISOString()
  };
  if(cbIsUuid(goal.id)) row.id = goal.id;
  return row;
}

function cbRowToLocalMeta(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || "otro",
    currency: row.currency || "USD",
    target: cbToNumber(row.target),
    saved: cbToNumber(row.saved),
    monthly: cbToNumber(row.monthly),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cbLocalCalendarToRow(item) {
  const row = {
    user_id: getScopedUserId(),
    tipo: item.tipo || "RECORDATORIO",
    fecha: item.fecha,
    descripcion: item.descripcion || "",
    estado: item.estado || "PENDIENTE",
    monto: cbToNumber(item.monto),
    updated_at: item.updatedAt || item.updated_at || new Date().toISOString()
  };
  if(cbIsUuid(item.id)) row.id = item.id;
  return row;
}

function cbRowToLocalCalendar(row) {
  return {
    id: row.id,
    tipo: row.tipo || "RECORDATORIO",
    fecha: row.fecha,
    descripcion: row.descripcion || "",
    estado: row.estado || "PENDIENTE",
    monto: cbToNumber(row.monto),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function cbSyncSettingsToSupabase(settings) {
  if(!cbCanSyncRemote()) return;
  const userId = getScopedUserId();
  const payload = {
    user_id: userId,
    moneda: settings?.moneda || "UYU",
    medios: Array.isArray(settings?.medios) ? settings.medios : DEFAULT_MEDIOS,
    categorias: Array.isArray(settings?.categorias) ? settings.categorias : [],
    formato_fecha: settings?.formatoFecha || settings?.formato_fecha || "YYYY-MM-DD"
  };
  const { error } = await window.cbSupabase.from("settings").upsert(payload, { onConflict: "user_id" });
  cbLogRemoteError("settings", error);
}

async function cbSyncTableList(table, localList, toRow, storageKey) {
  if(!cbCanSyncRemote()) return;
  const userId = getScopedUserId();
  const list = Array.isArray(localList) ? localList : [];
  const rows = list.map(toRow).filter(row => row.user_id && cbIsUuid(row.id));
  const localIds = rows.map(row => row.id).filter(Boolean);

  if(rows.length){
    const { error } = await window.cbSupabase.from(table).upsert(rows, { onConflict: "id" });
    if(error){
      cbLogRemoteError(table, error);
      return;
    }
  }

  if(!CB_REMOTE_HYDRATED.has(storageKey)) return;

  const remote = await window.cbSupabase.from(table).select("id").eq("user_id", userId);
  if(remote.error){
    cbLogRemoteError(`${table}:select`, remote.error);
    return;
  }

  const toDelete = (remote.data || [])
    .map(row => row.id)
    .filter(id => !localIds.includes(id));

  if(toDelete.length){
    const { error } = await window.cbSupabase.from(table).delete().in("id", toDelete).eq("user_id", userId);
    cbLogRemoteError(`${table}:delete`, error);
  }
}

function cbSyncMovimientosToSupabase(list) {
  cbSyncTableList("movimientos", list, cbLocalMovimientoToRow, STORAGE_KEYS.MOVIMIENTOS);
}

function cbSyncMetasToSupabase(list) {
  cbSyncTableList("metas", list, cbLocalMetaToRow, STORAGE_KEYS.METAS);
}

function cbSyncCalendarioToSupabase(list) {
  cbSyncTableList("calendario_eventos", list, cbLocalCalendarToRow, STORAGE_KEYS.CALENDARIO);
}

async function cbHydrateSettingsFromSupabase() {
  if(!cbCanSyncRemote()) return;
  const userId = getScopedUserId();
  const { data, error } = await window.cbSupabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if(error){
    cbLogRemoteError("settings:hydrate", error);
    return;
  }
  if(!data){
    const localSettings = load(STORAGE_KEYS.SETTINGS, null);
    if(localSettings) cbSyncSettingsToSupabase(localSettings);
    return;
  }
  saveLocalOnly(STORAGE_KEYS.SETTINGS, {
    moneda: data.moneda || "UYU",
    medios: Array.isArray(data.medios) ? data.medios : DEFAULT_MEDIOS,
    categorias: Array.isArray(data.categorias) ? data.categorias : [],
    formatoFecha: data.formato_fecha || "YYYY-MM-DD"
  });
  cbDispatchDataEvent("cb:settings-updated");
}

async function cbHydrateTableFromSupabase(table, storageKey, mapper, eventName) {
  if(!cbCanSyncRemote()) return;
  const userId = getScopedUserId();
  const { data, error } = await window.cbSupabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if(error){
    cbLogRemoteError(`${table}:hydrate`, error);
    return;
  }
  const remoteRows = data || [];
  const localRows = load(storageKey, []);
  CB_REMOTE_HYDRATED.add(storageKey);
  if(!remoteRows.length && Array.isArray(localRows) && localRows.length){
    cbQueueRemoteSync(storageKey, localRows);
    return;
  }
  saveLocalOnly(storageKey, remoteRows.map(mapper));
  cbDispatchDataEvent(eventName);
}

function cbHydrateRemoteData() {
  if(!cbCanSyncRemote()) return;
  cbHydrateSettingsFromSupabase();
  cbHydrateTableFromSupabase("movimientos", STORAGE_KEYS.MOVIMIENTOS, cbRowToLocalMovimiento, "cb:movimientos-updated");
  cbHydrateTableFromSupabase("metas", STORAGE_KEYS.METAS, cbRowToLocalMeta, "cb:metas-updated");
  cbHydrateTableFromSupabase("calendario_eventos", STORAGE_KEYS.CALENDARIO, cbRowToLocalCalendar, "cb:calendario-updated");
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
  if (!settings && cbCanSyncRemote()) {
    return fallback;
  }
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
  if(typeof window !== "undefined" && window.dispatchEvent){
    window.dispatchEvent(new Event("cb:movimientos-updated"));
  }
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

if(typeof document !== "undefined"){
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(cbHydrateRemoteData, 0);
  });
}

if(typeof window !== "undefined" && window.cbSupabase?.auth){
  window.cbSupabase.auth.onAuthStateChange((_event, session) => {
    if(session?.user?.id){
      setTimeout(cbHydrateRemoteData, 0);
    }
  });
}



