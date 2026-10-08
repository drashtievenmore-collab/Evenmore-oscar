import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { publishEstimates } from '../services/estimateStore';
import { formatDateDDMMYYYY, getCurrentDateFormatted, getCurrentISODate, addDaysISO, toISODate, toDisplayDate } from '../utils/dateUtils';
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol, getCurrencyConfig, CURRENCY_CONFIGS, fetchLiveExchangeRates, DEFAULT_RATES, setBaseCurrency } from '../utils/currencyUtils';
import { calculateWarrantyCoverageStatus } from '../utils/warrantyUtils';
import { emitCrmEvent, CRM_EVENT_TYPES } from '../services/crmEventNotifications';
import { api } from '../services/api';
import {
    isBackendEnabled,
    pullAll,
    PULL_ORDER,
    pushCreate,
    pushUpdate,
    pushDelete,
    postDocumentAction,
    pullCompanyProfile,
    isServerId,
    describeError,
    RESOURCES,
} from '../services/backendSync';
// ── [PHASE-2E.1] steel-category → HSN default map (Sweven fabrication master) ──
//   Falls back to 7216 (angles/shapes/sections) unless the category matches a known steel family.
function mapCategoryToHSN(category) {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('angle') || cat.includes('channel') || cat.includes('section') || cat.includes('beam')) return '7216.32';
    if (cat.includes('pipe') || cat.includes('tube') || cat.includes('hollow')) return '7306.30';
    if (cat.includes('sheet') || cat.includes('coil') || cat.includes('plate') || cat.includes('flat')) return '7208.10';
    if (cat.includes('bar') || cat.includes('rod') || cat.includes('round')) return '7214.10';
    if (cat.includes('wire')) return '7217.10';
    if (cat.includes('table') || cat.includes('furniture')) return '9403.20';
    if (cat.includes('fastener') || cat.includes('bolt') || cat.includes('nut') || cat.includes('screw')) return '7318.15';
    if (cat.includes('fabrication') || cat.includes('fabricated')) return '7308.90';
    return '7216.99';
}
/**
 * The collections the server owns, and how long a failed pull is left alone
 * before a read may ask for it again.
 */
const LAZY_COLLECTION_KEYS = new Set(PULL_ORDER);
const RESOURCE_RETRY_MS = 15000;

/**
 * The value `useERP()` hands out: the context object, with a read of a
 * server-owned collection also asking for that collection.
 *
 * This is the whole of the lazy loading contract. A screen that renders
 * invoices destructures `invoices` and the request goes out; a screen that does
 * not, never pays for them. Nothing in the reading component changes — the
 * value arrives as an ordinary state update once the server answers, exactly as
 * it did when every collection was pulled at boot.
 */
function lazyCollectionView(value, request) {
    return new Proxy(value, {
        get(target, key, receiver) {
            if (typeof key === 'string' && LAZY_COLLECTION_KEYS.has(key)) request(key);
            return Reflect.get(target, key, receiver);
        },
    });
}

const ERPContext = createContext(null);
const normalizeProformaInvoices = (pis) => {
    if (!Array.isArray(pis)) return [];
    return pis.map((pi) => {
        let paymentTerms = pi.paymentTerms;
        let paymentSchedule = pi.paymentSchedule;
        if (Array.isArray(paymentTerms)) {
            if (!paymentSchedule || paymentSchedule.length === 0) {
                paymentSchedule = paymentTerms.map((t) => ({
                    milestone: t.milestone || t.name || 'Payment Milestone',
                    pct: t.percentage ?? t.pct ?? 0,
                    amount: t.amount,
                    due: t.due || t.milestone || 'Standard Terms',
                }));
            }
            paymentTerms = paymentTerms
                .map((t) => (typeof t === 'string' ? t : `${t.percentage || t.pct || ''}% ${t.name || t.milestone || ''}`.trim()))
                .filter(Boolean)
                .join(' • ') || 'Custom Milestone Schedule';
        } else if (paymentTerms && typeof paymentTerms === 'object') {
            paymentTerms = paymentTerms.name || paymentTerms.milestone || 'Custom Terms';
        }
        return {
            ...pi,
            paymentTerms: paymentTerms || '50% Advance • 50% Before Dispatch',
            paymentSchedule: paymentSchedule || [],
        };
    });
};

export const ERPProvider = ({ children, }) => {
    const [estimates, setEstimates] = useState([]);
    const [faultyParts, setFaultyParts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [proformaInvoices, setProformaInvoices] = useState(() => normalizeProformaInvoices([]));
    const [zoneRequests, setZoneRequests] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [parties, setParties] = useState([]);
    const [units, setUnits] = useState([]);
    const [categoryParts, setCategoryParts] = useState([]);
    const [itemParts, setItemParts] = useState([]);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [fabrics, setFabrics] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [salesOrders, setSalesOrders] = useState([]);
    const [deliveryChallans, setDeliveryChallans] = useState([]);
    const [paymentIns, setPaymentIns] = useState([]);
    const [salesReturns, setSalesReturns] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [productionInstructions, setProductionInstructions] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('oscar_productionInstructions') || '[]');
        } catch {
            return [];
        }
    });
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [vendorBills, setVendorBills] = useState([]);
    const [paymentOuts, setPaymentOuts] = useState([]);
    const [purchaseReturns, setPurchaseReturns] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [locations, setLocations] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [serviceUsages, setServiceUsages] = useState([]);
    const [valuationItems, setValuationItems] = useState([]);
    const [monthEndAudits, setMonthEndAudits] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    // ── [PHASE-2C] QC quality standards master (steel: dimensional + weight + surface checks)
    //   Seed rows model Sweven's metal-intake checks; used to guide GRN QC review.
    const defaultQualityStandards = [
        { id: 'qs-ms-angle', name: 'MS Angle – Structural', category: 'Structural Steel', checks: ['Dimension tolerance ±2 mm', 'Weight variance within tolerance %', 'Surface: no scale / spalling', 'Check length, leg, thickness, mass'], tolerancePct: 2, active: true },
        { id: 'qs-chequered', name: 'Chequered Plate – MS', category: 'Flat Steel', checks: ['Thickness per IS 2062', 'Chequer height 1.0–1.4 mm', 'Flatness ≤ 4 mm bow per 1 m', 'Mass per theoretical kg'], tolerancePct: 3, active: true },
        { id: 'qs-hr-sheet', name: 'HR Sheet / Coil', category: 'Flat Steel', checks: ['Gauge per IS 1079', 'Edges trimmed, no oil stains', 'Width tolerance ±2 mm', 'Weighed on receipt'], tolerancePct: 2, active: true },
        { id: 'qs-sq-pipe', name: 'Square Pipe – Structural', category: 'Structural Steel', checks: ['Section size per IS 4923', 'Wall thickness ±5%', 'Bend/straightness check', 'Weight variance within tolerance %'], tolerancePct: 2.5, active: true },
    ];
    const [qualityStandards, setQualityStandards] = useState(defaultQualityStandards);
    const [inventoryMovements, setInventoryMovements] = useState([]);
    const [warranties, setWarranties] = useState([]);
    const [currency, setCurrencyState] = useState(() => {
        return localStorage.getItem('evenmore_currency') || 'INR (₹)';
    });
    const [companyProfile, setCompanyProfileState] = useState({
        // [PHASE-2E.1] Sweven demo company default — Maharashtra GSTIN so intra-state
        //   prints show CGST+SGST split and the letterhead carries GSTIN/PAN/address.
        //   Editable from Settings → Company Profile. Keep `name` aligned with app branding.
        name: 'Sweven Fabricators Pvt Ltd',
        gstin: '27AABCU9912E1Z8',
        pan: 'AABCU9912E',
        address: 'Plot 14, MIDC Industrial Area, Waluj, Aurangabad, Maharashtra 431136',
        phone: '+91 80 4920 1100',
    });
    const [liveRates, setLiveRates] = useState(DEFAULT_RATES);
    const [toastMessage, setToastMessage] = useState(null);

    useEffect(() => {
        fetchLiveExchangeRates()
            .then((rates) => {
                if (rates) setLiveRates(rates);
            })
            .catch((err) => console.warn('Live forex rate sync:', err));
    }, []);

    // ── Live backend synchronization ────────────────────────────────────
    //
    // A collection is pulled the first time something reads it, not when the
    // app boots: `useERP()` hands out a view that turns a read of `invoices`
    // into a request for invoices (see `lazyCollectionView`). Opening a screen
    // therefore costs the collections that screen shows, and the thirty
    // requests the app used to fire before the first paint are gone.
    //
    // A collection the server could not answer for is skipped rather than
    // blanked, so a partial outage degrades to stale data instead of an empty
    // screen, and the failure is retried the next time something reads it.
    const syncSettersRef = useRef(null);
    syncSettersRef.current = {
        categories: setCategories,
        units: setUnits,
        locations: setLocations,
        fabrics: setFabrics,
        items: setItems,
        parties: setParties,
        customers: setCustomers,
        vendors: setVendors,
        estimates: setEstimates,
        quotations: setQuotations,
        salesOrders: setSalesOrders,
        proformaInvoices: setProformaInvoices,
        deliveryChallans: setDeliveryChallans,
        invoices: setInvoices,
        paymentIns: setPaymentIns,
        salesReturns: setSalesReturns,
        purchaseOrders: setPurchaseOrders,
        purchaseBills: setPurchaseBills,
        vendorBills: setVendorBills,
        paymentOuts: setPaymentOuts,
        purchaseReturns: setPurchaseReturns,
        expenses: setExpenses,
        // Registry entries that used to be pulled and then thrown away for want
        // of a setter. They now feed the screens that read them, on demand.
        transfers: setTransfers,
        serviceUsages: setServiceUsages,
        valuationItems: setValuationItems,
        monthEndAudits: setMonthEndAudits,
        inventoryMovements: setInventoryMovements,
        faultyParts: setFaultyParts,
        zoneRequests: setZoneRequests,
        bankAccounts: setBankAccounts,
        journalEntries: setJournalEntries,
        itemParts: setItemParts,
        // Guide rows ship with the app; server rows join them (matched by
        // name) instead of blanking the QC checklist when the backend is empty.
        qualityStandards: (rows) => setQualityStandards((prev) => {
            const server = Array.isArray(rows) ? rows : [];
            if (server.length === 0) return prev;
            const names = new Set(server.map((r) => String(r?.name || '').toLowerCase()));
            return [
                ...server,
                ...(Array.isArray(prev) ? prev : []).filter((r) =>
                    r && !isServerId(r.id) && !names.has(String(r?.name || '').toLowerCase())),
            ];
        }),
    };

    const [backendStatus, setBackendStatus] = useState({ connected: false, loading: false, lastSyncAt: null });
    const refreshInFlight = useRef(null);
    // What each key has been through: loaded once, in flight now, queued for the
    // next batch, or failed at a moment recent enough that reading it again
    // should not hammer the server.
    const loadedKeysRef = useRef(new Set());
    const inFlightKeysRef = useRef(new Set());
    const queuedKeysRef = useRef(new Set());
    const failedKeysRef = useRef(new Map());
    const flushHandleRef = useRef(null);

    /** Pull `keys` together and hand each collection to its setter. */
    const loadKeys = useCallback(async (keys) => {
        if (!keys.length) return {};
        keys.forEach((key) => inFlightKeysRef.current.add(key));
        setBackendStatus((prev) => (prev.loading ? prev : { ...prev, loading: true }));
        // `pullAll` keeps a few requests in flight at a time and leaves out
        // whatever the server did not answer for.
        const collections = await pullAll(keys);
        keys.forEach((key) => {
            inFlightKeysRef.current.delete(key);
            if (key in collections) {
                loadedKeysRef.current.add(key);
                failedKeysRef.current.delete(key);
                syncSettersRef.current[key]?.(collections[key]);
            } else {
                failedKeysRef.current.set(key, Date.now());
            }
        });
        const answered = Object.keys(collections).length > 0;
        setBackendStatus((prev) => ({
            connected: prev.connected || answered,
            loading: inFlightKeysRef.current.size > 0,
            lastSyncAt: answered ? new Date().toISOString() : prev.lastSyncAt,
        }));
        return collections;
    }, []);

    /**
     * Ask for a collection. This runs from the read itself, so it must be cheap,
     * must never touch state synchronously (a read happens during render) and
     * must collapse the twenty reads one page makes into a single batch.
     */
    const requestCollection = useCallback((key) => {
        if (!isBackendEnabled()) return;
        if (!syncSettersRef.current[key]) return;
        if (loadedKeysRef.current.has(key)
            || inFlightKeysRef.current.has(key)
            || queuedKeysRef.current.has(key)) return;
        const failedAt = failedKeysRef.current.get(key);
        if (failedAt && Date.now() - failedAt < RESOURCE_RETRY_MS) return;

        queuedKeysRef.current.add(key);
        if (flushHandleRef.current) return;
        // Out of the render pass, and late enough for the rest of this page's
        // components to add their own keys to the same batch.
        flushHandleRef.current = setTimeout(() => {
            flushHandleRef.current = null;
            const batch = [...queuedKeysRef.current];
            queuedKeysRef.current.clear();
            loadKeys(batch);
        }, 0);
    }, [loadKeys]);

    /**
     * Every collection the registry covers, whether or not a screen has read it.
     *
     * Lazy loading means "what is in memory" is "what has been looked at", which
     * is right for a screen and wrong for a backup: the two callers below have
     * to see the whole database, so they pull the rest first.
     */
    const loadAllCollections = useCallback(async () => {
        if (!isBackendEnabled()) return {};
        const missing = Object.keys(syncSettersRef.current)
            .filter((key) => !loadedKeysRef.current.has(key));
        return missing.length ? loadKeys(missing) : {};
    }, [loadKeys]);

    /** The tenant's currency and letterhead — one request, needed everywhere. */
    const loadCompanyProfile = useCallback(async () => {
        const profile = await pullCompanyProfile();
        if (!profile) return null;
        setCompanyProfileState((prev) => ({ ...prev, ...profile }));
        // Amounts arrive already denominated in this currency, so it is the
        // base every conversion is measured from (api.md §1.6).
        setBaseCurrency(profile.currency);
        setBackendStatus((prev) => (prev.connected ? prev : { ...prev, connected: true }));
        return profile;
    }, []);

    /**
     * Re-read everything this tab has on screen — the "Sync now" affordance and
     * what a sign-in triggers. Collections nobody has looked at stay unloaded.
     */
    const refreshFromBackend = useCallback(async () => {
        if (!isBackendEnabled()) {
            setBackendStatus({ connected: false, loading: false, lastSyncAt: null });
            return null;
        }
        // A second caller joins the read already running rather than starting
        // another round. Mounting twice, a sign-in in another tab and a manual
        // refresh can all arrive together.
        if (refreshInFlight.current) return refreshInFlight.current;
        const run = (async () => {
            const keys = [...new Set([
                ...loadedKeysRef.current,
                ...inFlightKeysRef.current,
                ...failedKeysRef.current.keys(),
            ])];
            loadedKeysRef.current.clear();
            failedKeysRef.current.clear();
            const [collections] = await Promise.all([
                keys.length ? loadKeys(keys) : Promise.resolve({}),
                loadCompanyProfile(),
            ]);
            return collections;
        })();

        refreshInFlight.current = run;
        try {
            return await run;
        } finally {
            refreshInFlight.current = null;
        }
    }, [loadKeys, loadCompanyProfile]);

    useEffect(() => {
        let cancelled = false;
        // On mount only the company profile is read: currency formatting and the
        // letterhead are needed on every screen, and it is a single request.
        // Every collection waits to be asked for.
        if (isBackendEnabled()) loadCompanyProfile();

        // A session change invalidates whatever this tab is holding.
        const onSession = () => { if (!cancelled) refreshFromBackend(); };
        window.addEventListener('evenmore:authorized', onSession);
        window.addEventListener('storage', onSession);
        return () => {
            cancelled = true;
            if (flushHandleRef.current) clearTimeout(flushHandleRef.current);
            window.removeEventListener('evenmore:authorized', onSession);
            window.removeEventListener('storage', onSession);
        };
    }, [refreshFromBackend, loadCompanyProfile]);

    const setCurrency = (newCurr) => {
        setCurrencyState(newCurr);
        try {
            localStorage.setItem('evenmore_currency', newCurr);
        } catch (e) {}
        showToast(`System base currency updated to ${newCurr}`);
    };

    const setCompanyProfile = (profile) => {
        setCompanyProfileState((prev) => ({ ...prev, ...profile }));
    };

    const formatCurrency = (amount, opts = {}) => {
        return formatCurrencyUtil(amount, currency, { ...opts, customRates: liveRates });
    };

    const currencySymbol = getCurrencySymbol(currency);

    // Nothing is cached in the browser: every collection above is the server's,
    // re-read by `refreshFromBackend()` and kept current by the persist helpers.
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage((prev) => (prev === msg ? null : prev));
        }, 3500);
    };

    // ── Write-through persistence ───────────────────────────────────────────
    //
    // The `add*` / `update*` functions below stay synchronous: callers rely on
    // getting the new record back immediately, and the forms are built around
    // that. So a write is applied to local state first and pushed in the
    // background; when the server answers, its copy replaces the optimistic one
    // in place. That matters beyond the id — the server allocates the document
    // number and recomputes every total (api.md §1.7, §5.7), so the row the user
    // ends up looking at is the row that is actually in the database.
    //
    // Without a session these are no-ops and the app behaves exactly as it did
    // before, on local state alone.

    /** Swap an optimistic record for the server's, matching on the local id. */
    const reconcile = (setter, localId, serverRecord) => {
        setter((prev) => prev.map((row) => (
            row.id === localId ? { ...row, ...serverRecord, _synced: true } : row
        )));
    };

    /** Flag the row so the UI can show it never reached the database. */
    const markSyncFailure = (setter, localId, err) => {
        setter((prev) => prev.map((row) => (
            row.id === localId ? { ...row, _synced: false, _syncError: describeError(err) } : row
        )));
    };

    /**
     * Persist a newly created record.
     *
     * @param key      resource name in `backendSync.RESOURCES`
     * @param record   the record already pushed into local state
     * @param setter   that collection's `setState`
     * @param options  `also` — extra collections holding the same record under
     *                 the same local id (a party is mirrored into `customers`
     *                 or `vendors`), reconciled with the same server row.
     */
    const persistCreate = (key, record, setter, { also = [], onServer } = {}) => {
        if (!isBackendEnabled() || !record?.id) return record;
        pushCreate(key, record)
            .then((serverRecord) => {
                if (!serverRecord) return;
                reconcile(setter, record.id, serverRecord);
                also.forEach(({ setter: otherSetter, map }) => {
                    reconcile(otherSetter, record.id, map ? map(serverRecord) : serverRecord);
                });
                onServer?.(serverRecord);
            })
            .catch((err) => {
                console.warn(`[ERP] could not save ${key}:`, err);
                markSyncFailure(setter, record.id, err);
                also.forEach(({ setter: otherSetter }) => markSyncFailure(otherSetter, record.id, err));
                showToast(`Saved locally only — ${describeError(err)}`);
            });
        return record;
    };

    /**
     * Persist a field update. Skipped for records that only ever existed
     * locally (a non-UUID id would 404).
     */
    const persistUpdate = (key, id, updates, setter) => {
        if (!isBackendEnabled() || !isServerId(id)) return;
        pushUpdate(key, id, updates)
            .then((serverRecord) => {
                if (serverRecord && setter) reconcile(setter, id, serverRecord);
            })
            .catch((err) => {
                console.warn(`[ERP] could not update ${key}:`, err);
                if (setter) markSyncFailure(setter, id, err);
                showToast(`Change not saved to server — ${describeError(err)}`);
            });
    };

    const persistDelete = (key, id) => {
        if (!isBackendEnabled() || !isServerId(id)) return;
        pushDelete(key, id).catch((err) => {
            console.warn(`[ERP] could not delete ${key}:`, err);
            showToast(`Delete not saved to server — ${describeError(err)}`);
        });
    };

    /**
     * Re-read collections after a server-side action (finalize, cancel,
     * receive-goods …) that posts stock and ledger rows behind the scenes.
     * Server rows win by id; local-only rows (offline creates) are kept.
     * Stock movements additionally dedupe by business key, because the
     * screen posts an instant local mirror of the SALE the server also
     * posts — same type/reference/item/quantity means the same movement.
     */
    const movementKey = (m) => [
        m?.type,
        m?.referenceId ?? m?.reference_id ?? m?.referenceNumber ?? m?.reference_number,
        m?.itemId ?? m?.itemSku,
        Number(m?.quantity),
    ].join('|');
    const refreshCollections = (keys) => {
        if (!isBackendEnabled() || !keys?.length) return Promise.resolve({});
        return pullAll(keys).then((collections) => {
            Object.entries(collections).forEach(([key, rows]) => {
                const setter = syncSettersRef.current[key];
                if (!setter || !Array.isArray(rows)) return;
                const serverIds = new Set(rows.map((r) => String(r?.id)));
                const serverKeys = new Set(rows.map(movementKey));
                setter((prev) => {
                    const base = Array.isArray(prev) ? prev : [];
                    const localOnly = base.filter((r) => {
                        if (!r || isServerId(r.id) || serverIds.has(String(r.id))) return false;
                        if (key === 'inventoryMovements' && serverKeys.has(movementKey(r))) return false;
                        return true;
                    });
                    return [...localOnly, ...rows];
                });
            });
            return collections;
        }).catch(() => ({}));
    };

    /**
     * Re-point local stock mirrors at the server row after reconcile, so the
     * refresh dedupes by business key instead of double counting.
     */
    const repointMovements = (tempId, serverId) => {
        if (!serverId || serverId === tempId) return;
        setInventoryMovements((prev) => prev.map((m) => (
            m.referenceId === tempId ? { ...m, referenceId: serverId } : m
        )));
    };

    /**
     * Run a document action endpoint (`finalize`, `cancel`, `receive-goods`)
     * and reconcile the returned document into state. The server owns the
     * side effects (numbers, stock, ledger); dependents re-read afterwards.
     */
    const runDocAction = (key, id, action, data, setter, { refresh = [] } = {}) => {
        if (!isBackendEnabled() || !isServerId(id)) return Promise.resolve(null);
        return postDocumentAction(key, id, action, data)
            .then(({ saved }) => {
                if (saved && setter) reconcile(setter, id, saved);
                if (refresh.length) refreshCollections(refresh);
                return saved;
            })
            .catch((err) => {
                console.warn(`[ERP] ${key}/${action} failed:`, err);
                showToast(`${action} not saved to server — ${describeError(err)}`);
                throw err;
            });
    };

    /**
     * Discard anything held locally and re-read every collection. What used to
     * restore a shipped demo set now asks the server, which is the only place
     * this data exists.
     */
    const resetDemoData = async () => {
        await refreshFromBackend();
        showToast('Reloaded from the server.');
    };

    // ---------------- DOMAIN QUERIES ----------------
    const getItemMovements = (itemIdOrSku) => {
        return inventoryMovements.filter((m) => m.itemId === itemIdOrSku || m.itemSku?.toLowerCase() === itemIdOrSku.toLowerCase());
    };
    const calculateItemStock = (itemIdOrSku) => {
        const item = items.find((i) => i.id === itemIdOrSku || i.sku?.toLowerCase() === itemIdOrSku.toLowerCase());
        const targetId = item?.id || itemIdOrSku;
        const targetSku = item?.sku || itemIdOrSku;
        // Sum all movements for this item
        const moves = inventoryMovements.filter((m) => m.itemId === targetId || (m.itemSku && String(m.itemSku ?? '').toLowerCase() === targetSku.toLowerCase()));
        let netMovementQty = 0;
        moves.forEach((m) => {
            // [PHASE-2A] For weight-based items (steel by kg) prefer the weighed quantity —
            //   stock on hand then reflects actual kg received on the weighbridge.
            if (item?.isWeightItem && m.weighedQty !== undefined && m.weighedQty !== null) {
                netMovementQty += Number(m.weighedQty) || 0;
            } else {
                netMovementQty += m.quantity;
            }
        });
        // Count damaged parts
        const damagedMoves = moves.filter((m) => m.type === 'FAULTY');
        const totalDamaged = damagedMoves.reduce((acc, m) => acc + Math.abs(m.quantity), 0);
        // Sum open reservations from Sales Orders in 'Draft' / 'Confirmed' / 'Packing'
        let reservedQty = 0;
        salesOrders.forEach((so) => {
            if (so.stage !== 'Delivered' && so.stage !== 'Invoiced' && so.stage !== 'Cancelled' && so.status !== 'Cancelled') {
                if (so.items && Array.isArray(so.items)) {
                    so.items.forEach((line) => {
                        if (line.itemId === targetId || line.itemSku?.toLowerCase() === targetSku.toLowerCase()) {
                            reservedQty += line.qty || 0;
                        }
                    });
                }
            }
        });
        const onHand = Math.max(0, netMovementQty > 0 ? netMovementQty : (item?.availableQty ?? 0));
        const available = Math.max(0, onHand - reservedQty);
        return {
            onHand,
            reserved: reservedQty,
            damaged: totalDamaged,
            available,
        };
    };
    const getCustomerLedger = (customerIdOrName) => {
        const cust = customers.find((c) => c.id === customerIdOrName || String(c.name ?? '').toLowerCase() === customerIdOrName.toLowerCase());
        const custName = cust?.name || customerIdOrName;
        const entries = [];
        // 1. Invoices (Debit - increases customer balance / AR)
        invoices.forEach((inv) => {
            if (inv.customer?.toLowerCase() === custName.toLowerCase() || (cust && inv.customerId === cust.id)) {
                entries.push({
                    id: `led-inv-${inv.id}`,
                    date: inv.date,
                    type: 'Sales Invoice',
                    reference: inv.invoiceNumber,
                    description: `Invoice ${inv.invoiceNumber} - ${inv.items?.[0]?.description || 'General Merchandise'}`,
                    debit: inv.total,
                    credit: 0,
                    balance: 0,
                });
            }
        });
        // 2. Payments (Credit - decreases AR)
        paymentIns.forEach((p) => {
            if (p.customer?.toLowerCase() === custName.toLowerCase() || (cust && p.customerId === cust.id)) {
                entries.push({
                    id: `led-pay-${p.id}`,
                    date: p.date,
                    type: 'Payment Received',
                    reference: p.receiptNumber,
                    description: `Settlement via ${p.mode || 'Bank'} (${p.reference || 'Ref'})`,
                    debit: 0,
                    credit: p.amount,
                    balance: 0,
                });
            }
        });
        // 3. Sales Returns / Credit Notes (Credit - decreases AR)
        salesReturns.forEach((sr) => {
            if (sr.customer?.toLowerCase() === custName.toLowerCase() || (cust && sr.customerId === cust.id)) {
                entries.push({
                    id: `led-sr-${sr.id}`,
                    date: sr.date,
                    type: 'Credit Note',
                    reference: sr.returnNumber,
                    description: `Credit Note for Return against ${sr.invoiceRef || 'Invoice'}: ${sr.reason}`,
                    debit: 0,
                    credit: sr.amount,
                    balance: 0,
                });
            }
        });
        // Sort entries chronologically
        entries.sort((a, b) => (a.date > b.date ? 1 : -1));
        // Calculate running balance
        let runningBalance = 0;
        return entries.map((entry) => {
            runningBalance += entry.debit - entry.credit;
            return {
                ...entry,
                balance: runningBalance,
            };
        });
    };
    const getVendorLedger = (vendorIdOrName) => {
        const vend = vendors.find((v) => v.id === vendorIdOrName || String(v.name ?? '').toLowerCase() === vendorIdOrName.toLowerCase());
        const vendName = vend?.name || vendorIdOrName;
        const entries = [];
        // 1. Purchase Bills (Credit - increases AP liability)
        purchaseBills.forEach((b) => {
            if (b.vendor?.toLowerCase() === vendName.toLowerCase() || (vend && b.vendorId === vend.id)) {
                entries.push({
                    id: `led-bill-${b.id}`,
                    date: b.date || b.billDate,
                    type: 'Vendor Bill',
                    reference: b.billNumber,
                    description: `Bill ${b.billNumber} from ${b.vendor}`,
                    debit: 0,
                    credit: b.total || b.amount,
                    balance: 0,
                });
            }
        });
        // 2. Payments (Debit - decreases AP liability)
        paymentOuts.forEach((p) => {
            if (p.vendor?.toLowerCase() === vendName.toLowerCase() || (vend && p.vendorId === vend.id)) {
                entries.push({
                    id: `led-pout-${p.id}`,
                    date: p.date,
                    type: 'Payment Out',
                    reference: p.voucherNumber,
                    description: `Disbursement via ${p.mode || 'ACH'} (${p.reference || 'Ref'})`,
                    debit: p.amount,
                    credit: 0,
                    balance: 0,
                });
            }
        });
        // 3. Purchase Returns / Debit Notes (Debit - decreases AP liability)
        purchaseReturns.forEach((pr) => {
            if (pr.vendor?.toLowerCase() === vendName.toLowerCase() || (vend && pr.vendorId === vend.id)) {
                entries.push({
                    id: `led-pr-${pr.id}`,
                    date: pr.date,
                    type: 'Debit Note',
                    reference: pr.debitNoteNumber,
                    description: `Debit Note for Supplier Return: ${pr.reason}`,
                    debit: pr.amount,
                    credit: 0,
                    balance: 0,
                });
            }
        });
        // Sort chronologically
        entries.sort((a, b) => (a.date > b.date ? 1 : -1));
        // Calculate running balance (Liability = Credit - Debit)
        let runningBalance = 0;
        return entries.map((entry) => {
            runningBalance += entry.credit - entry.debit;
            return {
                ...entry,
                balance: runningBalance,
            };
        });
    };
    const getInvoiceOutstanding = (invoiceIdOrNum) => {
        if (!invoiceIdOrNum) return { total: 0, paid: 0, balanceDue: 0, status: 'Unpaid' };
        const query = String(invoiceIdOrNum).toLowerCase();
        const inv = invoices.find((i) => i?.id === invoiceIdOrNum || (i?.invoiceNumber && String(i.invoiceNumber ?? '').toLowerCase() === query));
        if (!inv)
            return { total: 0, paid: 0, balanceDue: 0, status: 'Unpaid' };
        // Sum all payments received for this invoice
        const relatedPayments = paymentIns.filter((p) => p.invoiceId === inv.id || (p.invoiceNumber && inv.invoiceNumber && String(p.invoiceNumber ?? '').toLowerCase() === String(inv.invoiceNumber ?? '').toLowerCase()));
        const paid = relatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0) + (inv.paidAmount && relatedPayments.length === 0 ? inv.paidAmount : 0);
        const total = inv.total || 0;
        const balanceDue = Math.max(0, total - paid);
        let status = 'Unpaid';
        if (balanceDue <= 0.01) {
            status = 'Paid';
        }
        else if (paid > 0) {
            status = 'Partially Paid';
        }
        else {
            status = inv.status === 'Overdue' ? 'Overdue' : 'Unpaid';
        }
        return { total, paid, balanceDue, status };
    };
    const getBillOutstanding = (billIdOrNum) => {
        if (!billIdOrNum) return { total: 0, paid: 0, balanceDue: 0, status: 'Unpaid' };
        const query = String(billIdOrNum).toLowerCase();
        const bill = purchaseBills.find((b) => b?.id === billIdOrNum || (b?.billNumber && String(b.billNumber ?? '').toLowerCase() === query));
        if (!bill)
            return { total: 0, paid: 0, balanceDue: 0, status: 'Unpaid' };
        const billNumLower = bill.billNumber ? String(bill.billNumber ?? '').toLowerCase() : '';
        const relatedPayments = paymentOuts.filter((p) => p.billId === bill.id || (p.billNumber && billNumLower && String(p.billNumber ?? '').toLowerCase() === billNumLower));
        const paid = relatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0) + (bill.paidAmount && relatedPayments.length === 0 ? bill.paidAmount : 0);
        const total = bill.total || bill.amount || 0;
        const balanceDue = Math.max(0, total - paid);
        let status = 'Unpaid';
        if (balanceDue <= 0.01) {
            status = 'Paid';
        }
        else if (paid > 0) {
            status = 'Partially Paid';
        }
        else {
            status = bill.status === 'Overdue' ? 'Overdue' : 'Unpaid';
        }
        return { total, paid, balanceDue, status };
    };
    // ---------------- INVENTORY MOVEMENT ENGINE ----------------
    const recordMovement = (mov) => {
        const newMovement = {
            id: mov.id || `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            itemId: mov.itemId,
            itemSku: mov.itemSku,
            itemName: mov.itemName,
            locationId: mov.locationId || 'loc-1',
            locationName: mov.locationName || 'Main Central Hub',
            type: mov.type,
            quantity: mov.quantity,
            unitCost: mov.unitCost || 0,
            referenceType: mov.referenceType,
            referenceId: mov.referenceId,
            referenceNumber: mov.referenceNumber,
            sourceDocumentType: mov.sourceDocumentType || mov.referenceType,
            sourceDocumentId: mov.sourceDocumentId || mov.referenceId,
            originalMovementId: mov.originalMovementId || null,
            reversalMovementId: mov.reversalMovementId || null,
            batchNumber: mov.batchNumber || null,
            serials: Array.isArray(mov.serials) ? mov.serials : (mov.selectedSerials || []),
            date: mov.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            notes: mov.notes || '',
        };
        setInventoryMovements((prev) => [newMovement, ...prev]);
        // Also update physical availableQty in InventoryItem state
        setItems((prev) => prev.map((item) => {
            if (item.id === newMovement.itemId || item.sku?.toLowerCase() === newMovement.itemSku?.toLowerCase()) {
                const newAvailable = Math.max(0, item.availableQty + newMovement.quantity);
                let newStatus = item.status;
                if (newAvailable <= item.reorderLevel / 2) {
                    newStatus = 'Critical';
                }
                else if (newAvailable <= item.reorderLevel) {
                    newStatus = 'Low Stock';
                }
                else {
                    newStatus = 'Optimal';
                }
                return {
                    ...item,
                    availableQty: newAvailable,
                    status: newStatus,
                };
            }
            return item;
        }));
        return newMovement;
    };
    // ---------------- ACTIONS & TRANSACTIONS ----------------
    const addFaultyPart = (newPart) => {
        const part = {
            id: `fp-${Date.now()}`,
            rmaNumber: newPart.rmaNumber ||
                `RMA-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            date: newPart.date || getCurrentDateFormatted(),
            product: newPart.product || 'Unknown Hardware Item',
            sku: newPart.sku || 'SKU-GEN-01',
            serialNumber: newPart.serialNumber || 'SN-UNKNOWN',
            qty: newPart.qty || 1,
            vendor: newPart.vendor || 'Direct Vendor',
            status: 'Reported',
            notes: newPart.notes || 'Defect reported.',
            initiatedBy: newPart.initiatedBy || 'System Admin',
            timeline: [
                {
                    id: 'tl-1',
                    title: 'Fault Reported',
                    timestamp: `${newPart.date || getCurrentDateFormatted()} • Just now`,
                    description: newPart.notes || 'Diagnostic logs attached.',
                    status: 'completed',
                },
                {
                    id: 'tl-2',
                    title: 'Ship to Vendor',
                    timestamp: 'Pending Action',
                    status: 'current',
                    actionLabel: 'Mark as Shipped',
                    actionType: 'ship',
                },
                {
                    id: 'tl-3',
                    title: 'Vendor Assessment',
                    status: 'future',
                },
                {
                    id: 'tl-4',
                    title: 'Replacement / Credit',
                    status: 'future',
                },
            ],
        };
        setFaultyParts((prev) => [part, ...prev]);
        // Record FAULTY movement (removes from active stock)
        const targetItem = items.find((i) => i.sku?.toLowerCase() === part.sku?.toLowerCase() || i.name === part.product);
        if (targetItem) {
            recordMovement({
                itemId: targetItem.id,
                itemSku: targetItem.sku,
                itemName: targetItem.name,
                type: 'FAULTY',
                quantity: -part.qty,
                unitCost: targetItem.costPrice,
                referenceType: 'FaultyPart',
                referenceId: part.id,
                referenceNumber: part.rmaNumber,
                notes: `RMA Defect: ${part.notes}`,
            });
        }
        // The server allocates the RMA number and posts the FAULTY movement
        // itself; the re-read replaces the optimistic row and dedupes stock.
        if (targetItem && isServerId(targetItem.id)) {
            persistCreate('faultyParts', { ...part, itemId: targetItem.id }, setFaultyParts, {
                onServer: (saved) => {
                    repointMovements(part.id, saved?.id);
                    refreshCollections(['faultyParts', 'inventoryMovements', 'items']);
                },
            });
        }
        showToast(`RMA case ${part.rmaNumber} initiated.`);
        return part;
    };
    const updateFaultyPartStatus = (id, newStatus) => {
        setFaultyParts((prev) => prev.map((p) => {
            if (p.id !== id)
                return p;
            return {
                ...p,
                status: newStatus,
            };
        }));
        persistUpdate('faultyParts', id, { status: newStatus }, setFaultyParts);
    };
    const updateFaultyPartNotes = (id, newNotes) => {
        setFaultyParts((prev) => prev.map((p) => {
            if (p.id !== id)
                return p;
            return {
                ...p,
                notes: newNotes,
            };
        }));
        persistUpdate('faultyParts', id, { notes: newNotes }, setFaultyParts);
    };

    // ── ADDRESS SNAPSHOT HELPERS ──────────────────────────────────────────────
    const createAddressSnapshot = (addr) => {
        if (!addr) return null;
        if (typeof addr === 'string') return { line1: addr, line2: '', city: '', state: '', pincode: '', country: 'India' };
        return {
            line1: addr.line1 || '',
            line2: addr.line2 || '',
            city: addr.city || '',
            state: addr.state || '',
            pincode: addr.pincode || '',
            country: addr.country || 'India',
        };
    };

    const resolvePartyAddresses = (customerId, customerName) => {
        const cust = customers.find((c) => (customerId && c.id === customerId) || (customerName && c.name?.toLowerCase() === customerName?.toLowerCase()));
        const party = parties.find((p) => (customerId && p.id === customerId) || (customerName && p.name?.toLowerCase() === customerName?.toLowerCase()));
        const billing = createAddressSnapshot(party?.billingAddress || cust?.billingAddress || cust?.address || null);
        const shipping = createAddressSnapshot(party?.shippingAddress || cust?.shippingAddress || party?.billingAddress || cust?.billingAddress || cust?.address || null);
        return { billing, shipping };
    };

    const resolveVendorPartyAddresses = (vendorId, vendorName) => {
        const ven = vendors.find((v) => (vendorId && v.id === vendorId) || (vendorName && v.name?.toLowerCase() === vendorName?.toLowerCase()));
        const party = parties.find((p) => (vendorId && p.id === vendorId) || (vendorName && p.name?.toLowerCase() === vendorName?.toLowerCase()));
        const billing = createAddressSnapshot(party?.billingAddress || ven?.billingAddress || ven?.address || null);
        const shipping = createAddressSnapshot(party?.shippingAddress || ven?.shippingAddress || party?.billingAddress || ven?.billingAddress || ven?.address || null);
        return { billing, shipping };
    };

    const syncVendorBalance = (vendorId, vendorName, deltaAmount) => {
        if (!deltaAmount) return;
        setVendors((prev) => prev.map((v) => {
            const match = (vendorId && v.id === vendorId) || (vendorName && v.name?.toLowerCase() === vendorName?.toLowerCase());
            return match ? { ...v, balance: Math.max(0, (v.balance || 0) + deltaAmount) } : v;
        }));
        setParties((prev) => prev.map((p) => {
            const match = (vendorId && p.id === vendorId) || (vendorName && p.name?.toLowerCase() === vendorName?.toLowerCase());
            return match ? { ...p, balance: Math.max(0, (p.balance || 0) + deltaAmount) } : p;
        }));
    };

    const createInvoice = (newInvoice) => {
        const invItems = newInvoice.items && newInvoice.items.length > 0
            ? newInvoice.items
            : [
                {
                    id: `item-${Date.now()}`,
                    description: 'Standard Order Merchandise',
                    qty: 1,
                    rate: newInvoice.subtotal || newInvoice.total || 1000,
                    amount: newInvoice.subtotal || newInvoice.total || 1000,
                },
            ];

        // Dynamic tax calculation
        let subtotal = 0;
        let discountTotal = Number(newInvoice.discountTotal || 0);
        let totalTax = 0;

        invItems.forEach((it) => {
            const lineSub = Number(it.rate || 0) * Number(it.qty || 1);
            const lineDisc = Number(it.discount || it.discountPercent || 0);
            const discAmt = (lineSub * lineDisc) / 100;
            const taxable = Math.max(0, lineSub - discAmt);
            const taxRate = it.tax !== undefined ? Number(it.tax) : (it.taxRate !== undefined ? Number(it.taxRate) : 18);
            const lineTax = Math.round(taxable * (taxRate / 100) * 100) / 100;
            subtotal += lineSub;
            if (lineDisc > 0 && !newInvoice.discountTotal) {
                discountTotal += discAmt;
            }
            totalTax += lineTax;
        });

        if (newInvoice.subtotal !== undefined) subtotal = Number(newInvoice.subtotal);
        const taxableAmount = Math.max(0, subtotal - discountTotal);

        // Find customer / party place of supply to determine GST split
        const cust = customers.find((c) => c.id === newInvoice.customerId || c.name?.toLowerCase() === newInvoice.customer?.toLowerCase());
        const party = parties.find((p) => p.id === newInvoice.customerId || p.name?.toLowerCase() === newInvoice.customer?.toLowerCase());
        const pos = party?.placeOfSupply || cust?.placeOfSupply || 'Maharashtra (27)';
        const isInterState = !pos.toLowerCase().includes('maharashtra') && !pos.includes('27');

        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        if (newInvoice.cgst !== undefined || newInvoice.sgst !== undefined || newInvoice.igst !== undefined) {
            cgst = Number(newInvoice.cgst || 0);
            sgst = Number(newInvoice.sgst || 0);
            igst = Number(newInvoice.igst || 0);
            totalTax = cgst + sgst + igst;
        } else if (isInterState) {
            igst = totalTax;
        } else {
            cgst = Math.round((totalTax / 2) * 100) / 100;
            sgst = Math.round((totalTax - cgst) * 100) / 100;
        }

        const otherCharges = Number(newInvoice.otherCharges || 0);
        const roundOff = Number(newInvoice.roundOff || 0);
        const calculatedGrandTotal = Math.round((taxableAmount + totalTax + otherCharges + roundOff) * 100) / 100;
        const total = Number(newInvoice.grandTotal || newInvoice.total) || calculatedGrandTotal;

        const defaultAddresses = resolvePartyAddresses(newInvoice.customerId, newInvoice.customer);
        const billingAddress = createAddressSnapshot(newInvoice.billingAddress) || defaultAddresses.billing;
        const shippingAddress = createAddressSnapshot(newInvoice.shippingAddress) || defaultAddresses.shipping;

        const isDraft = newInvoice.status === 'Draft' || newInvoice.isDraft === true || newInvoice.finalized === false;
        const isPaid = newInvoice.status === 'Paid';
        const finalStatus = isDraft ? 'Draft' : isPaid ? 'Paid' : (newInvoice.status || 'Unpaid');
        const isFinalized = !isDraft;

        const invoice = {
            id: newInvoice.id || `inv-${Date.now()}`,
            invoiceNumber: newInvoice.invoiceNumber || `INV-2026-${String(invoices.length + 101).padStart(3, '0')}`,
            customerId: newInvoice.customerId || cust?.id,
            customer: newInvoice.customer || cust?.name || 'Acme Corp',
            billingAddress,
            shippingAddress,
            linkedSo: newInvoice.linkedSo || newInvoice.salesOrderId,
            salesOrderId: newInvoice.salesOrderId || newInvoice.linkedSo,
            proformaInvoiceId: newInvoice.proformaInvoiceId,
            linkedPi: newInvoice.linkedPi,
            date: formatDateDDMMYYYY(newInvoice.date || 'Today'),
            dueDate: newInvoice.dueDate || addDaysISO(getCurrentISODate(), 30),
            status: finalStatus,
            finalized: isFinalized,
            items: invItems,
            lineItems: invItems,
            subtotal,
            discountTotal,
            taxableAmount,
            cgst,
            sgst,
            igst,
            tax: totalTax,
            // [PHASE-2E.1] GST party metadata — powers intra/inter-state split on printed invoices
            customerGstin: newInvoice.customerGstin || cust?.gstin || party?.gstin || 'URP / Unregistered',
            placeOfSupply: newInvoice.placeOfSupply || pos,
            placeOfSupplyState: newInvoice.placeOfSupplyState || String(pos).match(/(\d{2})/)?.[1] || '',
            otherCharges,
            roundOff,
            total,
            grandTotal: total,
            amount: total,
            paidAmount: isPaid ? total : (newInvoice.paidAmount || 0),
            amountPaid: isPaid ? total : (newInvoice.paidAmount || 0),
            balanceDue: isPaid ? 0 : Math.max(0, total - (newInvoice.paidAmount || 0)),
            notes: newInvoice.notes || 'Sales Invoice',
            dispatchedViaChallan: Boolean(newInvoice.dispatchedViaChallan),
        };

        setInvoices((prev) => [invoice, ...prev]);

        // If finalized, post financial records and inventory
        if (isFinalized) {
            // Inventory Safe Handling (Case A, B, C):
            const soId = invoice.salesOrderId || invoice.linkedSo;
            const hasChallan = Boolean(
                invoice.dispatchedViaChallan ||
                (soId && deliveryChallans.some((dc) => dc.salesOrderId === soId || dc.salesOrderNumber === soId || dc.linkedSo === soId))
            );

            if (!hasChallan) {
                // Direct Invoice: Deduct inventory stock
                invItems.forEach((line) => {
                    const targetSku = line.sku || line.itemSku;
                    const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                    if (item || line.itemId) {
                        recordMovement({
                            itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                            itemSku: item?.sku || targetSku || 'GEN-SKU',
                            itemName: item?.name || line.name || line.description,
                            type: 'SALE',
                            quantity: -(Number(line.qty) || 1),
                            unitCost: item?.costPrice || line.rate || 0,
                            referenceType: 'SalesInvoice',
                            referenceId: invoice.id,
                            referenceNumber: invoice.invoiceNumber,
                            notes: `Direct sale to ${invoice.customer} per ${invoice.invoiceNumber}`,
                        });
                    }
                });
            }

            // Update customer outstanding balance
            if (invoice.customer) {
                setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === String(invoice.customer ?? '').toLowerCase() || (invoice.customerId && c.id === invoice.customerId)
                    ? { ...c, balance: c.balance + invoice.total }
                    : c));
            }

            showToast(`Invoice ${invoice.invoiceNumber} created and finalized.`);
        } else {
            showToast(`Draft Invoice ${invoice.invoiceNumber} saved.`);
        }

        // The local posting above keeps the screen responsive; the server does
        // the same work authoritatively — allocates INV-…, recomputes the
        // totals, posts the SALE movements and the Dr Debtors / Cr Sales entry —
        // and its reply replaces the optimistic row.
        persistCreate('invoices', invoice, setInvoices, {
            // Local stock mirrors point at the temp id; re-point them at the
            // server invoice so the refresh dedupes instead of double counting.
            // The server's own postings (JE, ledger, balances) arrive via re-read.
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== invoice.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === invoice.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.invoiceNumber || m.referenceNumber }
                            : m
                    )));
                }
                refreshCollections(['invoices', 'journalEntries', 'inventoryMovements', 'parties', 'items']);
            },
        });

        return invoice;
    };

    const updateDraftInvoice = (invoiceId, updates) => {
        const target = invoices.find((i) => i.id === invoiceId);
        if (!target) return undefined;
        if (target.status === 'Cancelled') {
            showToast('Cannot edit a cancelled invoice.');
            return undefined;
        }
        if (target.finalized) {
            showToast(`Cannot edit finalized invoice ${target.invoiceNumber}.`);
            return target;
        }

        let updatedInv = null;
        setInvoices((prev) => prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            if (inv.finalized) return inv;

            const invItems = updates.items || updates.lineItems || inv.items || [];
            let subtotal = 0;
            let discountTotal = Number(updates.discountTotal !== undefined ? updates.discountTotal : (inv.discountTotal || 0));
            let totalTax = 0;

            invItems.forEach((it) => {
                const lineSub = Number(it.rate || 0) * Number(it.qty || 1);
                const lineDisc = Number(it.discount || it.discountPercent || 0);
                const discAmt = (lineSub * lineDisc) / 100;
                const taxable = Math.max(0, lineSub - discAmt);
                const taxRate = it.tax !== undefined ? Number(it.tax) : (it.taxRate !== undefined ? Number(it.taxRate) : 18);
                const lineTax = Math.round(taxable * (taxRate / 100) * 100) / 100;
                subtotal += lineSub;
                if (lineDisc > 0 && updates.discountTotal === undefined) {
                    discountTotal += discAmt;
                }
                totalTax += lineTax;
            });

            if (updates.subtotal !== undefined) subtotal = Number(updates.subtotal);
            const taxableAmount = Math.max(0, subtotal - discountTotal);

            const cust = customers.find((c) => c.id === (updates.customerId || inv.customerId) || c.name?.toLowerCase() === (updates.customer || inv.customer)?.toLowerCase());
            const party = parties.find((p) => p.id === (updates.customerId || inv.customerId) || p.name?.toLowerCase() === (updates.customer || inv.customer)?.toLowerCase());
            const pos = party?.placeOfSupply || cust?.placeOfSupply || 'Maharashtra (27)';
            const isInterState = !pos.toLowerCase().includes('maharashtra') && !pos.includes('27');

            let cgst = 0;
            let sgst = 0;
            let igst = 0;
            if (updates.cgst !== undefined || updates.sgst !== undefined || updates.igst !== undefined) {
                cgst = Number(updates.cgst || 0);
                sgst = Number(updates.sgst || 0);
                igst = Number(updates.igst || 0);
                totalTax = cgst + sgst + igst;
            } else if (isInterState) {
                igst = totalTax;
            } else {
                cgst = Math.round((totalTax / 2) * 100) / 100;
                sgst = Math.round((totalTax - cgst) * 100) / 100;
            }

            const otherCharges = Number(updates.otherCharges !== undefined ? updates.otherCharges : (inv.otherCharges || 0));
            const roundOff = Number(updates.roundOff !== undefined ? updates.roundOff : (inv.roundOff || 0));
            const calculatedGrandTotal = Math.round((taxableAmount + totalTax + otherCharges + roundOff) * 100) / 100;
            const total = Number(updates.grandTotal || updates.total) || calculatedGrandTotal;

            updatedInv = {
                ...inv,
                ...updates,
                items: invItems,
                lineItems: invItems,
                subtotal,
                discountTotal,
                taxableAmount,
                cgst,
                sgst,
                igst,
                tax: totalTax,
                otherCharges,
                roundOff,
                total,
                grandTotal: total,
                amount: total,
                balanceDue: total,
                billingAddress: updates.billingAddress ? createAddressSnapshot(updates.billingAddress) : inv.billingAddress,
                shippingAddress: updates.shippingAddress ? createAddressSnapshot(updates.shippingAddress) : inv.shippingAddress,
            };
            return updatedInv;
        }));
        if (updatedInv) {
            showToast(`Draft Invoice ${updatedInv.invoiceNumber} updated.`);
            persistUpdate('invoices', invoiceId, updatedInv, setInvoices);
        }
        return updatedInv;
    };

    const finalizeInvoice = (invoiceId) => {
        const target = invoices.find((i) => i.id === invoiceId);
        if (!target) return undefined;
        if (target.status === 'Cancelled') {
            showToast('Cannot finalize a cancelled invoice.');
            return undefined;
        }
        if (target.finalized) {
            showToast(`Invoice ${target.invoiceNumber} is already finalized.`);
            return target;
        }

        let finalized = null;
        setInvoices((prev) => prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            if (inv.finalized) return inv; // Idempotent

            const updated = {
                ...inv,
                status: inv.status === 'Draft' ? 'Unpaid' : inv.status,
                finalized: true,
            };
            finalized = updated;
            return updated;
        }));

        if (!finalized) return undefined;

        // Inventory Safe Handling (Case A, B, C):
        const soId = finalized.salesOrderId || finalized.linkedSo;
        const hasChallan = Boolean(
            finalized.dispatchedViaChallan ||
            (soId && deliveryChallans.some((dc) => dc.salesOrderId === soId || dc.salesOrderNumber === soId || dc.linkedSo === soId))
        );

        if (!hasChallan) {
            // Direct Invoice: Deduct inventory stock
            (finalized.items || []).forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                if (item || line.itemId) {
                    recordMovement({
                        itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                        itemSku: item?.sku || targetSku || 'GEN-SKU',
                        itemName: item?.name || line.name || line.description,
                        type: 'SALE',
                        quantity: -(Number(line.qty) || 1),
                        unitCost: item?.costPrice || line.rate || 0,
                        referenceType: 'SalesInvoice',
                        referenceId: finalized.id,
                        referenceNumber: finalized.invoiceNumber,
                        notes: `Direct sale to ${finalized.customer} per ${finalized.invoiceNumber}`,
                    });
                }
            });
        }

        // Update customer outstanding balance
        if (finalized.customer) {
            setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === String(finalized.customer ?? '').toLowerCase() || (finalized.customerId && c.id === finalized.customerId)
                ? { ...c, balance: c.balance + finalized.total }
                : c));
        }

        // Auto-create Journal Entry for Revenue & AR — server-side: the
        // finalize action posts Dr Debtors / Cr Sales itself, and the
        // re-read below brings that entry in. A local mirror here would
        // double-count in the ledger views.
        runDocAction('invoices', finalized.id, 'finalize', {}, setInvoices, {
            refresh: ['invoices', 'journalEntries', 'inventoryMovements', 'parties'],
        }).catch(() => {});
        showToast(`Invoice ${finalized.invoiceNumber} finalized and posted to General Ledger.`);
        return finalized;
    };

    const cancelSalesInvoice = (invoiceId) => {
        const inv = invoices.find((i) => i.id === invoiceId);
        if (!inv) return { success: false, reason: 'not_found', message: 'Invoice not found.' };
        if (inv.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        // Guard against cancelling invoice with recorded payments
        const paid = Number(inv.paidAmount || inv.amountPaid || 0);
        if (paid > 0) {
            return {
                success: false,
                reason: 'has_payments',
                message: `Cannot cancel invoice with received payments (${formatCurrency(paid)}). Please reverse payments first.`,
            };
        }

        // If invoice was finalized / posted, the server reverses GL, AR
        // balance, and stock on cancel — the re-read below brings those
        // reversals in. No local reversal JE: it would double-count.
        if (inv.finalized !== false && inv.status !== 'Draft') {
            // Reversal of customer balance
            if (inv.customer) {
                setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === String(inv.customer ?? '').toLowerCase() || (inv.customerId && c.id === inv.customerId)
                    ? { ...c, balance: Math.max(0, c.balance - inv.total) }
                    : c));
            }

            // Reversal of physical stock movement if Direct Invoice (Case B/C without DC)
            const soId = inv.salesOrderId || inv.linkedSo;
            const hasChallan = Boolean(
                inv.dispatchedViaChallan ||
                (soId && deliveryChallans.some((dc) => dc.salesOrderId === soId || dc.salesOrderNumber === soId || dc.linkedSo === soId))
            );

            if (!hasChallan && inv.items) {
                inv.items.forEach((line) => {
                    const targetSku = line.sku || line.itemSku;
                    const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                    const revQty = Number(line.qty) || 1;
                    recordMovement({
                        itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                        itemSku: item?.sku || targetSku || 'GEN-SKU',
                        itemName: item?.name || line.name || line.description,
                        type: 'SALE_REVERSAL',
                        quantity: revQty,
                        unitCost: item?.costPrice || line.rate || 0,
                        referenceType: 'SalesInvoiceCancellation',
                        referenceId: inv.id,
                        referenceNumber: inv.invoiceNumber,
                        notes: `Stock reversal on Invoice ${inv.invoiceNumber} cancellation`,
                    });
                });
            }
        }

        setInvoices((prev) => prev.map((i) => i.id === invoiceId ? { ...i, status: 'Cancelled' } : i));
        // Server-side cancel reverses postings; re-read what it touched.
        runDocAction('invoices', invoiceId, 'cancel', {}, setInvoices, {
            refresh: ['invoices', 'journalEntries', 'inventoryMovements', 'parties'],
        }).catch(() => {});
        showToast(`Invoice ${inv.invoiceNumber} cancelled.`);
        return { success: true, message: `Invoice ${inv.invoiceNumber} cancelled.` };
    };

    const updateInvoiceStatus = (id, newStatus) => {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: newStatus } : inv)));
        // Posted invoices reject PATCH by design (cancel, don't edit) and the
        // status column itself is server-derived — the push is best-effort
        // with no reconcile, so a derived value never reverts the display.
        // Only drafts persist this way; posted statuses change via actions.
        const current = invoices.find((inv) => inv.id === id);
        if (!current || current.status === 'Draft') {
            persistUpdate('invoices', id, { status: newStatus });
        }
        showToast(`Invoice status updated to ${newStatus}.`);
    };

    // ── PROFORMA INVOICES ACTIONS ──────────────────────────────────────────────
    const addProformaInvoice = (pi) => {
        const subtotal = Number(pi.subtotal) || (pi.items ? pi.items.reduce((sum, it) => sum + (Number(it.rate || 0) * Number(it.qty || 1)), 0) : 0) || 5000;
        const discountTotal = Number(pi.discountTotal) || 0;
        const taxableAmount = Math.max(0, subtotal - discountTotal);
        const cgst = pi.cgst !== undefined ? Number(pi.cgst) : Math.round(taxableAmount * 0.09 * 100) / 100;
        const sgst = pi.sgst !== undefined ? Number(pi.sgst) : Math.round(taxableAmount * 0.09 * 100) / 100;
        const igst = Number(pi.igst) || 0;
        const otherCharges = Number(pi.otherCharges) || 0;
        const roundOff = Number(pi.roundOff) || 0;
        const grandTotal = Number(pi.grandTotal || pi.total) || Math.round((taxableAmount + cgst + sgst + igst + otherCharges + roundOff) * 100) / 100;

        const nextNumber = pi.proformaNumber || `PI-2026-${String(proformaInvoices.length + 5).padStart(3, '0')}`;
        const newPI = {
            id: pi.id || `pi-${Date.now()}`,
            proformaNumber: nextNumber,
            customerId: pi.customerId,
            customer: pi.customer || 'Acme Corp',
            customerContact: pi.customerContact || '',
            billingAddress: pi.billingAddress || null,
            shippingAddress: pi.shippingAddress || null,
            salesOrderId: pi.salesOrderId || null,
            linkedSo: pi.linkedSo || null,
            quotationId: pi.quotationId || null,
            linkedQuote: pi.linkedQuote || null,
            date: formatDateDDMMYYYY(pi.date || 'Today'),
            validUntil: formatDateDDMMYYYY(pi.validUntil || 'In 30 days'),
            status: pi.status || 'Draft',
            paymentTerms: pi.paymentTerms || '50% Advance • 50% Before Dispatch',
            paymentSchedule: pi.paymentSchedule || [
                { milestone: 'Advance Booking Deposit', pct: 50, amount: grandTotal * 0.5, due: 'Upon Acceptance' },
                { milestone: 'Pre-Dispatch Balance', pct: 50, amount: grandTotal * 0.5, due: 'Before Dispatch' },
            ],
            items: pi.items && pi.items.length > 0 ? pi.items : [
                {
                    id: `li-pi-${Date.now()}`,
                    description: 'Standard Commercial Quotation Package',
                    qty: 1,
                    unit: 'Unit',
                    rate: subtotal,
                    discount: 0,
                    tax: 18,
                    taxAmount: Math.round(subtotal * 0.18 * 100) / 100,
                    amount: Math.round(subtotal * 1.18 * 100) / 100,
                },
            ],
            subtotal,
            discountTotal,
            taxableAmount,
            cgst,
            sgst,
            igst,
            tax: cgst + sgst + igst,
            // [PHASE-2E.1] GST party metadata for proforma print (intra/inter-state split)
            customerGstin: pi.customerGstin || pi.gstin || 'URP / Unregistered',
            placeOfSupply: pi.placeOfSupply || 'Maharashtra (27)',
            placeOfSupplyState: pi.placeOfSupplyState || String(pi.placeOfSupply || 'Maharashtra (27)').match(/(\d{2})/)?.[1] || '',
            otherCharges,
            roundOff,
            grandTotal,
            total: grandTotal,
            notes: pi.notes || 'Commercial Proforma Invoice.',
            termsAndConditions: pi.termsAndConditions || '',
        };
        const normalizedPI = normalizeProformaInvoices([newPI])[0];
        setProformaInvoices((prev) => [normalizedPI, ...prev]);
        showToast(`Proforma Invoice ${normalizedPI.proformaNumber} created.`);
        persistCreate('proformaInvoices', normalizedPI, setProformaInvoices);
        return normalizedPI;
    };

    const updateProformaInvoice = (id, updates) => {
        setProformaInvoices((prev) => prev.map((pi) => {
            if (pi.id !== id) return pi;
            const merged = { ...pi, ...updates };
            return normalizeProformaInvoices([merged])[0];
        }));
        persistUpdate('proformaInvoices', id, updates, setProformaInvoices);
        showToast(`Proforma Invoice updated.`);
    };

    const updateProformaInvoiceStatus = (id, status) => {
        const current = proformaInvoices.find((pi) => pi.id === id);
        setProformaInvoices((prev) => prev.map((pi) => (pi.id === id ? { ...pi, status } : pi)));
        // Only drafts accept PATCH (api.md §1.9).
        if (!current || current.status === 'Draft') {
            persistUpdate('proformaInvoices', id, { status }, setProformaInvoices);
        }
        showToast(`Proforma status updated to ${status}.`);
    };

    const deleteProformaInvoice = (id) => {
        setProformaInvoices((prev) => prev.filter((pi) => pi.id !== id));
        persistDelete('proformaInvoices', id);
        showToast(`Proforma Invoice deleted.`);
    };

    const convertProformaToInvoice = (proformaId, invoiceOverrides = {}) => {
        const pi = proformaInvoices.find((p) => p.id === proformaId);
        if (!pi) return undefined;

        const targetItems = invoiceOverrides.items || pi.items || [];
        const subtotal = invoiceOverrides.subtotal ?? (targetItems.reduce((sum, item) => sum + (Number(item.amount || 0) || (Number(item.qty || 1) * Number(item.rate || 0))), 0) || pi.subtotal);
        const tax = invoiceOverrides.tax ?? (pi.cgst + pi.sgst + pi.igst || Math.round(subtotal * 0.18 * 100) / 100);
        const grandTotal = invoiceOverrides.total ?? Math.round((subtotal + tax) * 100) / 100;
        const nextInvNumber = `INV-2026-${String(invoices.length + 101).padStart(3, '0')}`;

        const newInvoice = {
            id: `inv-${Date.now()}`,
            invoiceNumber: nextInvNumber,
            customerId: pi.customerId,
            customer: pi.customer,
            billingAddress: createAddressSnapshot(pi.billingAddress),
            shippingAddress: createAddressSnapshot(pi.shippingAddress),
            salesOrderId: pi.salesOrderId,
            linkedSo: pi.linkedSo || (pi.salesOrderId ? `SO-2026-${String(invoices.length + 101).padStart(4, '0')}` : 'Direct Proforma'),
            proformaInvoiceId: pi.id,
            linkedPi: pi.proformaNumber,
            date: getCurrentDateFormatted(),
            dueDate: addDaysISO(getCurrentISODate(), 30),
            status: 'Draft',
            finalized: false,
            items: targetItems,
            lineItems: targetItems,
            subtotal,
            tax,
            total: grandTotal,
            paidAmount: 0,
            balanceDue: grandTotal,
            notes: invoiceOverrides.notes || `Draft Sales Invoice generated against Proforma ${pi.proformaNumber}. ${pi.notes || ''}`,
            paymentTerms: pi.paymentTerms || 'Net 30',
        };

        createInvoice(newInvoice);

        // Update Proforma status to Converted
        setProformaInvoices((prev) => prev.map((p) => (p.id === proformaId ? {
            ...p,
            status: 'Converted',
            convertedInvoiceId: newInvoice.id,
            convertedInvoiceNumber: newInvoice.invoiceNumber,
        } : p)));
        // Draft proformas accept the status PATCH; the invoice itself
        // persists through createInvoice above.
        if (!pi || pi.status === 'Draft' || pi.status === 'Sent') {
            persistUpdate('proformaInvoices', proformaId, { status: 'Converted' }, setProformaInvoices);
        }

        showToast(`Proforma ${pi.proformaNumber} converted to Draft Invoice ${newInvoice.invoiceNumber}!`);
        return newInvoice;
    };
    const addZoneRequest = (newReq) => {
        const req = {
            id: `req-${Date.now()}`,
            requestNumber: newReq.requestNumber ||
                `#REQ-${Math.floor(8000 + Math.random() * 900)}`,
            requestedBy: newReq.requestedBy || 'Sarah Jenkins',
            avatarInitials: newReq.avatarInitials || 'SJ',
            product: newReq.product || 'Standard Spare Component',
            sku: newReq.sku || 'SKU-STD-01',
            qty: newReq.qty || 1,
            zone: newReq.zone || 'Zone A',
            targetSector: newReq.targetSector || 'Zone A (Main)',
            date: newReq.date || getCurrentDateFormatted(),
            submittedAt: newReq.submittedAt || 'Submitted just now',
            status: 'Requested',
            notes: newReq.notes || 'Emergency requisition.',
            warehouseStock: newReq.warehouseStock || 50,
            managerSignoffNeeded: true,
        };
        setZoneRequests((prev) => [req, ...prev]);
        // Resolve the shop-floor zone and the item to server rows so the
        // request persists (zone_location is required server-side).
        const zoneLocation = locations.find((l) =>
            [l.name, l.code].filter(Boolean).some((v) =>
                String(v).toLowerCase() === String(req.zone || req.targetSector || '').toLowerCase()));
        const zoneItem = items.find((i) =>
            (req.itemId && i.id === req.itemId) ||
            (req.sku && i.sku?.toLowerCase() === String(req.sku).toLowerCase()));
        if (zoneLocation && isServerId(zoneLocation.id)) {
            persistCreate('zoneRequests', {
                ...req,
                zoneLocationId: zoneLocation.id,
                itemId: zoneItem && isServerId(zoneItem.id) ? zoneItem.id : undefined,
                lines: zoneItem && isServerId(zoneItem.id)
                    ? [{ itemId: zoneItem.id, qty: req.qty || 1 }] : [],
            }, setZoneRequests, {
                onServer: (saved) => {
                    repointMovements(req.id, saved?.id);
                    refreshCollections(['zoneRequests', 'inventoryMovements', 'items']);
                },
            });
        }
        showToast(`Requisition ${req.requestNumber} queued.`);
        return req;
    };
    const updateZoneRequestStatus = (id, newStatus) => {
        setZoneRequests((prev) => prev.map((r) => {
            if (r.id !== id)
                return r;
            return { ...r, status: newStatus };
        }));
        // Fulfilled issues stock server-side; re-read afterwards.
        persistUpdate('zoneRequests', id, { status: newStatus }, setZoneRequests);
        if (newStatus === 'Fulfilled') {
            refreshCollections(['zoneRequests', 'inventoryMovements', 'items']);
        }
        if (newStatus === 'Fulfilled') {
            const targetReq = zoneRequests.find((r) => r.id === id);
            if (targetReq) {
                const targetItem = items.find((i) => i.sku?.toLowerCase() === targetReq.sku?.toLowerCase());
                if (targetItem) {
                    recordMovement({
                        itemId: targetItem.id,
                        itemSku: targetItem.sku,
                        itemName: targetItem.name,
                        type: 'ZONE_ISSUE',
                        quantity: -targetReq.qty,
                        unitCost: targetItem.costPrice,
                        referenceType: 'ZoneRequest',
                        referenceId: targetReq.id,
                        referenceNumber: targetReq.requestNumber,
                        notes: `Internal Issue to ${targetReq.zone}`,
                    });
                }
            }
        }
    };
    const updateZoneRequest = updateZoneRequestStatus;
    const addInventoryItem = (item) => {
        const isService = item.itemKind === 'Service';
        const isSerial = item.trackingMode === 'Serial';
        const serials = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
        const calculatedQty = isService ? 0 : (isSerial ? serials.length : (item.availableQty ?? 10));
        const newItem = {
            id: item.id || `itm-${Date.now()}`,
            sku: item.sku || `ITM-${Math.floor(1000 + Math.random() * 9000)}`,
            name: item.name || 'New Hardware Item',
            category: item.category || 'General',
            categoryId: item.categoryId || undefined,
            itemKind: item.itemKind || 'Standalone',
            vendor: item.vendor || '',
            description: item.description || '',
            lifecycleStatus: item.lifecycleStatus || 'Active',
            uom: item.uom || 'Unit',
            purchaseUnit: item.purchaseUnit || item.uom || 'Unit',
            salesUnit: item.salesUnit || item.uom || 'Unit',
            unitConversionFactor: Number(item.unitConversionFactor) || 1,
            // ── [PHASE-2A] Weight-based item fields (Sweven steel: bought/sold by weight) ──
            // isWeightItem marks steel/profiles that are weighed at intake instead of counted;
            // theoreticalWeight = expected kg per unit; tolerancePct = allowed variance %
            //   before a receipt auto-flags 'Pending Approval' (default ±2%).
            isWeightItem: Boolean(item.isWeightItem),
            theoreticalWeight: Number(item.theoreticalWeight) || 0,
            tolerancePct: item.tolerancePct !== undefined && item.tolerancePct !== '' ? Number(item.tolerancePct) : 2,
            weightUnit: item.weightUnit || 'kg',
            trackingMode: isService ? 'None' : (item.trackingMode || 'Quantity'),
            serialNumbers: serials,
            batchNumber: item.batchNumber || undefined,
            lotNumber: item.lotNumber || undefined,
            manufactureDate: item.manufactureDate || undefined,
            expiryDate: item.expiryDate || undefined,
            taxRate: Number(item.taxRate !== undefined ? item.taxRate : 18),
            // ── [PHASE-2E.1] GST compliance: HSN (goods) / SAC (services) code per item ──
            //   Shown on tax invoices & proformas; defaults per steel category.
            hsnCode: item.hsnCode || (item.itemKind === 'Service' ? item.sacCode || '' : mapCategoryToHSN(item.category)),
            sacCode: item.sacCode || '',
            warrantyApplicable: Boolean(item.warrantyApplicable),
            warrantyPeriod: item.warrantyPeriod !== undefined ? Number(item.warrantyPeriod) : 1,
            warrantyUnit: item.warrantyUnit || 'Years',
            warrantyStartEvent: item.warrantyStartEvent || 'Delivery',
            manufacturerWarrantyPeriod: item.manufacturerWarrantyPeriod !== undefined ? Number(item.manufacturerWarrantyPeriod) : undefined,
            manufacturerWarrantyUnit: item.manufacturerWarrantyUnit || undefined,
            availableQty: calculatedQty,
            reservedQty: item.reservedQty ?? 0,
            reorderLevel: item.reorderLevel ?? 5,
            costPrice: item.costPrice ?? 50,
            sellingPrice: item.sellingPrice ?? 90,
            location: item.location || 'Main Central Warehouse',
            status: isService ? 'Optimal' : (calculatedQty <= (item.reorderLevel ?? 5) / 2 ? 'Critical' : calculatedQty <= (item.reorderLevel ?? 5) ? 'Low Stock' : 'Optimal'),
            // Fabric spec (textile catalogue)
            fabricQuality: item.fabricQuality || '',
            fabricDesign: item.fabricDesign || '',
            fabricColor: item.fabricColor || '',
            fabricWidth: item.fabricWidth ?? '',
            fabricGsm: item.fabricGsm ?? '',
            customFieldValues: item.customFieldValues || {},
        };
        setItems((prev) => [newItem, ...prev]);
        // Record initial movement seed for physical items
        if (!isService && newItem.availableQty > 0) {
            recordMovement({
                itemId: newItem.id,
                itemSku: newItem.sku,
                itemName: newItem.name,
                type: 'ADJUSTMENT',
                quantity: newItem.availableQty,
                unitCost: newItem.costPrice,
                referenceType: 'StockAdjustment',
                referenceId: `init-${newItem.id}`,
                referenceNumber: 'INITIAL-STOCK',
                serials: newItem.serialNumbers,
                notes: `Initial master catalog stock intake${newItem.batchNumber ? ` (Batch: ${newItem.batchNumber})` : ''}`,
            });
        }
        showToast(`SKU ${newItem.sku} added to Master.`);
        // Opening stock rides along on the create; after that `availableQty`
        // comes off the movement ledger and is never written directly.
        persistCreate('items', newItem, setItems);
        return newItem;
    };
    const updateInventoryItem = (id, updates) => {
        setItems((prev) => prev.map((item) => {
            if (item.id !== id && item.sku !== id)
                return item;
            const isService = updates.itemKind ? updates.itemKind === 'Service' : item.itemKind === 'Service';
            const isSerial = updates.trackingMode ? updates.trackingMode === 'Serial' : item.trackingMode === 'Serial';
            const serials = updates.serialNumbers !== undefined ? (Array.isArray(updates.serialNumbers) ? updates.serialNumbers : []) : (item.serialNumbers || []);
            const updatedAvailableQty = isService ? 0 : (isSerial ? serials.length : (updates.availableQty !== undefined ? updates.availableQty : item.availableQty));
            const reorderLvl = updates.reorderLevel !== undefined ? updates.reorderLevel : item.reorderLevel;
            const computedStatus = isService
                ? 'Optimal'
                : updatedAvailableQty <= reorderLvl / 2
                ? 'Critical'
                : updatedAvailableQty <= reorderLvl
                ? 'Low Stock'
                : 'Optimal';
            const updated = {
                ...item,
                ...updates,
                serialNumbers: serials,
                availableQty: updatedAvailableQty,
                status: computedStatus,
            };
            return updated;
        }));
        persistUpdate('items', id, updates, setItems);
        showToast(`Item updated successfully.`);
    };
    const addSerialNumbers = (itemId, serials) => {
        if (!Array.isArray(serials) || serials.length === 0) return;
        setItems((prev) => prev.map((item) => {
            if (item.id === itemId || item.sku?.toLowerCase() === itemId?.toLowerCase()) {
                const current = item.serialNumbers || [];
                const updated = Array.from(new Set([...current, ...serials.filter(Boolean)]));
                return {
                    ...item,
                    trackingMode: 'Serial',
                    serialNumbers: updated,
                    availableQty: updated.length,
                };
            }
            return item;
        }));
    };
    const removeSerialNumbers = (itemId, serialsToRemove) => {
        if (!Array.isArray(serialsToRemove) || serialsToRemove.length === 0) return;
        const removeSet = new Set(serialsToRemove.map((s) => String(s).trim().toLowerCase()));
        setItems((prev) => prev.map((item) => {
            if (item.id === itemId || item.sku?.toLowerCase() === itemId?.toLowerCase()) {
                const current = item.serialNumbers || [];
                const updated = current.filter((s) => !removeSet.has(String(s).trim().toLowerCase()));
                return {
                    ...item,
                    serialNumbers: updated,
                    availableQty: updated.length,
                };
            }
            return item;
        }));
    };
    /** The `customers` row for a party the server just returned. */
    const partyAsCustomer = (party) => ({
        id: party.id,
        code: party.code,
        name: party.name,
        contactPerson: party.contacts?.[0]?.name || '',
        email: party.email || '',
        phone: party.phone || '',
        balance: Number(party.balance) || 0,
        creditLimit: Number(party.creditLimit) || 0,
        status: party.status === 'Inactive' ? 'On Hold' : (party.status || 'Active'),
    });

    /** The `vendors` row for the same. */
    const partyAsVendor = (party) => ({
        id: party.id,
        code: party.code,
        name: party.name,
        contactPerson: party.contacts?.[0]?.name || '',
        email: party.email || '',
        phone: party.phone || '',
        balance: Number(party.balance) || 0,
        paymentTerms: party.paymentTerms || 'Net 30',
        status: party.status === 'Inactive' ? 'Inactive' : 'Active',
    });

    const addParty = (p) => {
        const newParty = {
            id: p.id || `pty-${Date.now()}`,
            code: p.code || `PARTY-${String(parties.length + 1).padStart(3, '0')}`,
            type: p.type || 'Customer',
            name: p.name || 'New Enterprise Partner',
            phone: p.phone || '+1 (555) 000-0000',
            email: p.email || 'billing@partner.com',
            gstTreatment: p.gstTreatment || 'Registered Business',
            gstin: p.gstin || '',
            placeOfSupply: p.placeOfSupply || 'Maharashtra (27)',
            gstNotes: p.gstNotes || '',
            vendorType: p.vendorType || '',
            vehicleNumber: p.vehicleNumber || '',
            vehicleType: p.vehicleType || '',
            vehicleCapacity: p.vehicleCapacity ?? '',
            vehicleCapacityUnit: p.vehicleCapacityUnit || 'Tons',
            tdsApplicable: p.tdsApplicable ?? false,
            tdsSection: p.tdsSection || '',
            tdsRate: p.tdsRate ?? 0,
            tcsApplicable: p.tcsApplicable ?? false,
            tcsRate: p.tcsRate ?? 0,
            ledgerAccount: p.ledgerAccount || ((p.type === 'Vendor' || p.type === 'Transporter') ? '2010 - Accounts Payable' : '1210 - Accounts Receivable'),
            creditLimit: p.creditLimit ?? (p.type === 'Vendor' ? 0 : 50000),
            paymentTerms: p.paymentTerms || 'Net 30',
            bankAccountNumber: p.bankAccountNumber || '',
            ifscCode: p.ifscCode || '',
            bankName: p.bankName || '',
            accountHolderName: p.accountHolderName || '',
            openingBalance: p.openingBalance ?? 0,
            balance: p.balance ?? (p.openingBalance ?? 0),
            billingAddress: p.billingAddress || {
                line1: 'Corporate Headquarters',
                line2: '',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
            },
            shippingAddress: p.shippingAddress || {
                line1: 'Corporate Headquarters',
                line2: '',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
            },
            contacts: p.contacts && p.contacts.length > 0 ? p.contacts : [
                { id: `cnt-${Date.now()}`, name: p.name || 'Primary POC', role: 'Business Executive', phone: p.phone || '', email: p.email || '' },
            ],
            status: p.status || 'Active',
        };
        setParties((prev) => [newParty, ...prev]);
        // Also sync into customers / vendors state for backward compatibility.
        // `persist: false` on both: this party is a single row server-side and
        // is posted once, below, not once per projection.
        if (newParty.type === 'Customer' || newParty.type === 'Both') {
            addCustomer({
                id: newParty.id,
                code: newParty.code,
                name: newParty.name,
                contactPerson: newParty.contacts[0]?.name ?? '',
                email: newParty.email,
                phone: newParty.phone,
                balance: newParty.balance,
                creditLimit: newParty.creditLimit ?? 50000,
                status: newParty.status === 'Inactive' ? 'On Hold' : 'Active',
            }, { persist: false });
        }
        if (newParty.type === 'Vendor' || newParty.type === 'Both') {
            addVendor({
                id: newParty.id,
                code: newParty.code,
                name: newParty.name,
                category: 'General',
                contactPerson: newParty.contacts[0]?.name ?? '',
                email: newParty.email,
                phone: newParty.phone,
                balance: newParty.balance,
                paymentTerms: newParty.paymentTerms ?? 'Net 30',
                status: newParty.status === 'Active' ? 'Active' : 'Inactive',
            }, { persist: false });
        }
        showToast(`Party ${newParty.name} (${newParty.type}) registered.`);
        // The server allocates the CUST-/VEND- code, so the row the user sees
        // after the round trip carries the real one.
        persistCreate('parties', newParty, setParties, {
            also: [
                { setter: setCustomers, map: partyAsCustomer },
                { setter: setVendors, map: partyAsVendor },
            ],
        });
        return newParty;
    };
    const updateParty = (id, updates) => {
        setParties((prev) => prev.map((p) => (p.id === id || p.code === id ? { ...p, ...updates } : p)));
        persistUpdate('parties', id, updates, setParties);
        showToast(`Party updated.`);
    };
    const addUnit = (u) => {
        const newUnit = {
            id: u.id || `uom-${Date.now()}`,
            code: u.code || 'unit',
            label: u.label || u.code || 'Unit',
        };
        setUnits((prev) => [...prev, newUnit]);
        showToast(`Unit ${newUnit.label} added.`);
        persistCreate('units', newUnit, setUnits);
        return newUnit;
    };
    const addCategoryPart = (part) => {
        const newPart = {
            id: part.id || `cp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            categoryId: part.categoryId,
            itemId: part.itemId,
            defaultQty: Number(part.defaultQty) || 1,
        };
        setCategoryParts((prev) => [...prev, newPart]);
        showToast(`Sub-part linked to category BOM.`);
        return newPart;
    };
    const removeCategoryPart = (id) => {
        setCategoryParts((prev) => prev.filter((p) => p.id !== id));
        showToast(`Sub-part removed from category BOM.`);
    };
    const addItemPart = (part) => {
        const newItemPart = {
            id: part.id || `ip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            parentItemId: part.parentItemId || '',
            partItemId: part.partItemId || '',
            requiredQty: Number(part.requiredQty) || 1,
        };
        setItemParts((prev) => [...prev, newItemPart]);
        // Machine BOM feeds the backend explosion service — both ends must be
        // saved items, otherwise the row stays local-only.
        if (isServerId(newItemPart.parentItemId) && isServerId(newItemPart.partItemId)) {
            persistCreate('itemParts', newItemPart, setItemParts);
        }
        showToast(`BOM part linked to machine.`);
        return newItemPart;
    };
    const updateItemPart = (id, updates) => {
        setItemParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
        persistUpdate('itemParts', id, updates, setItemParts);
        showToast(`Machine BOM part updated.`);
    };
    const removeItemPart = (id) => {
        setItemParts((prev) => prev.filter((p) => p.id !== id));
        persistDelete('itemParts', id);
        showToast(`Machine BOM part removed.`);
    };

    // Derived compatibility helpers for customers / vendors
    const customersFromParties = parties
        .filter((p) => p.type === 'Customer' || p.type === 'Both')
        .map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            contactPerson: p.contacts?.[0]?.name ?? '',
            email: p.email,
            phone: p.phone,
            balance: p.balance,
            creditLimit: p.creditLimit ?? 0,
            status: p.status === 'Inactive' ? 'On Hold' : 'Active',
        }));

    const vendorsFromParties = parties
        .filter((p) => p.type === 'Vendor' || p.type === 'Both')
        .map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            category: 'General',
            contactPerson: p.contacts?.[0]?.name ?? '',
            email: p.email,
            phone: p.phone,
            balance: p.balance,
            paymentTerms: p.paymentTerms ?? 'Net 30',
            status: p.status === 'Active' ? 'Active' : 'Inactive',
        }));
    const adjustItemStock = (idOrSku, adjustment, isAbsolute = false, reason = 'Manual Stock Adjustment') => {
        const targetItem = items.find((i) => i.id === idOrSku || i.sku?.toLowerCase() === idOrSku?.toLowerCase());
        if (!targetItem)
            return;
        const diff = isAbsolute ? adjustment - targetItem.availableQty : adjustment;
        if (diff === 0)
            return;
        const mirror = recordMovement({
            itemId: targetItem.id,
            itemSku: targetItem.sku,
            itemName: targetItem.name,
            type: 'ADJUSTMENT',
            quantity: diff,
            unitCost: targetItem.costPrice,
            referenceType: 'StockAdjustment',
            referenceId: `adj-${Date.now()}`,
            referenceNumber: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
            notes: reason,
        });
        // Server-side adjustment posts the ADJUSTMENT movement authoritatively
        // (api.md §7.2); drop the local mirror once posted and re-read.
        if (isBackendEnabled() && isServerId(targetItem.id)) {
            api.post('/inventory/adjustments/', {
                itemId: targetItem.id,
                quantity: diff,
                isAbsolute: false,
                reason,
            }).then(() => {
                if (mirror?.id) {
                    setInventoryMovements((prev) => prev.filter((m) => m.id !== mirror.id));
                }
                refreshCollections(['items', 'inventoryMovements']);
            }).catch((err) => {
                console.warn('[ERP] stock adjustment not saved:', err);
                showToast(`Adjustment not saved to server — ${describeError(err)}`);
            });
        }
        showToast(`Stock for ${targetItem.sku} adjusted by ${diff > 0 ? '+' : ''}${diff} units.`);
    };
    const addCustomer = (cust, { persist = true } = {}) => {
        const newCust = {
            id: cust.id || `cust-${Date.now()}`,
            code: cust.code || `CUST-${String(customers.length + 1).padStart(3, '0')}`,
            name: cust.name || 'New Client Account',
            contactPerson: cust.contactPerson || 'Account Executive',
            email: cust.email || 'billing@client.com',
            phone: cust.phone || '+1 (555) 000-0000',
            balance: cust.balance ?? 0,
            creditLimit: cust.creditLimit ?? 25000,
            status: cust.status || 'Active',
        };
        setCustomers((prev) => {
            const exists = prev.some(c => c.id === newCust.id || c.code === newCust.code);
            return exists ? prev.map(c => c.id === newCust.id ? { ...c, ...newCust } : c) : [newCust, ...prev];
        });

        // Synchronize automatically with Parties
        setParties((prev) => {
            const exists = prev.some(p => p.id === newCust.id || p.code === newCust.code || (p.name && String(p.name ?? '').toLowerCase() === String(newCust.name ?? '').toLowerCase()));
            if (exists) {
                return prev.map(p => (p.id === newCust.id || p.code === newCust.code || (p.name && String(p.name ?? '').toLowerCase() === String(newCust.name ?? '').toLowerCase())) ? {
                    ...p,
                    name: newCust.name,
                    email: newCust.email || p.email,
                    phone: newCust.phone || p.phone,
                    balance: newCust.balance ?? p.balance,
                    creditLimit: newCust.creditLimit ?? p.creditLimit,
                } : p);
            }
            const newParty = {
                id: newCust.id,
                code: newCust.code,
                name: newCust.name,
                type: 'Customer',
                partyType: 'Customer',
                contactPerson: newCust.contactPerson,
                email: newCust.email,
                phone: newCust.phone,
                balance: newCust.balance ?? 0,
                creditLimit: newCust.creditLimit ?? 25000,
                status: newCust.status || 'Active',
                billingAddress: { line1: 'Corporate Headquarters', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
                shippingAddress: { line1: 'Corporate Headquarters', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
                contacts: [{ id: `cnt-${Date.now()}`, name: newCust.contactPerson || newCust.name, role: 'Primary Contact', phone: newCust.phone, email: newCust.email }],
            };
            return [newParty, ...prev];
        });

        showToast(`Customer ${newCust.name} created and synced to Parties.`);
        // `persist: false` when called from addParty, which posts the party itself.
        if (persist) {
            persistCreate('parties', { ...newCust, type: 'Customer' }, setParties, {
                also: [{ setter: setCustomers, map: partyAsCustomer }],
            });
        }
        return newCust;
    };
    const updateCustomer = (id, updates) => {
        setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
        setParties((prev) => prev.map((p) => (p.id === id || p.code === id ? { ...p, ...updates } : p)));
        persistUpdate('customers', id, updates, setCustomers);
    };
    const addVendor = (ven, { persist = true } = {}) => {
        const newVendor = {
            id: ven.id || `ven-${Date.now()}`,
            code: ven.code || `VEND-${String(vendors.length + 1).padStart(3, '0')}`,
            name: ven.name || 'New Supplier Entity',
            category: ven.category || 'Direct Hardware',
            contactPerson: ven.contactPerson || 'Vendor Rep',
            email: ven.email || 'sales@vendor.com',
            phone: ven.phone || '+1 (555) 000-0000',
            balance: ven.balance ?? 0,
            paymentTerms: ven.paymentTerms || 'Net 30',
            status: ven.status || 'Active',
        };
        setVendors((prev) => {
            const exists = prev.some(v => v.id === newVendor.id || v.code === newVendor.code);
            return exists ? prev.map(v => v.id === newVendor.id ? { ...v, ...newVendor } : v) : [newVendor, ...prev];
        });

        // Synchronize automatically with Parties
        setParties((prev) => {
            const exists = prev.some(p => p.id === newVendor.id || p.code === newVendor.code || (p.name && String(p.name ?? '').toLowerCase() === String(newVendor.name ?? '').toLowerCase()));
            if (exists) {
                return prev.map(p => (p.id === newVendor.id || p.code === newVendor.code || (p.name && String(p.name ?? '').toLowerCase() === String(newVendor.name ?? '').toLowerCase())) ? {
                    ...p,
                    name: newVendor.name,
                    email: newVendor.email || p.email,
                    phone: newVendor.phone || p.phone,
                    balance: newVendor.balance ?? p.balance,
                    paymentTerms: newVendor.paymentTerms ?? p.paymentTerms,
                } : p);
            }
            const newParty = {
                id: newVendor.id,
                code: newVendor.code,
                name: newVendor.name,
                type: 'Vendor',
                partyType: 'Vendor',
                category: newVendor.category,
                contactPerson: newVendor.contactPerson,
                email: newVendor.email,
                phone: newVendor.phone,
                balance: newVendor.balance ?? 0,
                paymentTerms: newVendor.paymentTerms || 'Net 30',
                status: newVendor.status || 'Active',
                billingAddress: { line1: 'Supplier Facility', city: 'Delhi', state: 'Delhi', pincode: '110001' },
                shippingAddress: { line1: 'Supplier Facility', city: 'Delhi', state: 'Delhi', pincode: '110001' },
                contacts: [{ id: `cnt-${Date.now()}`, name: newVendor.contactPerson || newVendor.name, role: 'Sales Contact', phone: newVendor.phone, email: newVendor.email }],
            };
            return [newParty, ...prev];
        });

        showToast(`Vendor ${newVendor.name} added and synced to Parties.`);
        if (persist) {
            persistCreate('parties', { ...newVendor, type: 'Vendor' }, setParties, {
                also: [{ setter: setVendors, map: partyAsVendor }],
            });
        }
        return newVendor;
    };
    const updateVendor = (id, updates) => {
        setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
        setParties((prev) => prev.map((p) => (p.id === id || p.code === id ? { ...p, ...updates } : p)));
        persistUpdate('vendors', id, updates, setVendors);
    };
    const addCategory = (cat) => {
        const newCat = {
            id: cat.id || `cat-${Date.now()}`,
            name: cat.name || 'Hardware Category',
            code: (cat.code || 'GEN').toUpperCase(),
            itemCount: 0,
            totalValuation: 0,
            leadTimeDays: cat.leadTimeDays ?? 7,
            hasSubParts: cat.hasSubParts ?? false,
            description: cat.description || '',
            customFields: cat.customFields || [],
        };
        setCategories((prev) => [...prev, newCat]);
        showToast(`Category ${newCat.name} registered.`);
        persistCreate('categories', newCat, setCategories);
        return newCat;
    };
    const updateCategory = (id, updates) => {
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
        persistUpdate('categories', id, updates, setCategories);
        showToast(`Category updated.`);
    };
    // ── ESTIMATES ACTIONS ──────────────────────────────────────────────
    // The CRM screens read estimates through `services/estimateStore`.
    useEffect(() => {
        publishEstimates(estimates, { addEstimate, updateEstimate });
    }, [estimates]);

    const addEstimate = (est) => {
        const estAmount = est.amount ||
            (est.items ? est.items.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0) : 0) || 5000;
        const defaultAddresses = resolvePartyAddresses(est.customerId, est.customer);
        const newEst = {
            id: est.id || `est-${Date.now()}`,
            estimateNumber: est.estimateNumber || `EST-2026-${String(estimates.length + 1).padStart(3, '0')}`,
            customerId: est.customerId,
            customer: est.customer || 'Acme Corp',
            contactPerson: est.contactPerson || '',
            billingAddress: createAddressSnapshot(est.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(est.shippingAddress) || defaultAddresses.shipping,
            date: formatDateDDMMYYYY(est.date || 'Today'),
            validUntil: est.validUntil || '15 Days',
            validityDays: est.validityDays ?? '',
            paymentTerms: est.paymentTerms || '',
            leadId: est.leadId ? String(est.leadId) : '',
            leadName: est.leadName || '',
            amount: estAmount,
            status: est.status || 'Draft',
            items: est.items || [],
            discountTotal: est.discountTotal ?? 0,
            freightCharges: est.freightCharges ?? 0,
            otherCharges: est.otherCharges ?? 0,
            loadingCharges: est.loadingCharges ?? 0,
            terms: est.terms || '',
            notes: est.notes || 'Preliminary cost estimate',
        };
        setEstimates((prev) => [newEst, ...prev]);
        showToast(`Estimate ${newEst.estimateNumber} created.`);
        persistCreate('estimates', newEst, setEstimates);
        return newEst;
    };
    const updateEstimate = (id, updates) => {
        setEstimates((prev) => prev.map((e) => (e.id === id ? {
            ...e,
            ...updates,
            billingAddress: updates.billingAddress ? createAddressSnapshot(updates.billingAddress) : e.billingAddress,
            shippingAddress: updates.shippingAddress ? createAddressSnapshot(updates.shippingAddress) : e.shippingAddress,
        } : e)));
        persistUpdate('estimates', id, updates, setEstimates);
        showToast(`Estimate updated.`);
    };
    const deleteEstimate = (id) => {
        setEstimates((prev) => prev.filter((e) => e.id !== id));
        persistDelete('estimates', id);
        showToast(`Estimate deleted.`);
    };
    const convertEstimateToQuotation = (estimateId) => {
        const est = estimates.find((e) => e.id === estimateId);
        if (!est) return undefined;
        if (est.status === 'Converted') {
            showToast(`Estimate ${est.estimateNumber} has already been converted.`);
            return undefined;
        }
        setEstimates((prev) => prev.map((e) => (e.id === estimateId ? { ...e, status: 'Converted' } : e)));
        persistUpdate('estimates', estimateId, { status: 'Converted' }, setEstimates);
        const newQuote = {
            customerId: est.customerId,
            customer: est.customer,
            billingAddress: createAddressSnapshot(est.billingAddress),
            shippingAddress: createAddressSnapshot(est.shippingAddress),
            date: getCurrentDateFormatted(),
            validUntil: 'In 30 days',
            amount: est.amount,
            status: 'Draft',
            items: est.items || [],
            sourceEstimateId: est.id,
            sourceEstimateNumber: est.estimateNumber,
            notes: `Converted from Estimate ${est.estimateNumber}. ${est.notes || ''}`,
        };
        const created = addQuotation(newQuote);
        showToast(`Estimate ${est.estimateNumber} converted to Quotation ${created.quoteNumber}!`);
        return created;
    };

    const addQuotation = (quote) => {
        const totalAmount = quote.amount ??
            (quote.items ? quote.items.reduce((acc, it) => acc + (it.amount ?? it.qty * it.rate), 0) : 0);
        const defaultAddresses = resolvePartyAddresses(quote.customerId, quote.customer);
        const newQ = {
            id: quote.id || `q-${Date.now()}`,
            quoteNumber: quote.quoteNumber || `EST-2026-${String(quotations.length + 91).padStart(3, '0')}`,
            dealId: quote.dealId,
            dealReference: quote.dealReference,
            terms: quote.terms,
            termsAndConditions: quote.termsAndConditions,
            freight: quote.freight,
            sourceEstimateId: quote.sourceEstimateId,
            sourceEstimateNumber: quote.sourceEstimateNumber,
            customerId: quote.customerId,
            customer: quote.customer || 'Acme Corp',
            contactPerson: quote.contactPerson || '',
            salesPerson: quote.salesPerson || '',
            broker: quote.broker || '',
            paymentTerms: quote.paymentTerms || '',
            deliveryDate: quote.deliveryDate || '',
            validityDays: quote.validityDays ?? '',
            discountTotal: quote.discountTotal ?? 0,
            freightCharges: quote.freightCharges ?? 0,
            otherCharges: quote.otherCharges ?? 0,
            loadingCharges: quote.loadingCharges ?? 0,
            billingAddress: createAddressSnapshot(quote.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(quote.shippingAddress) || defaultAddresses.shipping,
            date: formatDateDDMMYYYY(quote.date || 'Today'),
            leadId: quote.leadId || '',
            leadName: quote.leadName || '',
            validUntil: quote.validUntil || 'In 30 days',
            amount: totalAmount,
            status: quote.status || 'Draft',
            items: quote.items || [],
            notes: quote.notes || 'Commercial quotation',
        };
        setQuotations((prev) => [newQ, ...prev]);
        showToast(`Quotation ${newQ.quoteNumber} issued.`);
        persistCreate('quotations', newQ, setQuotations);
        return newQ;
    };
    const recordQuotationActivity = (id, type) => {
        const event = { id: crypto.randomUUID(), type, quotationId: id, timestamp: new Date().toISOString() };
        setQuotations(prev => prev.map(q => q.id === id ? { ...q, activity: [...(q.activity || []), event] } : q));
    };
    const syncQuotationShare = (id, share) => {
        const current = quotations.find((q) => String(q.id) === String(id));
        const viewedNow = [...(current?.activity || []), ...(share.events || [])].some((event) => event.type === 'Quotation Viewed');
        const nextStatus = current && ['Draft', 'Sent', 'Viewed'].includes(current.status)
            ? (share.decision || (viewedNow ? 'Viewed' : current.status))
            : current?.status;
        setQuotations(prev => prev.map(q => {
            if (q.id !== id) return q;
            const events = new Map([...(q.activity || []), ...(share.events || [])].map(event => [event.id, event]));
            const activity = [...events.values()].sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
            const viewed = activity.some(event => event.type === 'Quotation Viewed');
            return { ...q, share: { token: share.token, url: share.url, expiresAt: share.expiresAt, allowDownload: share.allowDownload, allowAcceptance: share.allowAcceptance, localOnly: share.localOnly }, activity,
                status: ['Draft', 'Sent', 'Viewed'].includes(q.status) ? (share.decision || (viewed ? 'Viewed' : q.status)) : q.status };
        }));
        if (current && current.status !== 'Viewed' && nextStatus === 'Viewed') {
            persistUpdate('quotations', id, { status: nextStatus }, setQuotations);
            emitCrmEvent({
                type: CRM_EVENT_TYPES.QUOTATION_VIEWED,
                entityType: 'quotation',
                entityId: id,
                payload: {
                    quoteRef: current.quoteNumber,
                    customerId: current.customerId,
                    customerName: current.customer,
                    dealId: current.dealId,
                    path: current.dealId ? `/crm/deals?deal=${encodeURIComponent(current.dealId)}` : '/crm/quotations',
                },
            });
        }
    };
    const convertQuotationToDeliveryChallan = (id) => {
        const quote = quotations.find(q => q.id === id);
        if (!quote) return;
        const existing = deliveryChallans.find(dc => dc.sourceQuotationId === id);
        if (existing) return existing;
        if (['Rejected', 'Expired'].includes(quote.status) || !quote.items?.length) {
            showToast('An active quotation with line items is required.');
            return;
        }
        const challan = addDeliveryChallan({
            sourceQuotationId: quote.id, sourceQuotationNumber: quote.quoteNumber,
            customerId: quote.customerId, customer: quote.customer,
            billingAddress: quote.billingAddress, shippingAddress: quote.shippingAddress,
            leadId: quote.leadId, dealId: quote.dealId, status: 'Draft',
            date: getCurrentDateFormatted(), dispatchDate: '', transporter: '', vehicleNo: '',
            items: quote.items.map(item => ({ ...item })),
        });
        setQuotations(prev => prev.map(q => q.id === id ? { ...q, deliveryChallanId: challan.id,
            activity: [...(q.activity || []), { id: crypto.randomUUID(), type: `Delivery challan ${challan.challanNumber} created`, quotationId: id, timestamp: new Date().toISOString() }] } : q));
        return challan;
    };
    /**
     * Customer approval of a quotation (`Accepted` / `Approved`).
     *
     * Server rows go through `POST /sales/quotations/{id}/approve/`, which
     * marks the quotation Accepted AND converts the linked lead into a
     * Customer/Party in one transaction — the response carries
     * `{ customer, lead, message }`. Local-only rows just flip status.
     * Never creates a Sales Order; that stays an explicit next step.
     */
    const approveQuotation = async (id) => {
        const target = quotations.find((q) => String(q.id) === String(id));
        if (!target) return null;
        if (!isBackendEnabled() || !isServerId(id)) {
            setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'Accepted' } : q)));
            showToast('Quotation approved. Lead has been converted to Customer successfully.');
            return { customer: null };
        }
        try {
            const { saved, envelope } = await postDocumentAction('quotations', id, 'approve', {});
            if (saved) reconcile(setQuotations, id, { ...saved, status: 'Accepted' });
            else setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'Accepted' } : q)));
            // The new/linked customer must be visible for the Sales Order step.
            refreshFromBackend();
            showToast(envelope?.message || 'Quotation approved. Lead has been converted to Customer successfully.');
            return envelope;
        } catch (err) {
            console.warn('[ERP] quotations/approve failed:', err);
            markSyncFailure(setQuotations, id, err);
            showToast(`Quotation approval failed — ${describeError(err)}`);
            throw err;
        }
    };
    const updateQuotationStatus = (id, status) => {
        const target = quotations.find((q) => String(q.id) === String(id));
        // Approval always flows through the approve endpoint so the linked
        // lead is converted server-side; a plain PATCH cannot do that (and
        // non-draft rows reject PATCH outright, api.md §1.9).
        if (['Accepted', 'Approved'].includes(status)) {
            setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'Accepted' } : q)));
            approveQuotation(id).catch(() => {
                // approveQuotation already toasted; roll the optimistic flip
                // back only when the server rejected it.
                if (target && isServerId(id)) {
                    setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status: target.status } : q)));
                }
            });
            return;
        }
        setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
        // Only draft-like quotations accept PATCH (api.md §1.9); posted ones
        // move via convert/cancel actions.
        if (!target || ['Draft', 'Sent'].includes(target.status)) {
            persistUpdate('quotations', id, { status }, setQuotations);
        }
        if (target && target.status !== 'Sent' && status === 'Sent') {
            emitCrmEvent({
                type: CRM_EVENT_TYPES.QUOTATION_SENT,
                entityType: 'quotation',
                entityId: id,
                payload: {
                    quoteRef: target.quoteNumber,
                    customerId: target.customerId,
                    customerName: target.customer,
                    path: target.dealId ? `/crm/deals?deal=${encodeURIComponent(target.dealId)}` : '/crm/quotations',
                },
            });
        }
    };
    const convertQuotationToSalesOrder = (quoteId) => {
        const quote = quotations.find((q) => q.id === quoteId);
        if (!quote)
            return undefined;
        updateQuotationStatus(quoteId, 'Confirmed');
        const orderItems = quote.items && quote.items.length > 0 ? quote.items.map((line, idx) => ({
            id: line.id || `item-${Date.now()}-${idx}`,
            itemId: line.itemId || '',
            sku: line.sku || line.itemSku || '',
            itemSku: line.sku || line.itemSku || '',
            name: line.name || line.description || `Deliverable Item ${idx + 1}`,
            description: line.name || line.description || `Deliverable Item ${idx + 1}`,
            orderedQty: Number(line.qty) || 1,
            qty: Number(line.qty) || 1,
            deliveredQty: 0,
            invoicedQty: 0,
            remainingQty: Number(line.qty) || 1,
            rate: Number(line.rate) || 0,
            discount: Number(line.discount) || 0,
            tax: Number(line.tax) || 18,
            amount: Number(line.amount) || ((Number(line.qty) || 1) * (Number(line.rate) || 0)),
        })) : [
            {
                id: `item-${Date.now()}`,
                description: `Deliverables per ${quote.quoteNumber}`,
                orderedQty: 1,
                qty: 1,
                deliveredQty: 0,
                invoicedQty: 0,
                remainingQty: 1,
                rate: quote.amount,
                amount: quote.amount,
            },
        ];
        const newOrder = {
            id: `so-${Date.now()}`,
            orderNumber: `SO-2026-${String(salesOrders.length + 101).padStart(4, '0')}`,
            quotationId: quote.id,
            quotationNumber: quote.quoteNumber,
            sourceQuotationId: quote.id,
            sourceQuotationNumber: quote.quoteNumber,
            dealId: quote.dealId,
            dealReference: quote.dealReference,
            terms: quote.terms,
            termsAndConditions: quote.termsAndConditions,
            freight: quote.freight,
            sourceEstimateId: quote.sourceEstimateId,
            sourceEstimateNumber: quote.sourceEstimateNumber,
            customerId: quote.customerId,
            customer: quote.customer,
            billingAddress: createAddressSnapshot(quote.billingAddress),
            shippingAddress: createAddressSnapshot(quote.shippingAddress),
            date: getCurrentDateFormatted(),
            deliveryDate: 'In 14 days',
            amount: quote.amount,
            stage: 'Confirmed',
            status: 'Confirmed',
            paymentStatus: 'Unpaid',
            items: orderItems,
            lineItems: orderItems,
        };
        setSalesOrders((prev) => [newOrder, ...prev]);
        showToast(`Quote ${quote.quoteNumber} converted to Sales Order ${newOrder.orderNumber}!`);
        persistCreate('salesOrders', newOrder, setSalesOrders);
        return newOrder;
    };
    const addSalesOrder = (order) => {
        const orderAmt = order.amount ||
            (order.items ? order.items.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0) : 0) || 5000;
        const defaultAddresses = resolvePartyAddresses(order.customerId, order.customer);
        const formattedItems = (order.items || []).map((line, idx) => ({
            ...line,
            id: line.id || `item-${Date.now()}-${idx}`,
            orderedQty: Number(line.orderedQty ?? line.qty ?? 1),
            qty: Number(line.qty ?? line.orderedQty ?? 1),
            deliveredQty: Number(line.deliveredQty ?? 0),
            invoicedQty: Number(line.invoicedQty ?? 0),
            remainingQty: Math.max(0, Number(line.orderedQty ?? line.qty ?? 1) - Number(line.deliveredQty ?? 0)),
            rate: Number(line.rate ?? 0),
            amount: Number(line.amount ?? (Number(line.qty ?? 1) * Number(line.rate ?? 0))),
        }));
        const newOrder = {
            id: order.id || `so-${Date.now()}`,
            orderNumber: order.orderNumber ||
                `SO-2026-${String(salesOrders.length + 101).padStart(4, '0')}`,
            quotationId: order.quotationId,
            quotationNumber: order.quotationNumber,
            sourceQuotationId: order.sourceQuotationId || order.quotationId,
            sourceQuotationNumber: order.sourceQuotationNumber || order.quotationNumber,
            sourceEstimateId: order.sourceEstimateId,
            sourceEstimateNumber: order.sourceEstimateNumber,
            customerId: order.customerId,
            customer: order.customer || 'Acme Corp',
            billingAddress: createAddressSnapshot(order.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(order.shippingAddress) || defaultAddresses.shipping,
            date: formatDateDDMMYYYY(order.date || 'Today'),
            deliveryDate: order.deliveryDate || addDaysISO(getCurrentISODate(), 10),
            amount: orderAmt,
            stage: order.stage || 'Draft',
            status: order.stage || 'Draft',
            paymentStatus: order.paymentStatus || 'Unpaid',
            items: formattedItems,
            lineItems: formattedItems,
            notes: order.notes || '',
        };
        setSalesOrders((prev) => [newOrder, ...prev]);
        showToast(`Sales Order ${newOrder.orderNumber} created.`);
        persistCreate('salesOrders', newOrder, setSalesOrders);
        return newOrder;
    };
    const updateSalesOrderStage = (id, stage) => {
        const current = salesOrders.find((o) => o.id === id);
        setSalesOrders((prev) => prev.map((o) => (o.id === id ? { ...o, stage, status: stage } : o)));
        // Only drafts accept PATCH (api.md §1.9); posted orders move via
        // dispatch/cancel actions.
        if (!current || current.stage === 'Draft') {
            persistUpdate('salesOrders', id, { stage, status: stage }, setSalesOrders);
        }
    };
    const cancelSalesOrder = (orderId) => {
        const order = salesOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, message: 'Order not found.' };
        if (order.stage === 'Cancelled' || order.status === 'Cancelled') {
            return { success: true, message: 'Already cancelled.' };
        }
        setSalesOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stage: 'Cancelled', status: 'Cancelled' } : o)));
        // Server-side cancel releases reservations; re-read afterwards.
        runDocAction('salesOrders', orderId, 'cancel', {}, setSalesOrders, {
            refresh: ['salesOrders', 'deliveryChallans'],
        }).catch(() => {});
        showToast(`Sales Order ${order.orderNumber} cancelled.`);
        return { success: true, message: `Sales Order ${order.orderNumber} cancelled.` };
    };
    const convertSalesOrderToChallan = (orderId) => {
        const order = salesOrders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        if (order.stage === 'Cancelled') {
            showToast(`Cannot create Challan from Cancelled Sales Order.`);
            return undefined;
        }
        // ── [PHASE-2C] QC gate — never dispatch unchecked steel ──
        // Lines still to dispatch that trace back to a Pending/Rejected/Rework inbound
        //   receipt are held until QC clears (updateQCStatus → 'Approved').
        const inboundHold = (order.items || []).filter((line) =>
            Number(line.remainingQty ?? (Number(line.orderedQty ?? line.qty ?? 0) - Number(line.deliveredQty || 0))) > 0 &&
            getItemQCBlock(line.itemId || line.itemSku || line.sku)
        );
        if (inboundHold.length > 0) {
            showToast(`Dispatch blocked — QC pending/rejected for: ${inboundHold.map((l) => l.name || l.description || 'item').join(', ')}. Approve inbound QC before dispatch.`);
            return undefined;
        }
        
        // Prepare line items for delivery (dispatch remaining quantities)
        const dispatchLines = (order.items || []).map((line) => {
            const ordQty = Number(line.orderedQty ?? line.qty ?? 1);
            const delQty = Number(line.deliveredQty ?? 0);
            const remQty = Math.max(0, ordQty - delQty);
            return {
                ...line,
                qty: remQty > 0 ? remQty : ordQty,
                dispatchedQty: remQty > 0 ? remQty : ordQty,
            };
        });

        const newChallan = {
            id: `dc-${Date.now()}`,
            challanNumber: `DC-2026-${String(deliveryChallans.length + 80).padStart(3, '0')}`,
            salesOrderId: order.id,
            salesOrderNumber: order.orderNumber,
            sourceSalesOrderId: order.id,
            sourceSalesOrderNumber: order.orderNumber,
            linkedSo: order.orderNumber,
            customerId: order.customerId,
            customer: order.customer,
            billingAddress: createAddressSnapshot(order.billingAddress),
            shippingAddress: createAddressSnapshot(order.shippingAddress),
            date: getCurrentDateFormatted(),
            dispatchDate: getCurrentDateFormatted(),
            transporter: '',
            vehicleNo: '',
            status: 'In Transit',
            items: dispatchLines,
            lineItems: dispatchLines,
        };

        return addDeliveryChallan(newChallan);
    };
    const convertSalesOrderToInvoice = (orderId) => {
        const order = salesOrders.find((o) => o.id === orderId);
        if (!order)
            return undefined;
        if (order.stage === 'Cancelled') {
            showToast(`Cannot create Invoice from Cancelled Sales Order.`);
            return undefined;
        }

        // ── [PHASE-2B] Double-billing guard: only invoice REMAINING qty per line ──
        // Previously this built invoices from full ordered qty every time (line qty was
        //   copied 1:1) with no deliveredQty/invoicedQty check and no block on an already
        //   fully-invoiced SO. Now each line invoices (ordered − invoiced) and a fully
        //   invoiced order is blocked — the mirror of PO→GRN→Bill integrity.
        const srcLines = (order.items && order.items.length > 0)
            ? order.items
            : (order.lineItems && order.lineItems.length > 0)
                ? order.lineItems
                : [];
        const totalOrderedQty = srcLines.reduce((s, l) => s + (Number(l.orderedQty ?? l.qty) || 0), 0);
        const totalInvoicedQty = srcLines.reduce((s, l) => s + (Number(l.invoicedQty) || 0), 0);
        const fullyInvoiced = totalOrderedQty > 0 && totalInvoicedQty >= totalOrderedQty - 0.001;
        if (fullyInvoiced && srcLines.length > 0) {
            showToast(`Sales Order ${order.orderNumber} is already fully invoiced (${totalInvoicedQty}/${totalOrderedQty} qty).`);
            return undefined;
        }

        const sourceLines = (order.items && order.items.length > 0)
            ? order.items
            : (order.lineItems && order.lineItems.length > 0)
                ? order.lineItems
                : [];
        const itemsList = sourceLines.length > 0
            ? sourceLines.map((line, idx) => {
                const orderedQty = Number(line.qty || line.orderedQty || 1);
                const alreadyInvoiced = Number(line.invoicedQty) || 0;
                const remainingQty = Math.max(0, orderedQty - alreadyInvoiced);
                return {
                    id: line.id || `item-${Date.now()}-${idx}`,
                    itemId: line.itemId || '',
                    sku: line.sku || line.itemSku || '',
                    itemSku: line.sku || line.itemSku || '',
                    name: line.name || line.description || `Deliverable Item ${idx + 1}`,
                    description: line.name || line.description || `Deliverable Item ${idx + 1}`,
                    // [PHASE-2B] qty now reflects remaining (ordered − invoiced); old code used full qty
                    qty: remainingQty || 1,
                    orderedQty,
                    alreadyInvoicedQty: alreadyInvoiced,
                    rate: line.rate || 0,
                    discount: line.discount || line.discountPercent || 0,
                    tax: line.tax !== undefined ? line.tax : (line.taxRate !== undefined ? line.taxRate : 18),
                    amount: (remainingQty || 1) * (line.rate || 0),
                };
            })
            : [
                {
                    id: `item-${Date.now()}`,
                    description: `Fulfillment of ${order.orderNumber}`,
                    name: `Fulfillment of ${order.orderNumber}`,
                    qty: 1,
                    rate: order.amount ?? 1000,
                    discount: 0,
                    tax: 18,
                    amount: order.amount ?? 1000,
                },
            ];

        // Check if Delivery Challan exists for this SO
        const hasChallan = deliveryChallans.some((dc) => dc.salesOrderId === order.id || dc.salesOrderNumber === order.orderNumber || dc.linkedSo === order.orderNumber);

        const newInvoice = {
            id: `inv-${Date.now()}`,
            invoiceNumber: `INV-2026-${String(invoices.length + 101).padStart(3, '0')}`,
            salesOrderId: order.id,
            sourceSalesOrderId: order.id,
            customerId: order.customerId,
            customer: order.customer,
            billingAddress: createAddressSnapshot(order.billingAddress),
            shippingAddress: createAddressSnapshot(order.shippingAddress),
            linkedSo: order.orderNumber,
            date: getCurrentDateFormatted(),
            dueDate: addDaysISO(getCurrentISODate(), 30),
            status: 'Unpaid',
            items: itemsList,
            lineItems: itemsList,
            notes: `Tax invoice generated for Sales Order ${order.orderNumber}.`,
            dispatchedViaChallan: hasChallan,
        };

        const createdInvoice = createInvoice(newInvoice);

        // Update SO line items invoicedQty and stage
        let updatedSo = null;
        setSalesOrders((prev) => prev.map((o) => {
            if (o.id !== orderId) return o;
            const updatedItems = (o.items || []).map((line) => {
                const orderedQty = Number(line.qty || line.orderedQty) || 1;
                const remaining = Math.max(0, orderedQty - (Number(line.invoicedQty) || 0));
                // [PHASE-2B] invoicedQty now increments by the invoiced (remaining) qty
                return {
                    ...line,
                    invoicedQty: (line.invoicedQty || 0) + remaining,
                };
            });
            const stillOpen = updatedItems.some((l) => (Number(l.qty ?? l.orderedQty) || 1) - (Number(l.invoicedQty) || 0) > 0.001);
            return updatedSo = {
                ...o,
                stage: stillOpen ? 'Partially Invoiced' : 'Invoiced',
                status: stillOpen ? 'Partially Invoiced' : 'Invoiced',
                items: updatedItems,
                lineItems: updatedItems,
            };
        }));

        if (updatedSo) {
            // The server has no "Partially …" order stages (ORDER_STAGES) —
            // progress lives on the linked invoice/challan docs, which are
            // already persisted. Only representable stages go up.
            const SERVER_SO_STAGES = ['Draft', 'Confirmed', 'Packing', 'Dispatched', 'Delivered', 'Invoiced', 'Cancelled'];
            if (SERVER_SO_STAGES.includes(updatedSo.stage)) {
                persistUpdate('salesOrders', orderId, updatedSo, setSalesOrders);
            }
        }
        showToast(`Generated invoice ${createdInvoice.invoiceNumber} for ${order.orderNumber}`);
        return createdInvoice;
    };
    const addDeliveryChallan = (challan) => {
        const previous = challan.id ? deliveryChallans.find(dc => dc.id === challan.id) : null;
        if (previous && previous.status !== 'Draft') return previous;

        const challanItems = challan.items || challan.lineItems || [];
        const defaultAddresses = resolvePartyAddresses(challan.customerId, challan.customer);
        const newChallan = {
            id: challan.id || `dc-${Date.now()}`,
            challanNumber: challan.challanNumber ||
                `DC-2026-${String(deliveryChallans.length + 80).padStart(3, '0')}`,
            salesOrderId: challan.salesOrderId,
            sourceSalesOrderId: challan.salesOrderId,
            sourceQuotationId: challan.sourceQuotationId,
            sourceQuotationNumber: challan.sourceQuotationNumber,
            leadId: challan.leadId,
            dealId: challan.dealId,
            salesOrderNumber: challan.salesOrderNumber || challan.linkedSo || (challan.sourceQuotationId ? '' : 'SO-2026-0102'),
            linkedSo: challan.salesOrderNumber || challan.linkedSo || (challan.sourceQuotationId ? '' : 'SO-2026-0102'),
            customerId: challan.customerId,
            customer: challan.customer || 'Acme Corp',
            billingAddress: createAddressSnapshot(challan.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(challan.shippingAddress) || defaultAddresses.shipping,
            date: challan.date || getCurrentISODate(),
            dispatchDate: challan.dispatchDate || getCurrentISODate(),
            transporter: challan.transporter || '',
            vehicleNo: challan.vehicleNo || '',
            status: challan.status || 'In Transit',
            items: challanItems,
            lineItems: challanItems,
        };
        setDeliveryChallans((prev) => previous ? prev.map(dc => dc.id === newChallan.id ? newChallan : dc) : [newChallan, ...prev]);

        // Draft quotation conversions reserve no stock and have no fulfillment effects.
        if (newChallan.status === 'Draft') {
            showToast(`Draft delivery challan ${newChallan.challanNumber} created.`);
            return newChallan;
        }

        // Record SALE movement and handle serial numbers
        if (newChallan.items && newChallan.items.length > 0) {
            newChallan.items.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                const dispatchQty = Number(line.qty || line.dispatchedQty) || 1;
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'SALE',
                    quantity: -dispatchQty,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'DeliveryChallan',
                    referenceId: newChallan.id,
                    referenceNumber: newChallan.challanNumber,
                    notes: `Dispatched to ${newChallan.customer} via ${newChallan.challanNumber}`,
                });

                // Serial numbers removal
                const serialsToDispatch = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                if (serialsToDispatch.length > 0 && item) {
                    removeSerialNumbers(item.id, serialsToDispatch);
                }
            });
        }

        // Update linked Sales Order line fulfillment (deliveredQty, remainingQty, stage)
        const linkedSoId = newChallan.salesOrderId;
        const linkedSoNum = newChallan.salesOrderNumber || newChallan.linkedSo;
        if (linkedSoId || linkedSoNum) {
            setSalesOrders((prev) => prev.map((order) => {
                if (order.id !== linkedSoId && order.orderNumber !== linkedSoNum) return order;

                let allDelivered = true;
                let anyDelivered = false;

                const updatedLines = (order.items || []).map((soLine) => {
                    const matchedChallanLine = newChallan.items.find((cl) => 
                        (cl.id && cl.id === soLine.id) ||
                        (cl.itemId && cl.itemId === soLine.itemId) ||
                        (cl.itemSku && cl.itemSku === soLine.itemSku) ||
                        (cl.sku && cl.sku === soLine.sku) ||
                        (cl.description && cl.description === soLine.description)
                    );

                    const dispatchedThisTime = matchedChallanLine ? Number(matchedChallanLine.qty || matchedChallanLine.dispatchedQty || 0) : 0;
                    const prevDelivered = Number(soLine.deliveredQty || 0);
                    const totalDelivered = prevDelivered + dispatchedThisTime;
                    const totalOrdered = Number(soLine.orderedQty ?? soLine.qty ?? 1);
                    const remaining = Math.max(0, totalOrdered - totalDelivered);

                    if (totalDelivered > 0) anyDelivered = true;
                    if (totalDelivered < totalOrdered) allDelivered = false;

                    return {
                        ...soLine,
                        deliveredQty: totalDelivered,
                        remainingQty: remaining,
                    };
                });

                const newStage = allDelivered ? 'Delivered' : anyDelivered ? 'Partially Dispatched' : order.stage;

                return {
                    ...order,
                    items: updatedLines,
                    lineItems: updatedLines,
                    stage: order.stage === 'Invoiced' ? 'Invoiced' : newStage,
                    status: order.stage === 'Invoiced' ? 'Invoiced' : newStage,
                };
            }));
        }

        showToast(`Delivery Challan ${newChallan.challanNumber} issued.`);
        persistCreate('deliveryChallans', newChallan, setDeliveryChallans, {
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== newChallan.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === newChallan.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.challanNumber || m.referenceNumber }
                            : m
                    )));
                }
                // Non-draft challans dispatch stock server-side (the create
                // itself only numbers the document).
                const dispatchThenRefresh = () => refreshCollections(['deliveryChallans', 'inventoryMovements', 'salesOrders', 'items']);
                if (saved && saved.id && saved.status && saved.status !== 'Draft' && saved.status !== 'Cancelled') {
                    api.post(`/sales/challans/${saved.id}/dispatch/`, {}).then(dispatchThenRefresh, dispatchThenRefresh);
                } else {
                    dispatchThenRefresh();
                }
            },
        });
        return newChallan;
    };
    const updateDeliveryChallanStatus = (id, status) => {
        if (deliveryChallans.find(c => c.id === id)?.status === 'Draft') {
            showToast('This challan is a draft. Dispatch must be prepared before delivery can be recorded.');
            return;
        }
        setDeliveryChallans((prev) => prev.map((c) => {
            if (c.id !== id)
                return c;
            if (status === 'Delivered') {
                const soNum = c.salesOrderNumber || c.linkedSo;
                if (soNum) {
                    setSalesOrders((orders) => orders.map((o) => o.orderNumber === soNum && o.stage !== 'Invoiced'
                        ? { ...o, stage: 'Delivered', status: 'Delivered' }
                        : o));
                }
            }
            return { ...c, status };
        }));
        persistUpdate('deliveryChallans', id, { status }, setDeliveryChallans);
        showToast(`Challan updated to ${status}.`);
    };
    const cancelDeliveryChallan = (challanId) => {
        const challan = deliveryChallans.find((c) => c.id === challanId);
        if (!challan) return { success: false, message: 'Challan not found.' };
        if (challan.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        if (challan.status === 'Draft') {
            setDeliveryChallans(prev => prev.map(c => c.id === challanId ? { ...c, status: 'Cancelled' } : c));
            runDocAction('deliveryChallans', challanId, 'cancel', {}, setDeliveryChallans, {
                refresh: ['deliveryChallans', 'salesOrders'],
            }).catch(() => {});
            showToast('Draft challan cancelled.');
            return { success: true, message: 'Draft challan cancelled.' };
        }

        // 1. Reverse stock movements and restore serial numbers
        if (challan.items && challan.items.length > 0) {
            challan.items.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                const dispatchQty = Number(line.qty || line.dispatchedQty) || 1;
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'SALE_REVERSAL',
                    quantity: dispatchQty,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'DeliveryChallanCancellation',
                    referenceId: challan.id,
                    referenceNumber: challan.challanNumber,
                    notes: `Reversal on Delivery Challan ${challan.challanNumber} cancellation`,
                });

                // Restore serial numbers
                const serialsToRestore = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                if (serialsToRestore.length > 0 && item) {
                    addSerialNumbers(item.id, serialsToRestore);
                }
            });
        }

        // 2. Update linked Sales Order fulfillment lines
        const linkedSoId = challan.salesOrderId;
        const linkedSoNum = challan.salesOrderNumber || challan.linkedSo;
        if (linkedSoId || linkedSoNum) {
            setSalesOrders((prev) => prev.map((order) => {
                if (order.id !== linkedSoId && order.orderNumber !== linkedSoNum) return order;

                let anyDelivered = false;
                const updatedLines = (order.items || []).map((soLine) => {
                    const matchedChallanLine = (challan.items || []).find((cl) =>
                        (cl.id && cl.id === soLine.id) ||
                        (cl.itemId && cl.itemId === soLine.itemId) ||
                        (cl.itemSku && cl.itemSku === soLine.itemSku) ||
                        (cl.sku && cl.sku === soLine.sku) ||
                        (cl.description && cl.description === soLine.description)
                    );
                    const dispatchedThisTime = matchedChallanLine ? Number(matchedChallanLine.qty || matchedChallanLine.dispatchedQty || 0) : 0;
                    const prevDelivered = Number(soLine.deliveredQty || 0);
                    const totalDelivered = Math.max(0, prevDelivered - dispatchedThisTime);
                    const totalOrdered = Number(soLine.orderedQty ?? soLine.qty ?? 1);
                    const remaining = Math.max(0, totalOrdered - totalDelivered);

                    if (totalDelivered > 0) anyDelivered = true;

                    return {
                        ...soLine,
                        deliveredQty: totalDelivered,
                        remainingQty: remaining,
                    };
                });

                const newStage = anyDelivered ? 'Partially Dispatched' : 'Confirmed';

                return {
                    ...order,
                    items: updatedLines,
                    lineItems: updatedLines,
                    stage: order.stage === 'Invoiced' ? 'Invoiced' : newStage,
                    status: order.stage === 'Invoiced' ? 'Invoiced' : newStage,
                };
            }));
        }

        // 3. Mark Challan as Cancelled
        setDeliveryChallans((prev) => prev.map((c) => c.id === challanId ? { ...c, status: 'Cancelled' } : c));

        // Server-side cancel reverses postings; re-read what it touched.
        // (Local mirrors above keep the screen instant.)
        runDocAction('deliveryChallans', challanId, 'cancel', {}, setDeliveryChallans, {
            refresh: ['deliveryChallans', 'salesOrders', 'inventoryMovements'],
        }).catch(() => {});

        // 4. Update linked Warranty Cards to Cancelled
        setWarranties((prev) => prev.map((w) => {
            if (w.deliveryChallanId === challanId || w.challanNumber === challan.challanNumber) {
                return {
                    ...w,
                    documentStatus: 'Cancelled',
                    coverageStatus: 'Cancelled',
                };
            }
            return w;
        }));
        warranties
            .filter((w) => w.deliveryChallanId === challanId || w.challanNumber === challan.challanNumber)
            .forEach((w) => persistUpdate('warranties', w.id, { documentStatus: 'Cancelled' }, setWarranties));

        showToast(`Delivery Challan ${challan.challanNumber} cancelled and stock reversed.`);
        return { success: true, message: `Challan ${challan.challanNumber} cancelled.` };
    };
    const addPaymentIn = (pay) => {
        const payAmt = Number(pay.amount) || 0;
        if (payAmt <= 0) {
            showToast('Payment amount must be greater than zero.');
            return null;
        }

        let targetInv = null;
        if (pay.invoiceId || pay.invoiceNumber) {
            targetInv = invoices.find((i) => i.id === pay.invoiceId || i.invoiceNumber === pay.invoiceNumber);
            if (targetInv) {
                if (targetInv.status === 'Cancelled') {
                    showToast('Cannot record payment against a cancelled invoice.');
                    return null;
                }
                if (targetInv.status === 'Draft' || targetInv.finalized === false) {
                    showToast('Cannot record payment against a draft invoice. Please finalize the invoice first.');
                    return null;
                }
                if (targetInv.status === 'Paid' || (targetInv.balanceDue !== undefined && targetInv.balanceDue <= 0.01)) {
                    showToast('Invoice is already fully settled.');
                    return null;
                }
                const remainingBal = targetInv.balanceDue !== undefined ? targetInv.balanceDue : Math.max(0, targetInv.total - (targetInv.paidAmount || 0));
                if (payAmt > remainingBal + 0.01) {
                    showToast(`Payment amount (${formatCurrency(payAmt)}) exceeds remaining invoice balance (${formatCurrency(remainingBal)}).`);
                    return null;
                }
            }
        }

        const newPay = {
            id: pay.id || `pay-${Date.now()}`,
            receiptNumber: pay.receiptNumber ||
                `RCP-2026-${String(paymentIns.length + 90).padStart(3, '0')}`,
            customerId: pay.customerId || targetInv?.customerId,
            customer: pay.customer || targetInv?.customer || 'Acme Corp',
            invoiceId: pay.invoiceId || targetInv?.id,
            invoiceNumber: pay.invoiceNumber || targetInv?.invoiceNumber || 'INV-2026-001',
            date: pay.date || getCurrentDateFormatted(),
            mode: pay.mode || 'Bank Transfer',
            amount: payAmt,
            reference: pay.reference || 'WIRE-49821',
            status: 'Paid',
        };
        setPaymentIns((prev) => [newPay, ...prev]);
        // Update invoice payment tracking and dynamic status
        if (newPay.invoiceNumber || newPay.invoiceId) {
            setInvoices((prev) => prev.map((inv) => {
                if (inv.invoiceNumber === newPay.invoiceNumber || (newPay.invoiceId && inv.id === newPay.invoiceId)) {
                    const currentPaid = Number(inv.amountPaid ?? inv.paidAmount ?? 0);
                    const updatedPaid = currentPaid + payAmt;
                    const totalInvoice = Number(inv.total ?? inv.amount ?? 0);
                    const isFull = updatedPaid >= (totalInvoice - 0.01);
                    const derivedStatus = updatedPaid <= 0 ? (inv.status === 'Draft' ? 'Draft' : 'Unpaid') : isFull ? 'Paid' : 'Partially Paid';
                    return {
                        ...inv,
                        paidAmount: updatedPaid,
                        amountPaid: updatedPaid,
                        balanceDue: Math.max(0, totalInvoice - updatedPaid),
                        status: derivedStatus,
                    };
                }
                return inv;
            }));
        }
        // Adjust customer balance
        if (newPay.customer) {
            setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === newPay.customer?.toLowerCase() || (newPay.customerId && c.id === newPay.customerId)
                ? { ...c, balance: Math.max(0, c.balance - payAmt) }
                : c));
        }
        // Add to Operating Bank Account
        setBankAccounts((prev) => prev.map((acc, idx) => idx === 0 ? { ...acc, balance: acc.balance + payAmt } : acc));
        // The receipt's own journal entry is posted server-side with the
        // payment — re-read instead of mirroring it locally (no doubles).
        persistCreate('paymentIns', newPay, setPaymentIns, {
            onServer: () => refreshCollections(['paymentIns', 'invoices', 'journalEntries', 'parties', 'bankAccounts']),
        });
        showToast(`Recorded receipt of ${formatCurrency(payAmt)} from ${newPay.customer}`);
        return newPay;
    };
    const addSalesReturn = (ret) => {
        const inv = invoices.find((i) => i.id === ret.invoiceId || i.invoiceNumber === ret.invoiceRef);
        if (inv) {
            if (inv.status === 'Cancelled') {
                showToast('Cannot create Sales Return against a cancelled invoice.');
                return null;
            }
            if (inv.status === 'Draft' || inv.finalized === false) {
                showToast('Cannot create Sales Return against a draft invoice. Please finalize the invoice first.');
                return null;
            }
        }

        // Find previously returned serials across all active returns for this invoice
        const previouslyReturnedSerials = salesReturns
            .filter((sr) => (sr.invoiceId === ret.invoiceId || sr.invoiceRef === ret.invoiceRef) && sr.status !== 'Cancelled')
            .flatMap((sr) => (sr.items || []).flatMap((it) => it.selectedSerials || []));

        const returnLines = (ret.items || ret.lineItems || []).map((line, idx) => {
            const invoicedQty = Number(line.invoicedQty ?? (inv?.items?.find((it) => (it.itemId && it.itemId === line.itemId) || (it.sku && it.sku === line.sku) || it.description === line.description)?.qty) ?? 1);
            
            // Calculate previously returned for this item on active returns
            const prevReturned = salesReturns
                .filter((sr) => (sr.invoiceId === ret.invoiceId || sr.invoiceRef === ret.invoiceRef) && sr.status !== 'Cancelled')
                .reduce((sum, sr) => {
                    const match = (sr.items || []).find((it) => (it.itemId && it.itemId === line.itemId) || (it.sku && it.sku === line.sku) || it.description === line.description);
                    return sum + Number(match?.qty || 0);
                }, 0);
            
            const returnableQty = Math.max(0, invoicedQty - prevReturned);
            const requestedQty = Math.max(0, Number(line.qty || 0));
            const qty = Math.min(requestedQty, returnableQty); // Over-return guard
            const condition = line.condition || ret.condition || 'Good';
            const rate = Number(line.rate || 0);
            const tax = Number(line.tax !== undefined ? line.tax : 18);
            const amount = Number(line.amount || Math.round(qty * rate * (1 + tax / 100) * 100) / 100);

            // Filter out serials that were already returned
            const validSerials = (line.selectedSerials || []).filter((s) => !previouslyReturnedSerials.includes(s));

            return {
                ...line,
                id: line.id || `sr-item-${Date.now()}-${idx}`,
                invoicedQty,
                previouslyReturnedQty: prevReturned,
                returnableQty,
                qty,
                condition,
                rate,
                tax,
                amount,
                selectedSerials: validSerials,
            };
        }).filter((l) => l.qty > 0);

        if (returnLines.length === 0) {
            showToast(`Cannot create return with 0 returnable quantity.`);
            return null;
        }

        const totalAmount = returnLines.reduce((sum, it) => sum + it.amount, 0);
        const defaultAddresses = resolvePartyAddresses(ret.customerId || inv?.customerId, ret.customer || inv?.customer);

        const newRet = {
            id: ret.id || `sr-${Date.now()}`,
            returnNumber: ret.returnNumber || `SR-2026-${String(salesReturns.length + 13).padStart(3, '0')}`,
            customerId: ret.customerId || inv?.customerId,
            customer: ret.customer || inv?.customer || 'Cyberdyne Systems',
            billingAddress: createAddressSnapshot(ret.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(ret.shippingAddress) || defaultAddresses.shipping,
            invoiceId: ret.invoiceId || inv?.id,
            invoiceRef: ret.invoiceRef || inv?.invoiceNumber || 'INV-2026-002',
            date: ret.date || getCurrentDateFormatted(),
            amount: totalAmount,
            reason: ret.reason || 'Customer Return',
            restocked: ret.restocked ?? true,
            status: ret.status || 'Approved',
            items: returnLines,
            lineItems: returnLines,
        };

        setSalesReturns((prev) => [newRet, ...prev]);

        // Process inventory according to condition
        returnLines.forEach((line) => {
            const targetSku = line.sku || line.itemSku;
            const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
            
            if (line.condition === 'Good' && newRet.restocked) {
                // Return to available inventory
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'SALES_RETURN',
                    quantity: line.qty,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'SalesReturn',
                    referenceId: newRet.id,
                    referenceNumber: newRet.returnNumber,
                    serials: line.selectedSerials,
                    notes: `Restocked (${line.condition}) per ${newRet.returnNumber}: ${newRet.reason}`,
                });

                // Restore serials if Good & restocked
                if (line.selectedSerials && line.selectedSerials.length > 0 && item) {
                    addSerialNumbers(item.id, line.selectedSerials);
                }
            } else {
                // Damaged or Scrap: Record quarantine return without increasing sellable stock
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: line.condition === 'Scrap' ? 'SCRAP_RETURN' : 'DAMAGED_RETURN',
                    quantity: 0, // Sellable stock unchanged
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'SalesReturn',
                    referenceId: newRet.id,
                    referenceNumber: newRet.returnNumber,
                    serials: line.selectedSerials,
                    notes: `Quarantined/Inspection return (${line.condition}, Qty: ${line.qty}) per ${newRet.returnNumber}`,
                });
            }
        });

        // Reduce customer receivable balance
        if (newRet.customer) {
            setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === newRet.customer?.toLowerCase() || (newRet.customerId && c.id === newRet.customerId)
                ? { ...c, balance: Math.max(0, c.balance - totalAmount) }
                : c));
        }

        // The credit-note journal entry is posted server-side with the
        // return — no local mirror (it would double-count in ledger views).
        showToast(`Credit Note ${newRet.returnNumber} issued for ${formatCurrency(totalAmount)}.`);
        persistCreate('salesReturns', newRet, setSalesReturns, {
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== newRet.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === newRet.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.returnNumber || m.referenceNumber }
                            : m
                    )));
                }
                refreshCollections(['salesReturns', 'invoices', 'journalEntries', 'inventoryMovements', 'parties', 'items']);
            },
        });
        return newRet;
    };

    const cancelSalesReturn = (returnId) => {
        const sr = salesReturns.find((r) => r.id === returnId);
        if (!sr) return { success: false, message: 'Return not found.' };
        if (sr.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        // 1. Reverse inventory movements for Good/restocked items
        (sr.items || []).forEach((line) => {
            if (line.condition === 'Good' && sr.restocked) {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'RETURN_CANCELLATION',
                    quantity: -line.qty,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'SalesReturnCancellation',
                    referenceId: sr.id,
                    referenceNumber: sr.returnNumber,
                    notes: `Reversal of restock on Sales Return ${sr.returnNumber} cancellation`,
                });

                if (line.selectedSerials && line.selectedSerials.length > 0 && item) {
                    removeSerialNumbers(item.id, line.selectedSerials);
                }
            }
        });

        // 2. Reverse customer receivable balance adjustment
        if (sr.customer) {
            setCustomers((prev) => prev.map((c) => String(c.name ?? '').toLowerCase() === String(sr.customer ?? '').toLowerCase() || (sr.customerId && c.id === sr.customerId)
                ? { ...c, balance: c.balance + sr.amount }
                : c));
        }

        // 3. Server-side cancel reverses postings (no local reversal JE —
        // it would double-count once the re-read lands).
        // 4. Mark status as Cancelled
        setSalesReturns((prev) => prev.map((r) => r.id === returnId ? { ...r, status: 'Cancelled' } : r));
        runDocAction('salesReturns', returnId, 'cancel', {}, setSalesReturns, {
            refresh: ['salesReturns', 'invoices', 'journalEntries', 'inventoryMovements', 'parties', 'items'],
        }).catch(() => {});
        showToast(`Sales Return ${sr.returnNumber} cancelled.`);
        return { success: true, message: `Sales Return ${sr.returnNumber} cancelled.` };
    };
    const addPurchaseOrder = (po) => {
        const poLines = po.items || po.lineItems || [];
        const poAmt = po.amount ||
            (poLines.length > 0 ? poLines.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0) : 0) || 2500;
        const defaultAddresses = resolveVendorPartyAddresses(po.vendorId, po.vendor);
        const newPo = {
            id: po.id || `po-${Date.now()}`,
            poNumber: po.poNumber ||
                `PO-2026-${String(purchaseOrders.length + 201).padStart(4, '0')}`,
            vendorId: po.vendorId,
            vendor: po.vendor || 'Arrow Electronics Supply',
            billingAddress: createAddressSnapshot(po.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(po.shippingAddress) || defaultAddresses.shipping,
            date: formatDateDDMMYYYY(po.date || 'Today'),
            expectedDate: po.expectedDate || addDaysISO(getCurrentISODate(), 10),
            amount: poAmt,
            total: poAmt,
            status: po.status || 'Draft',
            items: poLines,
            lineItems: poLines,
            notes: po.notes || '',
        };
        setPurchaseOrders((prev) => [newPo, ...prev]);
        showToast(`Purchase Order ${newPo.poNumber} saved.`);
        persistCreate('purchaseOrders', newPo, setPurchaseOrders);
        return newPo;
    };
    const updatePurchaseOrderStatus = (id, status) => {
        const po = purchaseOrders.find((p) => p.id === id);
        if (!po) return;
        if (po.status === 'Cancelled' && status !== 'Cancelled') {
            showToast('Cannot modify a cancelled Purchase Order.');
            return;
        }
        setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        // Only drafts accept PATCH (api.md §1.9).
        if (po.status === 'Draft') {
            persistUpdate('purchaseOrders', id, { status }, setPurchaseOrders);
        }
        showToast(`PO updated to ${status}.`);
    };
    const getPoBilledStatus = (poId) => {
        const po = typeof poId === 'object' ? poId : purchaseOrders.find((p) => p.id === poId || p.poNumber === poId);
        if (!po) return { status: 'Draft', totalOrderedQty: 0, totalBilledQty: 0, totalRemainingQty: 0, lines: [], activeBills: [] };

        const activeBills = purchaseBills.filter((b) => (b.purchaseOrderId === po.id || b.poRef === po.poNumber || b.linkedPo === po.poNumber) && b.status !== 'Cancelled');
        const poLines = po.items || po.lineItems || [];

        let totalOrderedQty = 0;
        let totalBilledQty = 0;

        const lines = poLines.map((line) => {
            const orderedQty = Number(line.qty || 0);
            totalOrderedQty += orderedQty;
            const lineSku = line.sku || line.itemSku;
            const billedQty = activeBills.reduce((sum, bill) => {
                const match = (bill.items || bill.lineItems || []).find((it) => (line.itemId && it.itemId === line.itemId) || (lineSku && (it.sku === lineSku || it.itemSku === lineSku)));
                return sum + Number(match?.qty || 0);
            }, 0);
            totalBilledQty += billedQty;
            const remainingQty = Math.max(0, orderedQty - billedQty);
            return {
                ...line,
                orderedQty,
                billedQty,
                remainingQty,
            };
        });

        const totalRemainingQty = Math.max(0, totalOrderedQty - totalBilledQty);
        let dynamicStatus = po.status || 'Issued';
        if (po.status === 'Cancelled') {
            dynamicStatus = 'Cancelled';
        } else if (totalOrderedQty > 0 && totalBilledQty >= totalOrderedQty) {
            dynamicStatus = 'Billed';
        } else if (totalBilledQty > 0) {
            dynamicStatus = 'Partially Billed';
        }

        return {
            status: dynamicStatus,
            totalOrderedQty,
            totalBilledQty,
            totalRemainingQty,
            lines,
            activeBills,
        };
    };
    const cancelPurchaseOrder = (poId) => {
        const po = purchaseOrders.find((p) => p.id === poId);
        if (!po) return { success: false, message: 'Purchase Order not found.' };
        if (po.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        const activeBill = purchaseBills.find((b) => (b.purchaseOrderId === poId || b.poRef === po.poNumber || b.linkedPo === po.poNumber) && b.status !== 'Cancelled');
        if (activeBill) {
            showToast(`Cannot cancel PO: active Bill ${activeBill.billNumber} exists. Cancel the bill first.`);
            return { success: false, message: `Active bill ${activeBill.billNumber} exists.` };
        }

        setPurchaseOrders((prev) => prev.map((p) => p.id === poId ? { ...p, status: 'Cancelled' } : p));
        runDocAction('purchaseOrders', poId, 'cancel', {}, setPurchaseOrders, {
            refresh: ['purchaseOrders', 'purchaseBills'],
        }).catch(() => {});
        showToast(`Purchase Order ${po.poNumber} cancelled.`);
        return { success: true, message: `Purchase Order ${po.poNumber} cancelled.` };
    };
    const deletePurchaseOrder = (id) => {
        const po = purchaseOrders.find((p) => p.id === id);
        if (!po) return;
        if (po.status !== 'Draft') {
            showToast(`Only Draft Purchase Orders can be deleted.`);
            return;
        }
        setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
        persistDelete('purchaseOrders', id);
        showToast(`Draft Purchase Order ${po.poNumber || ''} deleted.`);
    };
    const persistProductionInstructions = (next) => {
        try { localStorage.setItem('oscar_productionInstructions', JSON.stringify(next)); } catch { }
        return next;
    };
    // Backend-first: vendor process instructions live in Postgres
    // (GET /jobwork/process-instructions/) when logged in; localStorage is only the offline cache.
    // Offline creates are retried here and merged — never wiped by a pull.
    useEffect(() => {
        let live = true;
        const syncVPIs = () => {
            import('../services/jobWorkSync').then(async ({ pullVPIs, pushCreateVPI, reconcilePendingCreates, mergeServerRows, isJobWorkBackendEnabled }) => {
                if (!isJobWorkBackendEnabled()) return;
                try {
                    const cached = JSON.parse(localStorage.getItem('oscar_productionInstructions') || '[]');
                    const reconciled = await reconcilePendingCreates(Array.isArray(cached) ? cached : [], pushCreateVPI);
                    const rows = await pullVPIs();
                    if (live && Array.isArray(rows)) {
                        const merged = mergeServerRows(reconciled, rows);
                        setProductionInstructions(merged);
                        persistProductionInstructions(merged);
                    }
                } catch { /* offline — keep cache */ }
            });
        };
        syncVPIs();
        const onSession = () => syncVPIs();
        window.addEventListener('evenmore:authorized', onSession);
        return () => {
            live = false;
            window.removeEventListener('evenmore:authorized', onSession);
        };
    }, []);
    const addProductionInstruction = (pi) => {
        const newPi = {
            id: pi.id || `pi-${Date.now()}`,
            piNumber: pi.piNumber || `PI-${String(productionInstructions.length + 2001).padStart(4, '0')}`,
            poId: pi.poId,
            poNumber: pi.poNumber,
            vendorId: pi.vendorId,
            vendor: pi.vendor,
            fabric: pi.fabric,
            fabricSku: pi.fabricSku,
            processType: pi.processType || '',
            assignedEmployee: pi.assignedEmployee || '',
            assignedQty: Number(pi.assignedQty) || 0,
            uom: 'Meter',
            producedQty: Number(pi.producedQty) || 0,
            date: pi.date || getCurrentDateFormatted(),
            startDate: pi.startDate,
            expectedCompletionDate: pi.expectedCompletionDate,
            status: pi.status || 'In Progress',
            remarks: pi.remarks || '',
        };
        setProductionInstructions((prev) => {
            const next = [newPi, ...prev];
            return persistProductionInstructions(next);
        });
        // Push to backend; server owns piNumber — reconcile when it answers.
        import('../services/jobWorkSync').then(({ pushCreateVPI, isJobWorkBackendEnabled }) => {
            if (!isJobWorkBackendEnabled()) return;
            pushCreateVPI(newPi).then((saved) => {
                if (saved) {
                    setProductionInstructions((prev) => persistProductionInstructions(
                        prev.map((p) => (p.id === newPi.id ? { ...saved, uom: 'Meter' } : p)),
                    ));
                }
            }).catch(() => {});
        });
        showToast(`Production Instruction ${newPi.piNumber} saved.`);
        return newPi;
    };
    const updateProductionInstructionStatus = (id, status) => {
        setProductionInstructions((prev) => {
            const next = prev.map((p) => (p.id === id ? { ...p, status } : p));
            return persistProductionInstructions(next);
        });
        import('../services/jobWorkSync').then(({ pushUpdateVPI, isJobWorkBackendEnabled }) => {
            if (!isJobWorkBackendEnabled()) return;
            pushUpdateVPI(id, { status }).catch(() => {});
        });
        showToast(`Production Instruction updated to ${status}.`);
    };
    const updateProductionInstruction = (id, patch) => {
        setProductionInstructions((prev) => {
            const next = prev.map((p) => (p.id === id ? { ...p, ...patch, assignedQty: patch.assignedQty !== undefined ? Number(patch.assignedQty) || 0 : p.assignedQty } : p));
            return persistProductionInstructions(next);
        });
        import('../services/jobWorkSync').then(({ pushUpdateVPI, isJobWorkBackendEnabled }) => {
            if (!isJobWorkBackendEnabled()) return;
            pushUpdateVPI(id, patch).catch(() => {});
        });
        showToast('Production Instruction updated.');
    };
    const deleteProductionInstruction = (id) => {
        setProductionInstructions((prev) => {
            const next = prev.filter((p) => p.id !== id);
            return persistProductionInstructions(next);
        });
        import('../services/jobWorkSync').then(({ pushDeleteVPI, isJobWorkBackendEnabled }) => {
            if (!isJobWorkBackendEnabled()) return;
            pushDeleteVPI(id).catch(() => {});
        });
        showToast('Production Instruction deleted.');
    };
    const convertPurchaseOrderToBill = (poId) => {
        const po = purchaseOrders.find((p) => p.id === poId);
        if (!po)
            return undefined;
        if (po.status === 'Cancelled') {
            showToast('Cannot convert a cancelled Purchase Order.');
            return undefined;
        }
        
        const poStatusInfo = getPoBilledStatus(po.id);
        if (poStatusInfo.totalRemainingQty <= 0 && poStatusInfo.totalOrderedQty > 0) {
            showToast(`Purchase Order ${po.poNumber} is already fully billed.`);
            return poStatusInfo.activeBills[0];
        }

        // Bill only remaining quantities
        const billLines = poStatusInfo.lines
            .filter((l) => l.remainingQty > 0)
            .map((l) => ({
                ...l,
                qty: l.remainingQty,
                amount: Math.round(l.remainingQty * (l.rate || 0) * 100) / 100,
            }));

        const billAmt = billLines.reduce((sum, it) => sum + (it.amount || it.qty * (it.rate || 0)), 0) || (po.amount ?? 5000);
        const defaultAddresses = resolveVendorPartyAddresses(po.vendorId, po.vendor);
        const newBill = {
            id: `pb-${Date.now()}`,
            billNumber: `PB-2026-${String(purchaseBills.length + 16).padStart(3, '0')}`,
            purchaseOrderId: po.id,
            poRef: po.poNumber,
            linkedPo: po.poNumber,
            vendorId: po.vendorId,
            vendor: po.vendor,
            billingAddress: createAddressSnapshot(po.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(po.shippingAddress) || defaultAddresses.shipping,
            billDate: getCurrentDateFormatted(),
            date: getCurrentDateFormatted(),
            dueDate: addDaysISO(getCurrentISODate(), 30),
            amount: billAmt,
            total: billAmt,
            paidAmount: 0,
            amountPaid: 0,
            balanceDue: billAmt,
            status: 'Unpaid',
            // ── [PHASE-2B] PO→Bill conversion no longer auto-receives stock ──
            // Old code: goodsReceived: true, — stock increased automatically at bill time.
            // Goods are now received through the standalone Goods Receipt (GRN) page.
            goodsReceived: false,
            items: billLines,
            lineItems: billLines,
        };
        setPurchaseBills((prev) => [newBill, ...prev]);

        // Update PO status to Partially Billed or Billed
        const willBeFullyBilled = poStatusInfo.totalRemainingQty <= billLines.reduce((s, it) => s + it.qty, 0);
        setPurchaseOrders((prev) => prev.map((p) => p.id === poId ? { ...p, status: willBeFullyBilled ? 'Billed' : 'Partially Billed' } : p));

        // Increase vendor AP liability across vendors and parties
        syncVendorBalance(po.vendorId, po.vendor, billAmt);
        // The bill's own journal entry is posted server-side with the bill —
        // no local mirror (it would double-count in ledger views).
        // ── [PHASE-2B] Auto-receive on PO→Bill kept only for pre-received (legacy) bills ──
        // Old code auto-received inventory from every bill line at conversion time.
        //   Now handled by GoodsReceiptPage (GRN). The block below still runs when the
        //   bill was explicitly created as already received (goodsReceived: true).
        // if (billLines.length > 0) {
        //     billLines.forEach((line) => {
        //         const targetSku = line.sku || line.itemSku;
        //         const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
        //         if (item && item.trackingMode === 'Serial') {
        //             const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
        //             if (serials.length > 0) {
        //                 addSerialNumbers(item.id, serials);
        //             }
        //         }
        //         recordMovement({
        //             itemId: item?.id || line.itemId || `itm-${Date.now()}`,
        //             itemSku: item?.sku || targetSku || 'GEN-SKU',
        //             itemName: item?.name || line.name || line.description,
        //             type: 'PURCHASE',
        //             quantity: line.qty || 1,
        //             unitCost: line.rate || item?.costPrice || 0,
        //             referenceType: 'PurchaseBill',
        //             referenceId: newBill.id,
        //             referenceNumber: newBill.billNumber,
        //             serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
        //             notes: `Goods received via ${newBill.billNumber}`,
        //         });
        //     });
        // }
        if (newBill.goodsReceived === true && billLines.length > 0) {
            billLines.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                if (item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        addSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'PURCHASE',
                    quantity: line.qty || 1,
                    unitCost: line.rate || item?.costPrice || 0,
                    referenceType: 'PurchaseBill',
                    referenceId: newBill.id,
                    referenceNumber: newBill.billNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: `Goods received via ${newBill.billNumber}`,
                });
            });
        }
        showToast(`Purchase Bill ${newBill.billNumber} created from ${po.poNumber}`);
        persistCreate('purchaseBills', newBill, setPurchaseBills, {
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== newBill.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === newBill.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.billNumber || m.referenceNumber }
                            : m
                    )));
                }
                refreshCollections(['purchaseBills', 'purchaseOrders', 'journalEntries', 'inventoryMovements', 'parties', 'items']);
            },
        });
        return newBill;
    };
    const addPurchaseBill = (bill) => {
        const billLines = bill.items || bill.lineItems || [];
        const billAmt = bill.total || bill.amount ||
            (billLines.length > 0 ? billLines.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0) : 0) || 5000;
        const defaultAddresses = resolveVendorPartyAddresses(bill.vendorId, bill.vendor);
        const newBill = {
            id: bill.id || `pb-${Date.now()}`,
            billNumber: bill.billNumber ||
                `PB-2026-${String(purchaseBills.length + 16).padStart(3, '0')}`,
            purchaseOrderId: bill.purchaseOrderId,
            poRef: bill.poRef || 'PO-2026-0210',
            linkedPo: bill.linkedPo || bill.poRef || 'PO-2026-0210',
            vendorId: bill.vendorId,
            vendor: bill.vendor || 'Cisco Systems Direct',
            billingAddress: createAddressSnapshot(bill.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(bill.shippingAddress) || defaultAddresses.shipping,
            billDate: bill.billDate || getCurrentDateFormatted(),
            date: bill.date || getCurrentDateFormatted(),
            dueDate: bill.dueDate || addDaysISO(getCurrentISODate(), 30),
            amount: billAmt,
            total: billAmt,
            paidAmount: bill.paidAmount || bill.amountPaid || 0,
            amountPaid: bill.amountPaid || bill.paidAmount || 0,
            balanceDue: Math.max(0, billAmt - (bill.paidAmount || bill.amountPaid || 0)),
            status: bill.status || 'Unpaid',
            // ── [PHASE-2B] New bills are NOT auto-received: stock moves only on GRN ──
            // Old code: goodsReceived: true, — every new bill immediately increased stock.
            // Post-GRN-split a bill can exist with goodsReceived=false and stock only
            //   changes when GoodsReceiptPage / receivePurchaseBillGoods marks it received.
            goodsReceived: bill.goodsReceived !== undefined ? !!bill.goodsReceived : false,
            items: billLines,
            lineItems: billLines,
            notes: bill.notes || '',
        };
        setPurchaseBills((prev) => [newBill, ...prev]);

        // If linked to a PO, update PO status to Partially Billed or Billed
        if (newBill.purchaseOrderId || newBill.poRef || newBill.linkedPo) {
            const targetPo = purchaseOrders.find((p) => p.id === newBill.purchaseOrderId || p.poNumber === newBill.poRef || p.poNumber === newBill.linkedPo);
            if (targetPo && targetPo.status !== 'Cancelled') {
                const poStatusInfo = getPoBilledStatus(targetPo.id);
                const currentBilledQty = poStatusInfo.totalBilledQty + billLines.reduce((s, it) => s + Number(it.qty || 0), 0);
                const isFullyBilled = poStatusInfo.totalOrderedQty > 0 && currentBilledQty >= poStatusInfo.totalOrderedQty;
                setPurchaseOrders((prev) => prev.map((p) => p.id === targetPo.id ? { ...p, status: isFullyBilled ? 'Billed' : 'Partially Billed' } : p));
            }
        }

        // Increase vendor AP liability across vendors and parties
        syncVendorBalance(newBill.vendorId, newBill.vendor, billAmt);
        // The bill's journal entry is posted server-side — no local mirror
        // (it would double-count in ledger views).
        // ── [PHASE-2B] Auto-stock on bill creation replaced by GRN-gated stock entry ──
        // Old code auto-recorded PURCHASE movements for every bill line here
        //   (noted below). Now movement happens ONLY when the bill was already
        //   received (goodsReceived === true — e.g. legacy / pre-received bills);
        //   otherwise stock enters via GoodsReceiptPage → receivePurchaseBillGoods.
        // if (billLines.length > 0) {
        //     billLines.forEach((line) => {
        //         const targetSku = line.sku || line.itemSku;
        //         const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
        //         if (item && item.trackingMode === 'Serial') {
        //             const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
        //             if (serials.length > 0) {
        //                 addSerialNumbers(item.id, serials);
        //             }
        //         }
        //         recordMovement({
        //             itemId: item?.id || line.itemId || `itm-${Date.now()}`,
        //             itemSku: item?.sku || targetSku || 'GEN-SKU',
        //             itemName: item?.name || line.name || line.description,
        //             type: 'PURCHASE',
        //             quantity: line.qty || 1,
        //             unitCost: line.rate || item?.costPrice || 0,
        //             referenceType: 'PurchaseBill',
        //             referenceId: newBill.id,
        //             referenceNumber: newBill.billNumber,
        //             serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
        //             notes: `Goods intake via ${newBill.billNumber}`,
        //         });
        //     });
        // }
        if (newBill.goodsReceived === true && billLines.length > 0) {
            billLines.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                if (item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        addSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'PURCHASE',
                    quantity: line.qty || 1,
                    unitCost: line.rate || item?.costPrice || 0,
                    referenceType: 'PurchaseBill',
                    referenceId: newBill.id,
                    referenceNumber: newBill.billNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: `Goods intake via ${newBill.billNumber}`,
                });
            });
        }
        showToast(`Vendor Bill ${newBill.billNumber} recorded.`);
        persistCreate('purchaseBills', newBill, setPurchaseBills, {
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== newBill.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === newBill.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.billNumber || m.referenceNumber }
                            : m
                    )));
                }
                refreshCollections(['purchaseBills', 'purchaseOrders', 'journalEntries', 'inventoryMovements', 'parties', 'items']);
            },
        });
        return newBill;
    };
    const cancelPurchaseBill = (billId) => {
        const bill = purchaseBills.find((b) => b.id === billId);
        if (!bill) return { success: false, reason: 'not_found', message: 'Bill not found.' };
        if (bill.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        const paid = Number(bill.paidAmount || bill.amountPaid || 0);
        if (paid > 0) {
            showToast(`Cannot cancel bill with recorded disbursements (${formatCurrency(paid)}). Please reverse payments first.`);
            return {
                success: false,
                reason: 'has_payments',
                message: `Cannot cancel bill with recorded disbursements (${formatCurrency(paid)}). Please reverse payments first.`,
            };
        }

        // Reverse inventory movements and deregister serials if goods were received
        if (bill.goodsReceived !== false && bill.items && bill.items.length > 0) {
            bill.items.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                const revQty = Number(line.qty) || 1;
                if (item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        removeSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'PURCHASE_REVERSAL',
                    quantity: -revQty,
                    unitCost: line.rate || item?.costPrice || 0,
                    referenceType: 'PurchaseBillCancellation',
                    referenceId: bill.id,
                    referenceNumber: bill.billNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: `Stock reversal on Purchase Bill ${bill.billNumber} cancellation`,
                });
            });
        }

        // Reverse vendor AP liability across vendors and parties
        syncVendorBalance(bill.vendorId, bill.vendor, -(bill.total || bill.amount || 0));

        // Server-side cancel reverses postings; re-read what it touched.
        // (No local reversal JE — it would double-count in ledger views.)

        // Re-evaluate linked PO status
        if (bill.purchaseOrderId || bill.poRef || bill.linkedPo) {
            const targetPo = purchaseOrders.find((po) => po.id === bill.purchaseOrderId || po.poNumber === bill.poRef || po.poNumber === bill.linkedPo);
            if (targetPo && targetPo.status !== 'Cancelled') {
                const remainingActiveBills = purchaseBills.filter((b) => b.id !== billId && (b.purchaseOrderId === targetPo.id || b.poRef === targetPo.poNumber || b.linkedPo === targetPo.poNumber) && b.status !== 'Cancelled');
                const poLines = targetPo.items || targetPo.lineItems || [];
                const totalOrdered = poLines.reduce((s, it) => s + Number(it.qty || 0), 0);
                const totalBilled = poLines.reduce((sum, line) => {
                    const lSku = line.sku || line.itemSku;
                    const bQty = remainingActiveBills.reduce((bsum, b) => {
                        const m = (b.items || []).find((it) => (line.itemId && it.itemId === line.itemId) || (lSku && (it.sku === lSku || it.itemSku === lSku)));
                        return bsum + Number(m?.qty || 0);
                    }, 0);
                    return sum + bQty;
                }, 0);

                let newPoStatus = 'Issued';
                if (totalOrdered > 0 && totalBilled >= totalOrdered) {
                    newPoStatus = 'Billed';
                } else if (totalBilled > 0) {
                    newPoStatus = 'Partially Billed';
                }
                setPurchaseOrders((prev) => prev.map((p) => p.id === targetPo.id ? { ...p, status: newPoStatus } : p));
            }
        }

        setPurchaseBills((prev) => prev.map((b) => b.id === billId ? { ...b, status: 'Cancelled' } : b));
        runDocAction('purchaseBills', billId, 'cancel', {}, setPurchaseBills, {
            refresh: ['purchaseBills', 'purchaseOrders', 'journalEntries', 'inventoryMovements', 'parties', 'items'],
        }).catch(() => {});
        showToast(`Purchase Bill ${bill.billNumber} cancelled.`);
        return { success: true, message: `Purchase Bill ${bill.billNumber} cancelled.` };
    };
    const receivePurchaseBillGoods = (billId, receivedOverrides = null, qcStatus = 'Approved') => {
        const bill = purchaseBills.find((b) => b.id === billId);
        if (!bill)
            return;
        if (bill.goodsReceived) {
            showToast('Goods have already been received for this bill.');
            return;
        }
        if (bill.status === 'Cancelled') {
            showToast('Cannot receive goods for a cancelled bill.');
            return;
        }
        const billLines = bill.items || bill.lineItems || [];
        if (billLines.length > 0) {
            // ── [PHASE-2A] Weight-variation tracking (Sweven steel) ──
            // For isWeightItem lines the receipt can carry an actual receivedWeight (kg from the
            //   weighbridge). We compute variance vs the theoretical weight
            //   (expected = theoreticalWeight × ordered qty) and if it exceeds the item's
            //   tolerancePct the GRN is auto-flagged 'Pending Approval' (overrides qcStatus).
            const MATCH = (line, o) =>
                (o.lineId && o.lineId === (line.id || line.lineId)) ||
                (o.lineIndex !== undefined && Number(o.lineIndex) === billLines.indexOf(line)) ||
                (o.sku && String(o.sku).toLowerCase() === String(line.sku || line.itemSku || '').toLowerCase());
            const findOverride = (line) => Array.isArray(receivedOverrides) ? receivedOverrides.find((o) => MATCH(line, o)) : null;
            const weightMeta = {};
            const serverLinesPayload = [];
            let autoFlagPending = false;
            billLines.forEach((line, idx) => {
                const override = findOverride(line);
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                const isWeightItem = Boolean(line.isWeightItem) || Boolean(item?.isWeightItem);
                const tolerancePct = line.tolerancePct !== undefined ? Number(line.tolerancePct) : (item?.tolerancePct !== undefined ? Number(item.tolerancePct) : 2);
                const theoreticalWeight = Number(line.theoreticalWeight ?? item?.theoreticalWeight ?? 0) || 0;
                const orderedQty = Number(line.qty || line.orderedQty || 1);
                const receivedQty = override && Number(override.receivedQty) >= 0 ? Number(override.receivedQty) : orderedQty;
                let receivedWeight, variationPct = null;
                if (isWeightItem && theoreticalWeight > 0) {
                    receivedWeight = override && Number(override.receivedWeight) > 0
                        ? Number(override.receivedWeight)
                        : (Number(line.receivedWeight) > 0 ? Number(line.receivedWeight) : theoreticalWeight * receivedQty);
                    const expectedWeight = theoreticalWeight * orderedQty;
                    variationPct = expectedWeight > 0 ? ((receivedWeight - expectedWeight) / expectedWeight) * 100 : 0;
                    // Tolerance exceeded → auto QC Pending Approval (variances need manual approval)
                    if (Math.abs(variationPct) > tolerancePct) autoFlagPending = true;
                }
                serverLinesPayload.push({
                    ...(isServerId(line.id) ? { lineId: line.id } : {}),
                    lineIndex: idx,
                    receivedQty,
                    ...(receivedWeight ? { receivedWeight } : {}),
                });
                weightMeta[line.id || `line-${idx}`] = {
                    isWeightItem,
                    tolerancePct,
                    theoreticalWeight,
                    orderedQty,
                    receivedQty,
                    receivedWeight,
                    variationPct,
                };
                if (item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        addSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'PURCHASE',
                    quantity: receivedQty,
                    unitCost: line.rate || item?.costPrice || 0,
                    // [PHASE-2A] capture weighed quantity for stock valuation on weight items
                    weighedQty: isWeightItem && receivedWeight ? receivedWeight : undefined,
                    referenceType: 'PurchaseBill',
                    referenceId: bill.id,
                    referenceNumber: bill.billNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: isWeightItem && variationPct !== null
                        ? `Weighed receipt for ${bill.billNumber} (${receivedWeight} ${line.weightUnit || item?.weightUnit || 'kg'}, var ${variationPct.toFixed(2)}%)`
                        : `Manual goods receipt for bill ${bill.billNumber}`,
                });
            });
            const finalQcStatus = autoFlagPending ? 'Pending Approval' : qcStatus;
            const updatedLine = (line, idx) => {
                const override = findOverride(line);
                const receivedQty = override && Number(override.receivedQty) >= 0 ? Number(override.receivedQty) : Number(line.qty || 1);
                const meta = weightMeta[line.id || `line-${idx}`] || {};
                return {
                    ...line,
                    qty: receivedQty,
                    receivedQty,
                    isWeightItem: meta.isWeightItem ?? Boolean(line.isWeightItem),
                    theoreticalWeight: meta.theoreticalWeight ?? line.theoreticalWeight,
                    tolerancePct: meta.tolerancePct ?? line.tolerancePct,
                    receivedWeight: meta.receivedWeight ?? line.receivedWeight,
                    variationPct: meta.variationPct !== null && meta.variationPct !== undefined ? Number(meta.variationPct.toFixed(2)) : undefined,
                };
            };
            // ── [PHASE-2A] bill at received weight: recompute line amounts + bill total when
            //   the bill contains at least one weight item (steel billed by weighed kg).
            const hasWeightLine = billLines.some((l) => weightMeta[l.id || `line-${billLines.indexOf(l)}`]?.isWeightItem);
            const recomputedLines = billLines.map(updatedLine);
            let recomputedTotal = null;
            if (hasWeightLine) {
                const sumLines = recomputedLines.reduce((s, line) => {
                    const qty = Number(line.qty || 0);
                    const rate = Number(line.rate || 0);
                    const disc = Number(line.discount || 0);
                    const tax = Number(line.tax !== undefined ? line.tax : 18);
                    const gross = qty * rate;
                    const afterDisc = gross * (1 - disc / 100);
                    const amount = Math.round(afterDisc * (1 + tax / 100) * 100) / 100;
                    return s + amount;
                }, 0);
                const otherFees = (Number(bill.freight || bill.freightCharges) || 0) + (Number(bill.otherCharges) || 0);
                recomputedTotal = Math.round((sumLines + otherFees) * 100) / 100;
            }
            setPurchaseBills((prev) => prev.map((b) => b.id === billId ? {
                ...b,
                goodsReceived: true,
                qcStatus: finalQcStatus, // [PHASE-2C] approved / pending / rejected captured on the receipt
                receivedDate: getCurrentISODate(),
                items: recomputedLines,
                lineItems: recomputedLines,
                // [PHASE-2A] bill revalued at the weighed quantity (kg) when weight lines exist
                ...(recomputedTotal !== null ? {
                    total: recomputedTotal,
                    amount: recomputedTotal,
                    balanceDue: Math.max(0, recomputedTotal - (Number(b.paidAmount ?? b.amountPaid) || 0)),
                } : {}),
            } : b));
            showToast(
                autoFlagPending
                    ? `Goods received with weight variance beyond tolerance — QC set to Pending Approval for ${bill.billNumber}.`
                    : `Stock received and added to inventory from bill ${bill.billNumber}`
            );
            // Server-side receive posts stock + QC authoritatively (api.md §6.3).
            if (isBackendEnabled() && isServerId(billId)) {
                const finalQc = autoFlagPending ? 'Pending Approval' : qcStatus;
                api.post(`/purchase/bills/${billId}/receive-goods/`, {
                    lines: serverLinesPayload,
                    qcStatus: ['Approved', 'Pending Approval', 'Rejected'].includes(finalQc) ? finalQc : 'Approved',
                }).then((body) => {
                    const resource = RESOURCES.purchaseBills;
                    const saved = resource.fromApi ? resource.fromApi(body.bill || body) : (body.bill || body);
                    if (saved) reconcile(setPurchaseBills, billId, saved);
                    refreshCollections(['purchaseBills', 'inventoryMovements', 'items', 'purchaseOrders']);
                }).catch((err) => {
                    console.warn('[ERP] receive-goods not saved:', err);
                    showToast(`Receipt not saved to server — ${describeError(err)}`);
                });
            }
        }
    };
    const updatePurchaseBillStatus = (id, status) => {
        const current = purchaseBills.find((b) => b.id === id);
        setPurchaseBills((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
        // Only drafts accept PATCH (api.md §1.9); posted bills move via
        // receive/cancel actions and payment allocations.
        if (!current || current.status === 'Draft') {
            persistUpdate('purchaseBills', id, { status }, setPurchaseBills);
        }
        showToast(`Vendor bill marked as ${status}.`);
    };
    // ── Vendor Bills (manual entry, backend contract: /purchase/vendor-bills/) ──
    // Mirrors addPurchaseBill: synchronous optimistic local write, server owns
    // ids/numbers/totals so its reply replaces the optimistic row via persist*.
    const addVendorBill = (bill) => {
        const rawLines = bill.lineItems || bill.items || [];
        const normLines = rawLines.map((line, idx) => {
            const qty = Number(line.qty ?? line.quantity ?? 0) || 0;
            const rate = Number(line.rate ?? line.price ?? 0) || 0;
            return {
                id: line.id || `vb-item-${Date.now()}-${idx}`,
                itemId: line.itemId || '',
                sku: line.sku || line.itemSku || '',
                itemSku: line.sku || line.itemSku || '',
                itemName: line.itemName || line.name || line.description || '',
                name: line.itemName || line.name || line.description || '',
                description: line.itemName || line.name || line.description || '',
                qty,
                quantity: qty,
                rate,
                price: rate,
                amount: Math.round(qty * rate * 100) / 100,
            };
        });
        const subtotal = bill.subtotal !== undefined
            ? Number(bill.subtotal)
            : Math.round(normLines.reduce((s, l) => s + (l.qty * l.rate), 0) * 100) / 100;
        const gstPct = bill.gstPct !== undefined ? Number(bill.gstPct) : 5;
        const gstAmount = bill.gstAmount !== undefined
            ? Number(bill.gstAmount)
            : Math.round(subtotal * (gstPct / 100) * 100) / 100;
        const total = bill.total !== undefined
            ? Number(bill.total)
            : Math.round((subtotal + gstAmount) * 100) / 100;
        const vend = vendors.find((v) => v.id === bill.vendorId)
            || vendors.find((v) => v.name?.toLowerCase() === String(bill.vendor || bill.vendorName || '').toLowerCase());
        const linkedPo = bill.purchaseOrderId
            ? purchaseOrders.find((p) => p.id === bill.purchaseOrderId || p.poNumber === bill.purchaseOrderId)
            : null;
        const newBill = {
            id: bill.id || `vb-${Date.now()}`,
            vendorBillNumber: bill.vendorBillNumber || bill.billNumber || `VB-2026-${String(vendorBills.length + 1).padStart(3, '0')}`,
            billDate: formatDateDDMMYYYY(bill.billDate || bill.date || 'Today'),
            date: formatDateDDMMYYYY(bill.billDate || bill.date || 'Today'),
            vendorId: bill.vendorId || vend?.id,
            vendor: bill.vendor || bill.vendorName || vend?.name || '',
            vendorName: bill.vendorName || bill.vendor || vend?.name || '',
            purchaseOrderId: bill.purchaseOrderId || linkedPo?.id || null,
            poNumber: linkedPo?.poNumber || bill.poNumber || '',
            grnId: bill.grnId || null,
            attachmentFileId: bill.attachmentFileId || null,
            fileName: bill.fileName || '',
            subtotal,
            gstPct,
            gstAmount,
            total,
            amount: total,
            remarks: bill.remarks || bill.notes || '',
            notes: bill.remarks || bill.notes || '',
            status: bill.status || 'Pending',
            matchStatus: bill.matchStatus || 'Pending Matching',
            purchaseBillId: bill.purchaseBillId || null,
            items: normLines,
            lineItems: normLines,
        };
        setVendorBills((prev) => [newBill, ...prev]);
        showToast(`Vendor bill ${newBill.vendorBillNumber} saved.`);
        persistCreate('vendorBills', newBill, setVendorBills);
        return newBill;
    };
    const updateVendorBill = (id, updates) => {
        let merged = null;
        setVendorBills((prev) => prev.map((b) => {
            if (b.id !== id) return b;
            const nextLines = (updates.lineItems || updates.items)
                ? (updates.lineItems || updates.items).map((line, idx) => {
                    const qty = Number(line.qty ?? line.quantity ?? 0) || 0;
                    const rate = Number(line.rate ?? line.price ?? 0) || 0;
                    return {
                        ...line,
                        id: line.id || `vb-item-${Date.now()}-${idx}`,
                        qty,
                        quantity: qty,
                        rate,
                        amount: Math.round(qty * rate * 100) / 100,
                    };
                })
                : (b.lineItems || b.items || []);
            const subtotal = updates.subtotal !== undefined ? Number(updates.subtotal)
                : (updates.lineItems || updates.items)
                    ? Math.round(nextLines.reduce((s, l) => s + (Number(l.qty) * Number(l.rate)), 0) * 100) / 100
                    : b.subtotal;
            const gstPct = updates.gstPct !== undefined ? Number(updates.gstPct) : b.gstPct;
            const gstAmount = updates.gstAmount !== undefined ? Number(updates.gstAmount)
                : Math.round(Number(subtotal) * (Number(gstPct) / 100) * 100) / 100;
            const total = updates.total !== undefined ? Number(updates.total)
                : Math.round((Number(subtotal) + gstAmount) * 100) / 100;
            merged = {
                ...b,
                ...updates,
                ...(updates.billDate || updates.date
                    ? { billDate: formatDateDDMMYYYY(updates.billDate || updates.date), date: formatDateDDMMYYYY(updates.billDate || updates.date) }
                    : {}),
                subtotal,
                gstPct,
                gstAmount,
                total,
                amount: total,
                items: nextLines,
                lineItems: nextLines,
            };
            return merged;
        }));
        if (merged) {
            persistUpdate('vendorBills', id, merged, setVendorBills);
            showToast(`Vendor bill ${merged.vendorBillNumber} updated.`);
        }
        return merged;
    };
    const cancelVendorBill = (id) => {
        const target = vendorBills.find((b) => b.id === id);
        if (!target) return { success: false, message: 'Vendor bill not found.' };
        setVendorBills((prev) => prev.filter((b) => b.id !== id));
        persistDelete('vendorBills', id);
        showToast(`Vendor bill ${target.vendorBillNumber} deleted.`);
        return { success: true, message: `Vendor bill ${target.vendorBillNumber} deleted.` };
    };
    const sendVendorBillForMatching = async (id) => {
        const target = vendorBills.find((b) => b.id === id);
        if (!target) return null;
        if (!isBackendEnabled() || !isServerId(id)) {
            setVendorBills((prev) => prev.map((b) => (b.id === id ? { ...b, matchStatus: 'Pending Matching' } : b)));
            showToast(`Vendor bill ${target.vendorBillNumber} queued for matching (will send on sync).`);
            return { ...target, matchStatus: 'Pending Matching' };
        }
        try {
            const res = await api.post(`/purchase/vendor-bills/${id}/send-for-matching/`, {});
            // Backend wraps the bill: {vendorBill, purchaseBillId, billNumber}.
            // Merge the wrapped bill so status/match/link actually update.
            const vb = res?.vendorBill || res || {};
            const linked = vb.purchaseBillId || vb.purchase_bill_id
                || res.purchaseBillId || res.purchase_bill_id || null;
            const linkedNo = vb.purchaseBillNumber || vb.purchase_bill_number
                || res.billNumber || res.bill_number || null;
            setVendorBills((prev) => prev.map((b) => (b.id === id ? {
                ...b,
                status: vb.status || b.status,
                matchStatus: vb.matchStatus || vb.match_status || 'Matched',
                matchResult: vb.matchResult ?? vb.match_result ?? b.matchResult,
                purchaseBillId: linked || b.purchaseBillId,
                purchaseBillNumber: linkedNo || b.purchaseBillNumber,
            } : b)));
            showToast(linked
                ? `Vendor bill matched — purchase bill ${linkedNo || ''} created.`
                : `Vendor bill ${target.vendorBillNumber} sent for matching.`);
            // Force-refresh the Purchase Bills list so step-6 / the Bills page
            // shows the new bill. (requestCollection would skip it because the
            // collection is already loaded — loadKeys always refetches.)
            loadKeys(['purchaseBills']);
            return { ...(typeof res === 'object' ? res : {}), purchaseBillId: linked, billNumber: linkedNo };
        } catch (err) {
            console.warn('[ERP] could not send vendor bill for matching:', err);
            // 409 BILL_MISMATCH carries payload.matching — stash it so the
            // Bill Matching page can render the mismatch without another fetch.
            const payloadMatching = err?.payload?.matching || err?.payload?.payload?.matching;
            if (payloadMatching) {
                setVendorBills((prev) => prev.map((b) => (b.id === id ? { ...b, matchResult: payloadMatching } : b)));
            }
            const isMismatch = err?.payload?.code === 'BILL_MISMATCH';
            showToast(isMismatch
                ? 'Quantities, rates or amounts do not match the PO/GRN. Approve the bill first, then resend for matching.'
                : `Could not send for matching — ${describeError(err)}`);
            return null;
        }
    };
    const getVendorBillMatching = async (id) => {
        if (!id) return null;
        if (!isBackendEnabled()) return null;
        try {
            const data = await api.get(`/purchase/vendor-bills/${id}/matching/`);
            return data;
        } catch (err) {
            console.warn('[ERP] could not fetch vendor bill matching:', err);
            showToast(`Could not load matching — ${describeError(err)}`);
            return null;
        }
    };
    const recheckVendorBillMatching = async (id) => {
        if (!id) return null;
        if (!isBackendEnabled() || !isServerId(id)) {
            showToast('Matching needs backend connection.');
            return null;
        }
        try {
            const data = await api.post(`/purchase/vendor-bills/${id}/recheck-matching/`, {});
            if (data) {
                setVendorBills((prev) => prev.map((b) => (b.id === id ? { ...b, matchResult: data } : b)));
            }
            showToast('Matching rechecked.');
            return data;
        } catch (err) {
            console.warn('[ERP] could not recheck vendor bill matching:', err);
            showToast(`Could not recheck matching — ${describeError(err)}`);
            return null;
        }
    };
    const applyApprovalRow = (id, row, fallbackStatus) => {
        setVendorBills((prev) => prev.map((b) => {
            if (b.id !== id) return b;
            const historyEntry = row.history || row.approvalHistory || (row.action ? [{
                at: row.at || row.approvedAt || new Date().toISOString(),
                by: row.by || row.approvedByName || row.approvedBy || '',
                action: row.action || fallbackStatus,
                remarks: row.remarks || row.approvalRemarks || '',
            }] : null);
            return {
                ...b,
                status: row.status || fallbackStatus,
                approvalRemarks: row.approvalRemarks ?? row.remarks ?? b.approvalRemarks,
                approvedAt: row.approvedAt ?? row.at ?? b.approvedAt,
                approvedByName: row.approvedByName ?? row.by ?? row.approvedBy ?? b.approvedByName,
                approvalHistory: historyEntry || b.approvalHistory,
                matchResult: row.matchResult ?? row.matching ?? b.matchResult,
            };
        }));
    };
    const getVendorBillApprovalHistory = async (id) => {
        if (!id || !isBackendEnabled()) return [];
        try {
            const data = await api.get(`/purchase/vendor-bills/${id}/approval-history/`);
            return data?.history || data || [];
        } catch (err) {
            console.warn('[ERP] could not fetch vendor bill approval history:', err);
            return [];
        }
    };
    const approveVendorBill = async (id, remarks) => {        const target = vendorBills.find((b) => b.id === id);
        if (!target) return null;
        if (!isBackendEnabled() || !isServerId(id)) {
            showToast('Approval needs backend connection.');
            return null;
        }
        try {
            const row = await api.post(`/purchase/vendor-bills/${id}/approve/`, { remarks: remarks || '' });
            applyApprovalRow(id, row || {}, 'Approved');
            showToast(`Vendor bill ${target.vendorBillNumber} approved.`);
            return row;
        } catch (err) {
            console.warn('[ERP] could not approve vendor bill:', err);
            const mismatchHint = err?.payload?.code === 'BILL_MISMATCH' || err?.code === 'BILL_MISMATCH'
                ? ' — quantities, rates or amounts do not match the PO/GRN'
                : '';
            showToast(`Could not approve — ${describeError(err)}${mismatchHint}`);
            return null;
        }
    };
    const rejectVendorBill = async (id, remarks) => {
        const target = vendorBills.find((b) => b.id === id);
        if (!target) return null;
        if (!isBackendEnabled() || !isServerId(id)) {
            showToast('Rejection needs backend connection.');
            return null;
        }
        try {
            const row = await api.post(`/purchase/vendor-bills/${id}/reject/`, { remarks: remarks || '' });
            applyApprovalRow(id, row || {}, 'Rejected');
            showToast(`Vendor bill ${target.vendorBillNumber} rejected.`);
            return row;
        } catch (err) {
            console.warn('[ERP] could not reject vendor bill:', err);
            showToast(`Could not reject — ${describeError(err)}`);
            return null;
        }
    };
    const addPaymentOut = (pay) => {
        const payAmt = Number(pay.amount) || 1000;
        // ── [PHASE-2D] Payment classification: Advance (against PO, no bill yet) vs Final/Bill ──
        // Old code always treated the disbursement as a bill settlement. Sweven releases
        //   advances to suppliers (steel on credit) which later adjust against the bill.
        const paymentType = pay.paymentType || (pay.billId || pay.billNumber ? 'Final' : 'Advance');
        const isAdvance = paymentType === 'Advance';
        let targetBill = null;
        if (pay.billId || pay.billNumber) {
            targetBill = purchaseBills.find((b) => (pay.billId && b.id === pay.billId) || (pay.billNumber && b.billNumber === pay.billNumber));
            if (targetBill) {
                if (targetBill.status === 'Cancelled') {
                    showToast('Cannot record payment against a cancelled bill.');
                    return null;
                }
                if (targetBill.status === 'Paid' || (targetBill.balanceDue !== undefined && targetBill.balanceDue <= 0.01)) {
                    showToast('Bill is already fully settled.');
                    return null;
                }
                const remainingBal = targetBill.balanceDue !== undefined ? targetBill.balanceDue : Math.max(0, (targetBill.total || targetBill.amount || 0) - (targetBill.paidAmount || targetBill.amountPaid || 0));
                if (!isAdvance && payAmt > remainingBal + 0.01) {
                    showToast(`Disbursement amount (${formatCurrency(payAmt)}) exceeds remaining bill balance (${formatCurrency(remainingBal)}).`);
                    return null;
                }
            }
        }

        const targetPo = pay.poNumber && purchaseOrders.find((p) => p.poNumber === pay.poNumber || p.id === pay.poId) || (pay.poId && purchaseOrders.find((p) => p.id === pay.poId));

        const newPay = {
            id: pay.id || `pout-${Date.now()}`,
            voucherNumber: pay.voucherNumber ||
                `VOU-2026-${String(paymentOuts.length + 93).padStart(3, '0')}`,
            vendorId: pay.vendorId || targetBill?.vendorId,
            vendor: pay.vendor || targetBill?.vendor || 'Arrow Electronics Supply',
            billId: isAdvance ? undefined : (pay.billId || targetBill?.id),
            billNumber: isAdvance ? undefined : (pay.billNumber || targetBill?.billNumber || 'PB-2026-015'),
            // [PHASE-2D] link advances to the purchase order they fund
            poId: pay.poId || targetPo?.id,
            poNumber: pay.poNumber || targetPo?.poNumber,
            paymentType,
            advanceApplied: Boolean(pay.advanceApplied),
            date: pay.date || getCurrentDateFormatted(),
            mode: pay.mode || 'ACH',
            amount: payAmt,
            reference: pay.reference || 'ACH-994821',
            status: 'Paid',
        };
        setPaymentOuts((prev) => [newPay, ...prev]);
        // Update vendor bill payment tracking and dynamic status (skipped for pure advances)
        if (!isAdvance && (newPay.billNumber || newPay.billId)) {
            setPurchaseBills((prev) => prev.map((b) => {
                if (b.billNumber === newPay.billNumber || (newPay.billId && b.id === newPay.billId)) {
                    const currentPaid = Number(b.amountPaid ?? b.paidAmount ?? 0);
                    const updatedPaid = currentPaid + payAmt;
                    const totalBill = Number(b.total || b.amount || 0);
                    const isFull = updatedPaid >= (totalBill - 0.01);
                    const derivedStatus = updatedPaid <= 0 ? 'Unpaid' : isFull ? 'Paid' : 'Partially Paid';
                    return {
                        ...b,
                        paidAmount: updatedPaid,
                        amountPaid: updatedPaid,
                        balanceDue: Math.max(0, totalBill - updatedPaid),
                        status: derivedStatus,
                    };
                }
                return b;
            }));
        }
        // Decrease vendor balance liability only for bill settlements.
        // Advances are vendor receivables (Dr Vendor Advances) and do not reduce AP.
        if (!isAdvance) {
            syncVendorBalance(newPay.vendorId, newPay.vendor, -payAmt);
        }
        // Deduct from Operating Bank Account (advance-applied adjustments already drew cash earlier)
        if (!newPay.advanceApplied) {
            setBankAccounts((prev) => prev.map((acc, idx) => idx === 0
                ? { ...acc, balance: Math.max(0, acc.balance - payAmt) }
                : acc));
        }
        // The disbursement's journal entry is posted server-side with the
        // payment — no local mirror (it would double-count in ledger views).
        if (isAdvance) {
            showToast(`Advance of ${formatCurrency(payAmt)} released to ${newPay.vendor}${newPay.poNumber ? ` for ${newPay.poNumber}` : ''}`);
        } else if (newPay.advanceApplied) {
            showToast(`Advance of ${formatCurrency(payAmt)} applied to bill ${newPay.billNumber}`);
        } else {
            showToast(`Disbursed ${formatCurrency(payAmt)} to ${newPay.vendor}`);
        }
        persistCreate('paymentOuts', newPay, setPaymentOuts, {
            onServer: () => refreshCollections(['paymentOuts', 'purchaseBills', 'journalEntries', 'parties', 'bankAccounts']),
        });
        return newPay;
    };
    // ── [PHASE-2D] Vendor / PO advance balance ──
    // Advance balance = sum of 'Advance' paymentOuts − advance-applied adjustments for a vendor.
    const getVendorAdvanceBalance = (vendorIdOrName, vendorName) => {
        const matchVendor = (p) => {
            if (!vendorIdOrName && !vendorName) return false;
            if (vendorIdOrName && p.vendorId === vendorIdOrName) return true;
            if (vendorIdOrName && p.vendor?.toLowerCase() === String(vendorIdOrName).toLowerCase()) return true;
            // [PHASE-2D] fall back to the name arg for bills without a vendorId
            if (vendorName && p.vendor?.toLowerCase() === String(vendorName).toLowerCase()) return true;
            return false;
        };
        const released = paymentOuts
            .filter((p) => p.paymentType === 'Advance' && matchVendor(p))
            .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const applied = paymentOuts
            .filter((p) => p.advanceApplied === true && matchVendor(p))
            .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return Math.max(0, released - applied);
    };
    // Apply an existing advance against a vendor bill (no new cash flow).
    const applyVendorAdvanceToBill = (billId, amount) => {
        const bill = purchaseBills.find((b) => b.id === billId);
        if (!bill) {
            showToast('Bill not found.');
            return null;
        }
        const advance = getVendorAdvanceBalance(bill.vendorId, bill.vendor);
        if (advance <= 0) {
            showToast(`No unapplied advance balance for ${bill.vendor}.`);
            return null;
        }
        const applyAmt = Math.min(Number(amount) || advance, advance);
        if (applyAmt <= 0) return null;
        return addPaymentOut({
            vendorId: bill.vendorId,
            vendor: bill.vendor,
            billId: bill.id,
            billNumber: bill.billNumber,
            paymentType: 'Final',
            advanceApplied: true,
            amount: applyAmt,
            date: getCurrentDateFormatted(),
            mode: 'Advance Adjustment',
            reference: `ADJ-${bill.billNumber}`,
        });
    };
    // ── [PHASE-2C] QC review, approval & rework of received goods ──
    // qcStatus lives on the purchase bill receipt: 'Approved' (stock usable),
    //   'Pending Approval' (auto-flagged on weight variance / manual hold),
    //   'Rejected' (raise purchase return / debit note), 'Rework' (sent back, re-receive).
    const updateQCStatus = (billId, newStatus, qcNote = '') => {
        const bill = purchaseBills.find((b) => b.id === billId);
        if (!bill) {
            showToast('Bill not found.');
            return null;
        }
        if (bill.status === 'Cancelled') {
            showToast('Cannot QC a cancelled bill.');
            return null;
        }
        setPurchaseBills((prev) => prev.map((b) => b.id === billId ? {
            ...b,
            qcStatus: newStatus,
            qcNote: qcNote || b.qcNote,
            qcUpdatedAt: getCurrentISODate(),
        } : b));
        // Server-side QC gate (api.md §6.3) — the weight-variance rule runs
        // there too; the reconciled record wins.
        if (isBackendEnabled() && isServerId(billId)) {
            api.post(`/purchase/bills/${billId}/qc/`, { status: newStatus, note: qcNote || undefined })
                .then((body) => {
                    const resource = RESOURCES.purchaseBills;
                    const saved = resource.fromApi ? resource.fromApi(body) : body;
                    if (saved) reconcile(setPurchaseBills, billId, saved);
                    refreshCollections(['purchaseBills', 'inventoryMovements', 'items']);
                })
                .catch((err) => {
                    console.warn('[ERP] QC not saved:', err);
                    showToast(`QC not saved to server — ${describeError(err)}`);
                });
        }
        const hintMap = {
            'Approved': 'approved for inventory',
            'Pending Approval': 'held for inspection',
            'Rejected': 'rejected — raise a purchase return / debit note',
            'Rework': 'sent back for rework — goods will be re-received',
        };
        showToast(`QC set to ${newStatus} — ${bill.billNumber} ${hintMap[newStatus] || ''}`);
        return { ...bill, qcStatus: newStatus };
    };
    // QC gate for outbound dispatch: blocks selling any item whose latest inbound
    //   stock is still pending / rejected / rework. Sweven never ships unchecked steel.
    const getItemQCBlock = (itemIdOrSku) => {
        if (!itemIdOrSku) return false;
        const target = String(itemIdOrSku).toLowerCase();
        const lineHas = (line) =>
            (line.itemId && String(line.itemId).toLowerCase() === target) ||
            (line.itemSku && String(line.itemSku).toLowerCase() === target) ||
            (line.sku && String(line.sku).toLowerCase() === target);
        return (purchaseBills || []).some((b) =>
            b.goodsReceived === true &&
            (b.qcStatus === 'Pending Approval' || b.qcStatus === 'Rejected' || b.qcStatus === 'Rework') &&
            (b.items || b.lineItems || []).some(lineHas)
        );
    };
    const addQualityStandard = (std) => {
        const newStd = {
            id: std.id || `qs-${Date.now()}`,
            name: std.name || 'New QC Standard',
            category: std.category || 'General',
            categoryId: std.categoryId,
            checks: Array.isArray(std.checks) ? std.checks : [],
            tolerancePct: std.tolerancePct !== undefined ? Number(std.tolerancePct) : 2,
            active: std.active !== false,
        };
        setQualityStandards((prev) => [newStd, ...prev]);
        // Resolve the category name to a saved category row when possible.
        if (!newStd.categoryId) {
            const match = (categories || []).find((c) =>
                String(c?.name || '').toLowerCase() === String(newStd.category || '').toLowerCase());
            if (match && isServerId(match.id)) newStd.categoryId = match.id;
        }
        persistCreate('qualityStandards', newStd, setQualityStandards);
        showToast(`Quality standard "${newStd.name}" added.`);
        return newStd;
    };
    const updateQualityStandard = (id, updates) => {
        setQualityStandards((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
        persistUpdate('qualityStandards', id, updates, setQualityStandards);
        showToast('Quality standard updated.');
    };
    // ── [PHASE-2E] Chart of Accounts: derive balances from journal entries ──
    // Account balances are computed on-the-fly from posted journal entries (no separate ledger).
    // Assets (bank, AR, inventory, advances): Dr positive, Cr reduces. Liabilities/AP: Cr positive, Dr reduces.
    const getAccountBalances = () => {
        const balances = {};
        const posted = journalEntries.filter((e) => e.status === 'Posted');
        posted.forEach((e) => {
            const dr = e.debitAccount || 'Unmapped';
            const cr = e.creditAccount || 'Unmapped';
            balances[dr] = (balances[dr] || 0) + (Number(e.amount) || 0);
            balances[cr] = (balances[cr] || 0) - (Number(e.amount) || 0);
        });
        // Merge in live bank account balances so the COA reflects treasury
        (bankAccounts || []).forEach((a) => {
            const key = `1010 - Cash & Bank (${a.bankName || a.accountName || 'Operating'})`;
            balances[key] = Number(a.balance) || 0;
        });
        return balances;
    };
    // ── [PHASE-2E] Inter-bank transfer (no net AP/AR change, just treasury reshuffling) ──
    const addInterbankTransfer = (transfer) => {
        const amt = Number(transfer.amount) || 0;
        if (amt <= 0) { showToast('Transfer amount must be > 0.'); return null; }
        const fromIdx = bankAccounts.findIndex((a) => a.id === transfer.fromAccountId);
        const toIdx = bankAccounts.findIndex((a) => a.id === transfer.toAccountId);
        if (fromIdx < 0 || toIdx < 0) { showToast('Select valid source and destination accounts.'); return null; }
        if (fromIdx === toIdx) { showToast('Source and destination accounts must differ.'); return null; }
        if (bankAccounts[fromIdx].balance < amt + 0.01) {
            showToast(`Insufficient balance in ${bankAccounts[fromIdx].bankName}.`);
            return null;
        }
        setBankAccounts((prev) => prev.map((a, idx) => {
            if (idx === fromIdx) return { ...a, balance: Math.round((a.balance - amt) * 100) / 100 };
            if (idx === toIdx) return { ...a, balance: Math.round((a.balance + amt) * 100) / 100 };
            return a;
        }));
        const trNum = transfer.transferNumber || `TR-2026-${String((undefined?.length || 0) + 30 + transfers.length).padStart(3, '0')}`;
        const newTr = {
            id: `tr-${Date.now()}`,
            transferNumber: trNum,
            date: transfer.date || getCurrentDateFormatted(),
            fromAccount: bankAccounts[fromIdx]?.bankName || 'Operating',
            toAccount: bankAccounts[toIdx]?.bankName || 'Savings',
            amount: amt,
            reference: transfer.reference || '',
            status: 'Completed',
        };
        setTransfers((prev) => [newTr, ...prev]);
        // The transfer posts its own journal entry server-side
        // (post_bank_transfer) — no local mirror (it would double-count).
        // Bank-account rows must already exist server-side; temp accounts
        // stay local-only.
        if (isBackendEnabled()
            && isServerId(bankAccounts[fromIdx]?.id)
            && isServerId(bankAccounts[toIdx]?.id)) {
            persistCreate('bankTransfers', {
                ...newTr,
                fromAccountId: bankAccounts[fromIdx].id,
                toAccountId: bankAccounts[toIdx].id,
                notes: `Inter-bank transfer ${bankAccounts[fromIdx]?.bankName} → ${bankAccounts[toIdx]?.bankName}`,
            }, setTransfers, {
                onServer: () => refreshCollections(['journalEntries', 'bankAccounts']),
            });
        }
        showToast(`Inter-bank transfer ${trNum}: ${formatCurrency(amt)} moved from ${bankAccounts[fromIdx]?.bankName} to ${bankAccounts[toIdx]?.bankName}.`);
        return newTr;
    };
    // ── [PHASE-2E] Budgets master: planned amounts by account/category ──
    const defaultBudgets = [
        { id: 'bud-rent', name: 'Office & Warehouse Rent', category: 'Facility', annualAmount: 360000, account: '5020 - Rent', active: true },
        { id: 'bud-salary', name: 'Staff Salaries', category: 'Payroll', annualAmount: 2400000, account: '5010 - Salaries', active: true },
        { id: 'bud-raw', name: 'Raw Material (MS Steel)', category: 'COGS', annualAmount: 5000000, account: '5030 - Raw Material', active: true },
        { id: 'bud-utilities', name: 'Electricity & Power', category: 'Utilities', annualAmount: 480000, account: '5040 - Utilities', active: true },
        { id: 'bud-freight', name: 'Freight & Logistics', category: 'Logistics', annualAmount: 720000, account: '5050 - Freight', active: true },
        { id: 'bud-office', name: 'Office & Admin Supplies', category: 'Admin', annualAmount: 120000, account: '5060 - Office Supplies', active: true },
    ];
    const [budgets, setBudgets] = useState(defaultBudgets);
    const addBudget = (b) => {
        const newB = { id: b.id || `bud-${Date.now()}`, name: b.name || 'New Budget', category: b.category || 'General', annualAmount: Number(b.annualAmount) || 0, account: b.account || '5xxx - Expense', active: b.active !== false };
        setBudgets((prev) => [newB, ...prev]);
        showToast(`Budget "${newB.name}" created.`);
        return newB;
    };
    const updateBudget = (id, updates) => {
        setBudgets((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b));
    };
    const addPurchaseReturn = (ret) => {
        const bill = purchaseBills.find((b) => b.id === ret.billId || b.billNumber === ret.billRef);
        if (bill && bill.status === 'Cancelled') {
            showToast('Cannot create Purchase Return against a cancelled bill.');
            return null;
        }

        // Calculate line items with validation against previous returns
        const prevReturns = purchaseReturns.filter((pr) => (pr.billId === ret.billId || pr.billRef === ret.billRef) && pr.status !== 'Cancelled');
        
        let returnLines = [];
        if (ret.items && ret.items.length > 0) {
            returnLines = ret.items.map((line, idx) => {
                const billedQty = Number(line.billedQty ?? (bill?.items?.find((it) => (it.itemId && it.itemId === line.itemId) || (it.sku && it.sku === line.sku))?.qty) ?? line.qty ?? 1);
                const prevReturned = prevReturns.reduce((sum, pr) => {
                    const match = (pr.items || []).find((it) => (it.itemId && it.itemId === line.itemId) || (it.sku && it.sku === line.sku));
                    return sum + Number(match?.qty || 0);
                }, 0);
                const returnableQty = Math.max(0, billedQty - prevReturned);
                const requestedQty = Math.max(0, Number(line.qty || 0));
                const qty = Math.min(requestedQty, returnableQty);
                const condition = line.condition || ret.condition || 'Good';
                const rate = Number(line.rate || 0);
                const amount = Number(line.amount || Math.round(qty * rate * 100) / 100);

                return {
                    ...line,
                    id: line.id || `prt-item-${Date.now()}-${idx}`,
                    billedQty,
                    previouslyReturnedQty: prevReturned,
                    returnableQty,
                    qty,
                    condition,
                    rate,
                    amount,
                };
            }).filter((l) => l.qty > 0);
        }

        const calculatedTotal = returnLines.reduce((sum, it) => sum + it.amount, 0);
        const retAmt = calculatedTotal > 0 ? calculatedTotal : (ret.amount ?? 500);
        const defaultAddresses = resolveVendorPartyAddresses(ret.vendorId || bill?.vendorId, ret.vendor || bill?.vendor);

        const newDebit = {
            id: ret.id || `prt-${Date.now()}`,
            debitNoteNumber: ret.debitNoteNumber ||
                `DN-2026-${String(purchaseReturns.length + 10).padStart(3, '0')}`,
            vendorId: ret.vendorId || bill?.vendorId,
            vendor: ret.vendor || bill?.vendor || 'Delta Controls & Hydraulics',
            billingAddress: createAddressSnapshot(ret.billingAddress) || defaultAddresses.billing,
            shippingAddress: createAddressSnapshot(ret.shippingAddress) || defaultAddresses.shipping,
            billId: ret.billId || bill?.id,
            billRef: ret.billRef || bill?.billNumber || 'PB-2026-015',
            date: ret.date || getCurrentDateFormatted(),
            amount: retAmt,
            reason: ret.reason || 'Damaged goods on intake inspection',
            status: ret.status || 'Pending Credit',
            items: returnLines.length > 0 ? returnLines : (ret.items || []),
        };
        setPurchaseReturns((prev) => [newDebit, ...prev]);

        // Record movements: Good condition removes sellable inventory; Damaged/Scrap recorded without affecting sellable
        if (newDebit.items && newDebit.items.length > 0) {
            newDebit.items.forEach((line) => {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                const isGood = line.condition === 'Good';
                if (isGood && item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        removeSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: isGood ? 'PURCHASE_RETURN' : (line.condition === 'Scrap' ? 'SCRAP_RETURN' : 'DAMAGED_RETURN'),
                    quantity: isGood ? -(line.qty || 1) : 0,
                    // [PHASE-2A] weight-item returns reduce stock by the actual weighed kg returned
                    weighedQty: (isGood && item?.isWeightItem && Number(line.returnedWeight) > 0) ? -Number(line.returnedWeight) : undefined,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'PurchaseReturn',
                    referenceId: newDebit.id,
                    referenceNumber: newDebit.debitNoteNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: `Returned to ${newDebit.vendor} (${line.condition || 'Good'}): ${newDebit.reason}` + (item?.isWeightItem && Number(line.returnedWeight) > 0 ? ` (${line.returnedWeight} kg weighed)` : ''),
                });
            });
        }
        else if (newDebit.itemSku || newDebit.itemId) {
            const targetItem = items.find((i) => (newDebit.itemId && i.id === newDebit.itemId) || (newDebit.itemSku && i.sku?.toLowerCase() === String(newDebit.itemSku ?? '').toLowerCase()));
            if (targetItem) {
                recordMovement({
                    itemId: targetItem.id,
                    itemSku: targetItem.sku,
                    itemName: targetItem.name,
                    type: 'PURCHASE_RETURN',
                    quantity: -(newDebit.qty || 1),
                    unitCost: targetItem.costPrice,
                    referenceType: 'PurchaseReturn',
                    referenceId: newDebit.id,
                    referenceNumber: newDebit.debitNoteNumber,
                    notes: `Returned to ${newDebit.vendor}: ${newDebit.reason}`,
                });
            }
        }
        // Reduce vendor liability balance across vendors and parties
        syncVendorBalance(newDebit.vendorId, newDebit.vendor, -retAmt);
        // The debit note's journal entry is posted server-side — no local
        // mirror (it would double-count in ledger views).
        showToast(`Debit Note ${newDebit.debitNoteNumber} issued.`);
        persistCreate('purchaseReturns', newDebit, setPurchaseReturns, {
            onServer: (saved) => {
                if (saved && saved.id && saved.id !== newDebit.id) {
                    setInventoryMovements((prev) => prev.map((m) => (
                        m.referenceId === newDebit.id
                            ? { ...m, referenceId: saved.id, referenceNumber: saved.debitNoteNumber || m.referenceNumber }
                            : m
                    )));
                }
                refreshCollections(['purchaseReturns', 'purchaseBills', 'journalEntries', 'inventoryMovements', 'parties', 'items']);
            },
        });
        return newDebit;
    };
    const cancelPurchaseReturn = (returnId) => {
        const pr = purchaseReturns.find((r) => r.id === returnId);
        if (!pr) return { success: false, message: 'Return not found.' };
        if (pr.status === 'Cancelled') return { success: true, message: 'Already cancelled.' };

        // 1. Reverse inventory movements for Good condition items (restore stock & serials)
        (pr.items || []).forEach((line) => {
            if (line.condition === 'Good') {
                const targetSku = line.sku || line.itemSku;
                const item = items.find((i) => i.id === line.itemId || (targetSku && i.sku?.toLowerCase() === targetSku.toLowerCase()));
                if (item && item.trackingMode === 'Serial') {
                    const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
                    if (serials.length > 0) {
                        addSerialNumbers(item.id, serials);
                    }
                }
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || targetSku || 'GEN-SKU',
                    itemName: item?.name || line.name || line.description,
                    type: 'PURCHASE_REVERSAL',
                    quantity: Number(line.qty) || 1,
                    unitCost: item?.costPrice || line.rate || 0,
                    referenceType: 'PurchaseReturnCancellation',
                    referenceId: pr.id,
                    referenceNumber: pr.debitNoteNumber,
                    serials: line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []),
                    notes: `Reversal of return on Debit Note ${pr.debitNoteNumber} cancellation`,
                });
            }
        });

        // 2. Reverse vendor AP reduction across vendors and parties
        syncVendorBalance(pr.vendorId, pr.vendor, pr.amount);

        // 3. Server-side cancel reverses postings; re-read what it touched.
        // (No local reversal JE — it would double-count in ledger views.)
        // 4. Mark status as Cancelled
        setPurchaseReturns((prev) => prev.map((r) => r.id === returnId ? { ...r, status: 'Cancelled' } : r));
        runDocAction('purchaseReturns', returnId, 'cancel', {}, setPurchaseReturns, {
            refresh: ['purchaseReturns', 'purchaseBills', 'journalEntries', 'inventoryMovements', 'parties', 'items'],
        }).catch(() => {});
        showToast(`Debit Note ${pr.debitNoteNumber} cancelled.`);
        return { success: true, message: `Debit Note ${pr.debitNoteNumber} cancelled.` };
    };
    const updatePurchaseReturnStatus = (id, status) => {
        setPurchaseReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        persistUpdate('purchaseReturns', id, { status }, setPurchaseReturns);
    };
    const addExpense = (exp) => {
        const newExp = {
            id: exp.id || `exp-${Date.now()}`,
            expenseNumber: exp.expenseNumber ||
                `EXP-2026-${String(expenses.length + 119).padStart(3, '0')}`,
            category: exp.category || 'Logistics',
            date: exp.date || getCurrentDateFormatted(),
            payee: exp.payee || 'Freight Logistics Inc',
            amount: exp.amount ?? 150,
            paidVia: exp.paidVia || 'Corporate Card',
            taxDeductible: exp.taxDeductible ?? true,
        };
        setExpenses((prev) => [newExp, ...prev]);
        // Deduct from Operating Bank Account
        setBankAccounts((prev) => prev.map((acc, idx) => idx === 0
            ? { ...acc, balance: Math.max(0, acc.balance - (newExp.amount || 0)) }
            : acc));
        // The expense's journal entry is posted server-side — no local mirror.
        showToast(`Expense voucher ${newExp.expenseNumber} recorded.`);
        persistCreate('expenses', newExp, setExpenses, {
            onServer: () => refreshCollections(['expenses', 'journalEntries', 'bankAccounts']),
        });
        return newExp;
    };
    const addLocation = (loc) => {
        const newLoc = {
            id: loc.id || `loc-${Date.now()}`,
            code: loc.code || `LOC-${String(locations.length + 1).padStart(2, '0')}`,
            name: loc.name || 'New Facility Zone',
            type: loc.type || 'Assembly Bay',
            capacityPct: loc.capacityPct ?? 15,
            totalSkus: 0,
            manager: loc.manager || 'Operations Lead',
        };
        setLocations((prev) => [...prev, newLoc]);
        showToast(`Location ${newLoc.name} established.`);
        persistCreate('locations', newLoc, setLocations);
        return newLoc;
    };
    const addTransfer = (tr) => {
        const newTr = {
            id: tr.id || `tr-${Date.now()}`,
            transferNumber: tr.transferNumber || `TR-${Math.floor(9900 + Math.random() * 90)}`,
            sourceLocationId: tr.sourceLocationId,
            sourceLocation: tr.sourceLocation || 'Main Central Warehouse',
            destLocationId: tr.destLocationId,
            destLocation: tr.destLocation || 'Assembly Bay Zone A',
            date: tr.date || getCurrentDateFormatted(),
            itemsCount: tr.itemsCount ?? 1,
            status: tr.status || 'In Transit',
            shippedBy: tr.shippedBy || 'Logistics Clerk',
            vehicleNo: tr.vehicleNo || '',
            items: tr.items || [],
        };
        setTransfers((prev) => [newTr, ...prev]);
        // Record TRANSFER_OUT and TRANSFER_IN movements
        if (newTr.items && newTr.items.length > 0) {
            newTr.items.forEach((line) => {
                const item = items.find((i) => i.id === line.itemId || i.sku?.toLowerCase() === line.itemSku?.toLowerCase());
                // Transfer Out
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || line.itemSku || 'GEN-SKU',
                    itemName: item?.name || line.description,
                    locationId: newTr.sourceLocationId || 'loc-1',
                    locationName: newTr.sourceLocation,
                    type: 'TRANSFER_OUT',
                    quantity: -line.qty,
                    unitCost: item?.costPrice || line.rate,
                    referenceType: 'StockTransfer',
                    referenceId: newTr.id,
                    referenceNumber: newTr.transferNumber,
                    notes: `Transfer OUT to ${newTr.destLocation}`,
                });
                // Transfer In
                recordMovement({
                    itemId: item?.id || line.itemId || `itm-${Date.now()}`,
                    itemSku: item?.sku || line.itemSku || 'GEN-SKU',
                    itemName: item?.name || line.description,
                    locationId: newTr.destLocationId || 'loc-2',
                    locationName: newTr.destLocation,
                    type: 'TRANSFER_IN',
                    quantity: line.qty,
                    unitCost: item?.costPrice || line.rate,
                    referenceType: 'StockTransfer',
                    referenceId: newTr.id,
                    referenceNumber: newTr.transferNumber,
                    notes: `Transfer IN from ${newTr.sourceLocation}`,
                });
            });
        }
        showToast(`Transfer manifest ${newTr.transferNumber} created.`);
        // Server owns the transfer number and posts the OUT/IN movements on
        // receive; the re-read replaces the optimistic row and dedupes stock.
        if (isServerId(newTr.sourceLocationId) && isServerId(newTr.destLocationId)) {
            persistCreate('transfers', newTr, setTransfers, {
                onServer: (saved) => {
                    repointMovements(newTr.id, saved?.id);
                    refreshCollections(['transfers', 'inventoryMovements', 'items']);
                },
            });
        }
        return newTr;
    };
    const updateTransferStatus = (id, status) => {
        setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
        // Stock moves through dedicated actions (dispatch posts OUT/IN,
        // receive closes, cancel reverses); a bare status PATCH would only
        // relabel the row without moving stock.
        if (isBackendEnabled() && isServerId(id)) {
            const action = status === 'In Transit' ? 'dispatch' : status === 'Received' ? 'receive' : status === 'Cancelled' ? 'cancel' : null;
            if (action) {
                api.post(`/inventory/transfers/${id}/${action}/`, {}).then((body) => {
                    const resource = RESOURCES.transfers;
                    const saved = resource.fromApi ? resource.fromApi(body) : body;
                    if (saved) reconcile(setTransfers, id, saved);
                    refreshCollections(['transfers', 'inventoryMovements', 'items']);
                }).catch((err) => {
                    console.warn(`[ERP] transfer ${action} failed:`, err);
                    showToast(`Transfer not saved to server — ${describeError(err)}`);
                });
            } else {
                persistUpdate('transfers', id, { status }, setTransfers);
            }
        }
        showToast(`Stock transfer marked as ${status}.`);
    };
    const addServiceUsage = (usage) => {
        const newUsage = {
            id: usage.id || `su-${Date.now()}`,
            ticketNumber: usage.ticketNumber || `TKT-${Math.floor(9000 + Math.random() * 900)}`,
            technician: usage.technician || 'Liam Vance',
            itemId: usage.itemId,
            sku: usage.sku || 'CAB-6-01',
            qtyUsed: usage.qtyUsed ?? 1,
            date: usage.date || getCurrentDateFormatted(),
            purpose: usage.purpose || 'Rack cabling replacement',
        };
        setServiceUsages((prev) => [newUsage, ...prev]);
        // Record SERVICE_USAGE movement
        const targetItem = items.find((i) => i.id === newUsage.itemId || i.sku?.toLowerCase() === newUsage.sku?.toLowerCase());
        if (targetItem) {
            recordMovement({
                itemId: targetItem.id,
                itemSku: targetItem.sku,
                itemName: targetItem.name,
                type: 'SERVICE_USAGE',
                quantity: -newUsage.qtyUsed,
                unitCost: targetItem.costPrice,
                referenceType: 'ServiceUsage',
                referenceId: newUsage.id,
                referenceNumber: newUsage.ticketNumber,
                notes: `Technician: ${newUsage.technician} - ${newUsage.purpose}`,
            });
        }
        showToast(`Consumed ${newUsage.qtyUsed}x ${newUsage.sku} on ${newUsage.ticketNumber}`);
        // Server allocates the ticket and posts the SERVICE_USAGE movement.
        if (targetItem && isServerId(targetItem.id)) {
            persistCreate('serviceUsages', { ...newUsage, itemId: targetItem.id }, setServiceUsages, {
                onServer: (saved) => {
                    repointMovements(newUsage.id, saved?.id);
                    refreshCollections(['serviceUsages', 'inventoryMovements', 'items']);
                },
            });
        }
        return newUsage;
    };
    const addBankAccount = (acc) => {
        const newAcc = {
            id: acc.id || `ba-${Date.now()}`,
            accountName: acc.accountName || 'Operating Account',
            bankName: acc.bankName || 'Commercial Bank',
            accountNumber: acc.accountNumber || `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
            balance: acc.balance ?? 10000,
            currency: acc.currency || 'USD',
        };
        setBankAccounts((prev) => [...prev, newAcc]);
        showToast(`Bank Account ${newAcc.bankName} added.`);
        return newAcc;
    };
    const addJournalEntry = (entry) => {
        const newEntry = {
            id: entry.id || `je-${Date.now()}`,
            entryNumber: entry.entryNumber || `JE-2026-${String(journalEntries.length + 81).padStart(3, '0')}`,
            date: entry.date || getCurrentDateFormatted(),
            description: entry.description || 'General Ledger Adjusting Entry',
            reference: entry.reference || 'MANUAL-ADJ',
            debitAccount: entry.debitAccount || '1010 - Cash & Bank',
            creditAccount: entry.creditAccount || '4010 - Sales Revenue',
            amount: entry.amount ?? 1000,
            status: 'Posted',
        };
        setJournalEntries((prev) => [newEntry, ...prev]);
        // Manual entries post balanced Dr = Cr lines. Resolve both legs
        // against the chart of accounts; without resolvable accounts the row
        // stays local-only instead of 400ing.
        if (isBackendEnabled()) {
            const amount = Number(newEntry.amount) || 0;
            pullAll(['chartOfAccounts']).then(({ chartOfAccounts }) => {
                const findAccount = (label) => {
                    const code = String(label || '').split(' ')[0];
                    return (chartOfAccounts || []).find((a) =>
                        (code && a.code === code) || (label && a.name === label));
                };
                const dr = findAccount(newEntry.debitAccount);
                const cr = findAccount(newEntry.creditAccount);
                if (!dr?.id || !cr?.id || !isServerId(dr.id) || !isServerId(cr.id) || !(amount > 0)) {
                    showToast('Journal entry saved locally — ledger accounts not found on server.');
                    return;
                }
                persistCreate('journalEntries', {
                    ...newEntry,
                    lines: [
                        { accountId: dr.id, debit: amount, description: newEntry.description },
                        { accountId: cr.id, credit: amount, description: newEntry.description },
                    ],
                }, setJournalEntries, {
                    onServer: () => refreshCollections(['journalEntries']),
                });
            }).catch(() => {});
        }
        showToast(`Journal entry ${newEntry.entryNumber} posted to GL.`);
        return newEntry;
    };
    const addWarrantyCard = (cardData) => {
        const nextNum = `WC-2026-${String(warranties.length + 100).padStart(5, '0')}`;
        const newCard = {
            id: cardData.id || `wc-${Date.now()}`,
            cardNumber: cardData.cardNumber || nextNum,
            createdAt: new Date().toISOString().split('T')[0],
            generatedAt: cardData.documentStatus === 'Generated' ? new Date().toISOString().split('T')[0] : undefined,
            documentStatus: cardData.documentStatus || 'Generated',
            ...cardData,
        };
        // Compute coverage status dynamically if not set
        if (!newCard.coverageStatus || newCard.coverageStatus === 'Active' || newCard.coverageStatus === 'Pending Activation') {
            newCard.coverageStatus = calculateWarrantyCoverageStatus(newCard.startDate, newCard.expiryDate, newCard.documentStatus);
        }
        setWarranties((prev) => [newCard, ...prev]);
        persistCreate('warranties', newCard, setWarranties);
        showToast(`Warranty Card ${newCard.cardNumber} saved.`);
        return newCard;
    };

    const updateWarrantyCard = (id, updates) => {
        setWarranties((prev) => prev.map((w) => {
            if (w.id !== id && w.cardNumber !== id) return w;
            const updated = { ...w, ...updates };
            if (updates.startDate || updates.expiryDate || updates.documentStatus) {
                updated.coverageStatus = calculateWarrantyCoverageStatus(
                    updated.startDate,
                    updated.expiryDate,
                    updated.documentStatus || w.documentStatus
                );
            }
            return updated;
        }));
        persistUpdate('warranties', id, updates, setWarranties);
        showToast('Warranty Card updated successfully.');
    };

    const cancelWarrantyCard = (id, reason = '') => {
        const updates = {
            documentStatus: 'Cancelled',
            coverageStatus: 'Cancelled',
            cancellationReason: reason,
        };
        setWarranties((prev) => prev.map((w) => {
            if (w.id !== id && w.cardNumber !== id) return w;
            return {
                ...w,
                ...updates,
            };
        }));
        persistUpdate('warranties', id, updates, setWarranties);
        showToast('Warranty Card marked as Void / Cancelled.');
    };

    const voidWarrantyCard = (id, reason = '') => {
        cancelWarrantyCard(id, reason);
    };

    const suspendWarrantyCard = (id, reason = '') => {
        const updates = {
            coverageStatus: 'Suspended',
            documentStatus: 'Suspended',
            suspendReason: reason || 'Temporarily suspended on hold',
        };
        setWarranties((prev) => prev.map((w) => {
            if (w.id !== id && w.cardNumber !== id) return w;
            return {
                ...w,
                ...updates,
            };
        }));
        persistUpdate('warranties', id, updates, setWarranties);
        showToast('Warranty coverage paused / suspended.');
    };

    const resumeWarrantyCard = (id) => {
        const updates = {
            documentStatus: 'Generated',
            suspendReason: undefined,
        };
        setWarranties((prev) => prev.map((w) => {
            if (w.id !== id && w.cardNumber !== id) return w;
            const updated = {
                ...w,
                ...updates,
            };
            updated.coverageStatus = calculateWarrantyCoverageStatus(updated.startDate, updated.expiryDate, updated.documentStatus);
            return updated;
        }));
        persistUpdate('warranties', id, updates, setWarranties);
        showToast('Warranty coverage resumed to Active.');
    };

    const deleteWarrantyCard = (id) => {
        setWarranties((prev) => prev.filter((w) => w.id !== id && w.cardNumber !== id));
        persistDelete('warranties', id);
        showToast('Warranty draft deleted.');
    };

    const getWarrantyByChallanId = (challanId) => {
        return warranties.find((w) => (w.deliveryChallanId === challanId || w.challanNumber === challanId) && w.documentStatus !== 'Cancelled');
    };

    const getWarrantyBySerial = (serialNumber) => {
        if (!serialNumber) return null;
        const sNorm = String(serialNumber).trim().toLowerCase();
        return warranties.find((w) => {
            if (w.documentStatus === 'Cancelled') return false;
            const matchesItem = (w.items || []).some((it) => {
                if (Array.isArray(it.serialNumbers) && it.serialNumbers.some((s) => String(s).trim().toLowerCase() === sNorm)) return true;
                if (it.serialNumber && String(it.serialNumber).trim().toLowerCase() === sNorm) return true;
                if (it.components && it.components.some((c) => c.serialNumber && String(c.serialNumber).trim().toLowerCase() === sNorm)) return true;
                return false;
            });
            return matchesItem;
        });
    };

    const exportDatabaseSnapshot = async () => {
        try {
            // A backup is of the database, not of the screens this session
            // happened to open, so anything still unloaded is pulled first.
            const pulled = await loadAllCollections();
            const all = (key, inMemory) => pulled[key] || inMemory;
            const snapshot = {
                metadata: {
                    appName: 'Evenmore ERP',
                    version: '2.0.0',
                    exportedAt: new Date().toISOString(),
                    exportedDateFormatted: new Date().toLocaleString(),
                },
                data: {
                    parties: all('parties', parties),
                    customers: all('customers', customers),
                    vendors: all('vendors', vendors),
                    items: all('items', items),
                    categories: all('categories', categories),
                    units: all('units', units),
                    categoryParts,
                    itemParts,
                    estimates: all('estimates', estimates),
                    quotations: all('quotations', quotations),
                    salesOrders: all('salesOrders', salesOrders),
                    proformaInvoices: all('proformaInvoices', proformaInvoices),
                    deliveryChallans: all('deliveryChallans', deliveryChallans),
                    invoices: all('invoices', invoices),
                    warranties,
                    paymentIns: all('paymentIns', paymentIns),
                    salesReturns: all('salesReturns', salesReturns),
                    purchaseOrders: all('purchaseOrders', purchaseOrders),
                    purchaseBills: all('purchaseBills', purchaseBills),
                    vendorBills: all('vendorBills', vendorBills),
                    purchaseReturns: all('purchaseReturns', purchaseReturns),
                    paymentOuts: all('paymentOuts', paymentOuts),
                    expenses: all('expenses', expenses),
                    locations: all('locations', locations),
                    transfers: all('transfers', transfers),
                    serviceUsages: all('serviceUsages', serviceUsages),
                    valuationItems: all('valuationItems', valuationItems),
                    monthEndAudits: all('monthEndAudits', monthEndAudits),
                    bankAccounts: all('bankAccounts', bankAccounts),
                    journalEntries: all('journalEntries', journalEntries),
                    inventoryMovements: all('inventoryMovements', inventoryMovements),
                    faultyParts: all('faultyParts', faultyParts),
                    zoneRequests: all('zoneRequests', zoneRequests),
                },
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
            const downloadAnchor = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `evenmore-erp-backup-${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            showToast('ERP Database snapshot downloaded successfully.');
            return true;
        } catch (err) {
            console.error('Failed to export database snapshot:', err);
            showToast('Failed to export database snapshot.');
            return false;
        }
    };

    const importDatabaseSnapshot = (importedData) => {
        try {
            const payload = importedData?.data ? importedData.data : importedData;
            if (!payload || typeof payload !== 'object') {
                showToast('Invalid JSON backup file format.');
                return false;
            }

            if (Array.isArray(payload.parties)) setParties(payload.parties);
            if (Array.isArray(payload.customers)) setCustomers(payload.customers);
            if (Array.isArray(payload.vendors)) setVendors(payload.vendors);
            if (Array.isArray(payload.items)) setItems(payload.items);
            if (Array.isArray(payload.categories)) setCategories(payload.categories);
            if (Array.isArray(payload.units)) setUnits(payload.units);
            if (Array.isArray(payload.categoryParts)) setCategoryParts(payload.categoryParts);
            if (Array.isArray(payload.itemParts)) setItemParts(payload.itemParts);
            if (Array.isArray(payload.estimates)) setEstimates(payload.estimates);
            if (Array.isArray(payload.quotations)) setQuotations(payload.quotations);
            if (Array.isArray(payload.salesOrders)) setSalesOrders(payload.salesOrders);
            if (Array.isArray(payload.proformaInvoices)) setProformaInvoices(payload.proformaInvoices);
            if (Array.isArray(payload.deliveryChallans)) setDeliveryChallans(payload.deliveryChallans);
            if (Array.isArray(payload.invoices)) setInvoices(payload.invoices);
            if (Array.isArray(payload.warranties)) setWarranties(payload.warranties);
            if (Array.isArray(payload.paymentIns)) setPaymentIns(payload.paymentIns);
            if (Array.isArray(payload.salesReturns)) setSalesReturns(payload.salesReturns);
            if (Array.isArray(payload.purchaseOrders)) setPurchaseOrders(payload.purchaseOrders);
            if (Array.isArray(payload.purchaseBills)) setPurchaseBills(payload.purchaseBills);
            if (Array.isArray(payload.vendorBills)) setVendorBills(payload.vendorBills);
            if (Array.isArray(payload.purchaseReturns)) setPurchaseReturns(payload.purchaseReturns);
            if (Array.isArray(payload.paymentOuts)) setPaymentOuts(payload.paymentOuts);
            if (Array.isArray(payload.expenses)) setExpenses(payload.expenses);
            if (Array.isArray(payload.locations)) setLocations(payload.locations);
            if (Array.isArray(payload.transfers)) setTransfers(payload.transfers);
            if (Array.isArray(payload.serviceUsages)) setServiceUsages(payload.serviceUsages);
            if (Array.isArray(payload.valuationItems)) setValuationItems(payload.valuationItems);
            if (Array.isArray(payload.monthEndAudits)) setMonthEndAudits(payload.monthEndAudits);
            if (Array.isArray(payload.bankAccounts)) setBankAccounts(payload.bankAccounts);
            if (Array.isArray(payload.journalEntries)) setJournalEntries(payload.journalEntries);
            if (Array.isArray(payload.inventoryMovements)) setInventoryMovements(payload.inventoryMovements);
            if (Array.isArray(payload.faultyParts)) setFaultyParts(payload.faultyParts);
            if (Array.isArray(payload.zoneRequests)) setZoneRequests(payload.zoneRequests);

            showToast('ERP Database restored successfully from backup.');
            return true;
        } catch (err) {
            console.error('Failed to restore database snapshot:', err);
            showToast('Error restoring database snapshot.');
            return false;
        }
    };

    /**
     * Re-read every collection from the server, discarding anything this tab
     * was holding. There is no local factory set to fall back to any more.
     */
    const resetDatabaseToDefaults = async () => {
        try {
            await Promise.all([refreshFromBackend(), loadAllCollections()]);
            showToast('Reloaded every collection from the server.');
            return true;
        } catch (err) {
            console.error('Failed to reset data:', err);
            showToast('Could not reload from the server.');
            return false;
        }
    };

    return (<ERPContext.Provider value={lazyCollectionView({
            // Backend session state: `connected` once a pull has succeeded,
            // plus a manual re-pull for the "Sync now" affordance.
            backendStatus,
            refreshFromBackend,
            warranties,
            addWarrantyCard,
            updateWarrantyCard,
            cancelWarrantyCard,
            voidWarrantyCard,
            suspendWarrantyCard,
            resumeWarrantyCard,
            deleteWarrantyCard,
            getWarrantyByChallanId,
            getWarrantyBySerial,
            faultyParts,
            invoices,
            zoneRequests,
            customers,
            vendors,
            parties,
            addParty,
            updateParty,
            units,
            addUnit,
            categoryParts,
            addCategoryPart,
            removeCategoryPart,
            itemParts,
            addItemPart,
            updateItemPart,
            removeItemPart,
            customersFromParties,
            vendorsFromParties,
            addSerialNumbers,
            removeSerialNumbers,
            items,
            categories,
            fabrics,
            estimates,
            addEstimate,
            updateEstimate,
            deleteEstimate,
            convertEstimateToQuotation,
            quotations,
            salesOrders,
            proformaInvoices,
            addProformaInvoice,
            updateProformaInvoice,
            updateProformaInvoiceStatus,
            convertProformaToInvoice,
            deleteProformaInvoice,
            deliveryChallans,
            paymentIns,
            salesReturns,
            purchaseOrders,
            productionInstructions,
            purchaseBills,
            vendorBills,
            paymentOuts,
            purchaseReturns,
            expenses,
            locations,
            transfers,
            serviceUsages,
            valuationItems,
            monthEndAudits,
            bankAccounts,
            journalEntries,
            inventoryMovements,
            currency,
            setCurrency,
            formatCurrency,
            currencySymbol,
            companyProfile,
            setCompanyProfile,
            formatDateDDMMYYYY,
            getCurrentDateFormatted,
            getCurrentISODate,
            addDaysISO,
            toastMessage,
            showToast,
            calculateItemStock,
            getItemMovements,
            getCustomerLedger,
            getVendorLedger,
            getInvoiceOutstanding,
            getBillOutstanding,
            recordMovement,
            addFaultyPart,
            updateFaultyPartStatus,
            updateFaultyPartNotes,
            createAddressSnapshot,
            resolvePartyAddresses,
            resolveVendorPartyAddresses,
            syncVendorBalance,
            createInvoice,
            updateDraftInvoice,
            finalizeInvoice,
            cancelSalesInvoice,
            updateInvoiceStatus,
            addZoneRequest,
            updateZoneRequest,
            updateZoneRequestStatus,
            addInventoryItem,
            updateInventoryItem,
            adjustItemStock,
            addCustomer,
            updateCustomer,
            addVendor,
            updateVendor,
            addCategory,
            updateCategory,
            addQuotation,
            updateQuotationStatus,
            approveQuotation,
            recordQuotationActivity,
            syncQuotationShare,
            convertQuotationToDeliveryChallan,
            convertQuotationToSalesOrder,
            addSalesOrder,
            updateSalesOrderStage,
            cancelSalesOrder,
            convertSalesOrderToInvoice,
            convertSalesOrderToChallan,
            addDeliveryChallan,
            updateDeliveryChallanStatus,
            cancelDeliveryChallan,
            addPaymentIn,
            addSalesReturn,
            cancelSalesReturn,
            addPurchaseOrder,
            updatePurchaseOrderStatus,
            cancelPurchaseOrder,
            deletePurchaseOrder,
            getPoBilledStatus,
            convertPurchaseOrderToBill,
            addProductionInstruction,
            updateProductionInstructionStatus,
            updateProductionInstruction,
            deleteProductionInstruction,
            addPurchaseBill,
            cancelPurchaseBill,
            updatePurchaseBillStatus,
            addVendorBill,
            updateVendorBill,
            cancelVendorBill,
            sendVendorBillForMatching,
            getVendorBillMatching,
            recheckVendorBillMatching,
            getVendorBillApprovalHistory,
            approveVendorBill,
            rejectVendorBill,
            receivePurchaseBillGoods,
            addPaymentOut,
            // [PHASE-2D] advance-vs-final payment support, PO-linked advances & advance adjustment
            getVendorAdvanceBalance,
            applyVendorAdvanceToBill,
            // [PHASE-2C] QC status control, dispatch gate & quality standards master
            qualityStandards,
            addQualityStandard,
            updateQualityStandard,
            updateQCStatus,
            getItemQCBlock,
            // [PHASE-2E] COA balances, inter-bank transfer & budgets
            getAccountBalances,
            addInterbankTransfer,
            budgets,
            addBudget,
            updateBudget,
            addPurchaseReturn,
            cancelPurchaseReturn,
            updatePurchaseReturnStatus,
            addExpense,
            addLocation,
            addTransfer,
            updateTransferStatus,
            addServiceUsage,
            addBankAccount,
            addJournalEntry,
            resetDemoData: resetDatabaseToDefaults,
            exportDatabaseSnapshot,
            importDatabaseSnapshot,
            resetDatabaseToDefaults,
        }, requestCollection)}>
      {children}
      {/* Global Toast Banner */}
      {toastMessage && (
        <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </ERPContext.Provider>);
};
export const useERP = () => {
    const context = useContext(ERPContext);
    if (!context) {
        throw new Error('useERP must be used within an ERPProvider');
    }
    return context;
};
