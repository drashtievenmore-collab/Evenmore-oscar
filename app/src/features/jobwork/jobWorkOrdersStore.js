export const JWO_KEY = 'oscar_jobWorkOrders_v2';
const LEGACY_JWO_KEY = 'oscar_jobWorkOrders';

export const toDDMMYYYY = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // already DD-MM-YYYY or display string — pass through
  return iso || '—';
};

export const toISO = (ddmmyyyy) => {
  const m = String(ddmmyyyy || '').match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ddmmyyyy;
};

export const loadJWOs = () => {
  try {
    // One-time cleanup: drop the old seeded / mock dataset so no dump data ever shows.
    try { localStorage.removeItem(LEGACY_JWO_KEY); } catch { /* ignore */ }
    const raw = localStorage.getItem(JWO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveJWOs = (next) => {
  try {
    localStorage.setItem(JWO_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

/**
 * Push an updated order to the backend when online/authenticated.
 */
export const syncJWOToBackend = async (jwo) => {
  try {
    const { pushUpdateJWO, isJobWorkBackendEnabled } = await import('../../services/jobWorkSync');
    if (!isJobWorkBackendEnabled()) return null;
    return await pushUpdateJWO(jwo.id, jwo);
  } catch (err) {
    console.warn('[jobWorkOrdersStore] syncJWOToBackend failed:', err);
    return null;
  }
};

/**
 * Backend-first loader: when logged in (JWT present) pull from
 * GET /jobwork/orders/ and refresh the localStorage cache. Falls back
 * to cache when offline / logged out / server unreachable.
 * Server rows and never-yet-synced local rows are merged so a locally
 * created order is never wiped by a pull (its id changes only after the
 * background POST answers and the creator navigates to the server id).
 */
export const loadJWOsAsync = async () => {
  const cached = loadJWOs();
  try {
    const { pullJWOs, pushCreateJWO, reconcilePendingCreates, mergeServerRows, isJobWorkBackendEnabled } = await import('../../services/jobWorkSync');
    if (!isJobWorkBackendEnabled()) return cached;
    // Offline creates finally reach the server here; edits made while
    // offline ride along because the whole current row is pushed.
    const reconciled = await reconcilePendingCreates(cached, pushCreateJWO);
    try { saveJWOs(reconciled); } catch { /* ignore */ }
    const rows = await pullJWOs();
    if (rows === null) return reconciled;
    const merged = mergeServerRows(reconciled, rows);
    saveJWOs(merged);
    return merged;
  } catch {
    return cached;
  }
};

export const nextJWONumber = (orders) => {
  const max = (orders || []).reduce(
    (m, o) => Math.max(m, Number(String(o.jwoNo || '').replace(/\D/g, '')) || 0),
    0,
  );
  return `JWO-${String(max + 1).padStart(3, '0')}`;
};

export const jwoKpis = (jwo) => {
  const totalOrdered = Number(jwo?.plannedQty) || 0;
  const totalOutward = (jwo?.outwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const totalInward = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const accepted = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.accepted) || 0), 0);
  const rejected = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.rejected) || 0), 0);
  const pending = Math.max(0, totalOrdered - totalInward);
  const totalAmount =
    Number(jwo?.totalAmount) ||
    (jwo?.materials || []).reduce((s, m) => s + (Number(m.amount) || Number(m.qty) * Number(m.rate) || 0), 0);
  return { totalOrdered, totalOutward, totalInward, accepted, rejected, pending, totalAmount };
};

export const inr = (n) =>
  `₹ ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const numIN = (n) => (Number(n) || 0).toLocaleString('en-IN');
