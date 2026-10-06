/**
 * backendSync — the translation layer between ERPContext's in-memory state and
 * the Django API.
 *
 * Two directions, both defined once per entity in `RESOURCES` below:
 *
 *   pull  — GET the collection and reshape each row into the object the UI
 *           components already read (`invoice.customer`, `challan.items`, …).
 *   push  — POST/PATCH a record the UI just built, then hand back the server's
 *           copy so the caller can replace the optimistic one. The server owns
 *           ids, document numbers and every total (api.md §1.7, §5.7), so its
 *           answer always wins over the locally computed record.
 *
 * With no auth token the module is inert: every push resolves to `null` and the
 * app keeps behaving exactly as it did before it had a backend.
 */
import { api, ApiError } from './api';
import { mapWithLimit } from './resourceSync';
import { getStoredToken } from '../utils/authUtils';
import { formatDateDDMMYYYY, toISODate } from '../utils/dateUtils';

export { ApiError };

/** No token → no server. Pushes become no-ops rather than errors. */
export function isBackendEnabled() {
  return Boolean(getStoredToken());
}

// ── shared field mapping ─────────────────────────────────────────────────────

/** `DD/MM/YYYY`, `Today`, a Date or an ISO string → `YYYY-MM-DD` for the API. */
function isoOut(value) {
  if (!value) return undefined;
  const iso = toISODate(value);
  return iso || undefined;
}

/** `YYYY-MM-DD` → the `DD/MM/YYYY` the tables and print views render. */
function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Drop keys the API rejects rather than sending `undefined` through JSON. */
function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
}

/**
 * A document line as the server wants it. `itemId` is what ties the line to
 * stock; a line without one is a free-text charge and is sent as-is.
 */
function lineToApi(line, index) {
  return compact({
    lineNo: line.lineNo ?? index + 1,
    itemId: line.itemId || line.inventoryItemId || undefined,
    sku: line.sku || line.itemSku || undefined,
    itemName: line.itemName || line.name || undefined,
    description: line.description || line.name || line.itemName || '',
    hsnCode: line.hsnCode || undefined,
    uom: line.uom || line.unit || undefined,
    qty: num(line.qty ?? line.quantity, 1),
    rate: num(line.rate ?? line.price),
    discount: num(line.discount ?? line.discountPercent),
    tax: line.tax !== undefined ? num(line.tax) : num(line.taxRate, 18),
    // BOM provenance: api.md §4.3 requires the server to persist and re-emit these.
    isBomGenerated: line.isBomGenerated ?? undefined,
    bomSourceItemId: line.bomSourceItemId || undefined,
    parentLineId: line.parentLineId || undefined,
    isBomPart: line.isBomPart ?? undefined,
    isUserModified: line.isUserModified ?? undefined,
    serials: Array.isArray(line.serials) ? line.serials : undefined,
  });
}

function lineFromApi(line) {
  return {
    ...line,
    // The editors read `name`/`amount`; the API calls them `itemName`/`amount`.
    name: line.itemName || line.description || '',
    quantity: line.qty,
    amount: line.amount,
  };
}

/**
 * Header fields every sales/purchase document shares (`DocumentSerializer`).
 * `partyField` is `partyId` on the sales side and `vendorId` on the purchase
 * side — api.md §6.2 names the same column differently there.
 */
function documentToApi(doc, { partyField = 'partyId', partyKeys = [] } = {}) {
  const lines = doc.lineItems || doc.items || [];
  const partyId = partyKeys.map((k) => doc[k]).find(Boolean);
  return compact({
    [partyField]: partyId,
    date: isoOut(doc.date) || isoOut('Today'),
    dueDate: isoOut(doc.dueDate),
    expectedDate: isoOut(doc.expectedDate || doc.deliveryDate),
    validUntil: isoOut(doc.validUntil || doc.validTill),
    notes: doc.notes || undefined,
    terms: doc.terms || doc.termsAndConditions || undefined,
    referenceNumber: doc.referenceNumber || doc.reference || undefined,
    location: doc.location || undefined,
    freightCharges: doc.freightCharges !== undefined ? num(doc.freightCharges) : undefined,
    otherCharges: doc.otherCharges !== undefined ? num(doc.otherCharges) : undefined,
    roundOff: doc.roundOff !== undefined ? num(doc.roundOff) : undefined,
    discountOverride: doc.discountTotal !== undefined ? num(doc.discountTotal) : undefined,
    lineItems: lines.map(lineToApi),
  });
}

/**
 * The inverse. Keeps the server's numbers (they are authoritative) and adds the
 * aliases the existing components read, so no view had to be rewritten.
 */
function documentFromApi(row, { numberField, partyLabel = 'customer' } = {}) {
  const lines = (row.lineItems || []).map(lineFromApi);
  const total = num(row.total);
  return {
    ...row,
    date: displayIn(row.date),
    dueDate: row.dueDate || undefined,
    [partyLabel]: row.partyName || row.vendorName || '',
    [`${partyLabel}Id`]: row.partyId || row.vendorId || undefined,
    [`${partyLabel}Gstin`]: row.partyGstin || undefined,
    items: lines,
    lineItems: lines,
    // The UI's own names for the totals the server computed.
    discountTotal: num(row.totalDiscount),
    taxableAmount: num(row.taxableValue),
    tax: num(row.totalTax),
    total,
    grandTotal: total,
    amount: total,
    paidAmount: num(row.amountPaid),
    balanceDue: num(row.balanceDue),
    status: row.displayStatus || row.status,
    finalized: Boolean(row.postedAt),
    ...(numberField ? { [numberField]: row[numberField] } : {}),
    _synced: true,
  };
}

/** A sales/purchase document resource, defined by the few things that differ. */
function documentResource(path, {
  partyField = 'partyId',
  partyKeys = ['partyId', 'customerId', 'vendorId', 'partyid'],
  partyLabel = 'customer',
  numberField,
} = {}) {
  return {
    path,
    toApi: (doc) => documentToApi(doc, { partyField, partyKeys }),
    fromApi: (row) => documentFromApi(row, { numberField, partyLabel }),
  };
}

// ── parties ─────────────────────────────────────────────────────────────────

function partyToApi(party) {
  return compact({
    // `code` is deliberately omitted: the server allocates CUST-/VEND- numbers
    // (api.md §1.7) and a client-invented one would collide.
    type: party.type || party.partyType || 'Customer',
    // Nullable on the server; `null` clears a stale classification when the
    // role is edited away from Vendor.
    vendorType: party.vendorType || null,
    // Transporter fleet details — same clear-on-role-change contract.
    vehicleNumber: party.vehicleNumber || null,
    vehicleType: party.vehicleType || null,
    vehicleCapacity:
      party.vehicleCapacity !== undefined && party.vehicleCapacity !== '' && party.vehicleCapacity !== null
        ? num(party.vehicleCapacity)
        : null,
    vehicleCapacityUnit: party.vehicleCapacityUnit || null,
    name: party.name,
    phone: party.phone || undefined,
    email: party.email || undefined,
    gstTreatment: party.gstTreatment || undefined,
    gstin: party.gstin || undefined,
    gstNotes: party.gstNotes || undefined,
    placeOfSupply: stripStateCode(party.placeOfSupply),
    tdsApplicable: party.tdsApplicable ?? undefined,
    tdsSection: party.tdsSection || undefined,
    tdsRate: party.tdsRate ? num(party.tdsRate) : undefined,
    tcsApplicable: party.tcsApplicable ?? undefined,
    tcsRate: party.tcsRate ? num(party.tcsRate) : undefined,
    creditLimit: party.creditLimit !== undefined ? num(party.creditLimit) : undefined,
    paymentTerms: party.paymentTerms || undefined,
    bankAccountNumber: party.bankAccountNumber || undefined,
    ifscCode: party.ifscCode || undefined,
    bankName: party.bankName || undefined,
    accountHolderName: party.accountHolderName || undefined,
    openingBalance: party.openingBalance !== undefined ? num(party.openingBalance) : undefined,
    billingAddress: party.billingAddress || undefined,
    shippingAddress: party.shippingAddress || undefined,
    status: party.status || 'Active',
  });
}

/** The UI writes `Maharashtra (27)`; the column holds the state name alone. */
function stripStateCode(value) {
  if (!value) return undefined;
  return String(value).replace(/\s*\(\d+\)\s*$/, '').trim() || undefined;
}

function partyFromApi(row) {
  return {
    ...row,
    partyType: row.type,
    contactPerson: row.contacts?.[0]?.name || '',
    _synced: true,
  };
}

/** `customers` and `vendors` are projections of the same table. */
function customerFromParty(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactPerson: row.contacts?.[0]?.name || '',
    email: row.email || '',
    phone: row.phone || '',
    balance: num(row.balance),
    creditLimit: num(row.creditLimit),
    status: row.status === 'Inactive' ? 'On Hold' : (row.status || 'Active'),
    placeOfSupply: row.placeOfSupply,
    gstin: row.gstin,
    _synced: true,
  };
}

function vendorFromParty(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category || 'General',
    contactPerson: row.contacts?.[0]?.name || '',
    email: row.email || '',
    phone: row.phone || '',
    balance: num(row.balance),
    paymentTerms: row.paymentTerms || 'Net 30',
    status: row.status === 'Inactive' ? 'Inactive' : 'Active',
    gstin: row.gstin,
    _synced: true,
  };
}

// ── the registry ────────────────────────────────────────────────────────────
//
// Key = the ERPContext state array it feeds. `path` is the collection;
// `pullPath` overrides it when the read uses a narrower endpoint.

export const RESOURCES = {
  parties: {
    path: '/parties/',
    toApi: partyToApi,
    fromApi: partyFromApi,
  },
  customers: {
    path: '/parties/',
    pullPath: '/parties/customers/',
    toApi: (c) => partyToApi({ ...c, type: c.type || 'Customer' }),
    fromApi: customerFromParty,
  },
  vendors: {
    path: '/parties/',
    pullPath: '/parties/vendors/',
    toApi: (v) => partyToApi({ ...v, type: 'Vendor' }),
    fromApi: vendorFromParty,
  },
  categories: {
    path: '/inventory/categories/',
    toApi: (cat) => compact({
      name: cat.name,
      code: cat.code || undefined,
      kind: cat.kind || (cat.hasSubParts ? 'machine' : 'stock'),
      description: cat.description || undefined,
      hasSubParts: cat.hasSubParts ?? undefined,
      leadTimeDays: cat.leadTimeDays !== undefined ? num(cat.leadTimeDays) : undefined,
      defaultHsnCode: cat.defaultHsnCode || undefined,
      customFields: cat.customFields?.length ? cat.customFields : undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
  units: {
    path: '/inventory/units/',
    toApi: (u) => compact({ code: u.code, label: u.label || u.code }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
  locations: {
    path: '/inventory/locations/',
    toApi: (loc) => compact({
      name: loc.name,
      code: loc.code || undefined,
      type: loc.type || undefined,
      address: loc.address || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      manager: row.manager || 'Operations Lead',
      capacityPct: row.capacityPct ?? 0,
      _synced: true,
    }),
  },
  items: {
    path: '/inventory/items/',
    toApi: (item) => compact({
      sku: item.sku,
      name: item.name,
      description: item.description || undefined,
      categoryId: item.categoryId || undefined,
      itemKind: item.itemKind || 'Standalone',
      uom: item.uom || 'Unit',
      purchaseUnit: item.purchaseUnit || undefined,
      salesUnit: item.salesUnit || undefined,
      unitConversionFactor: num(item.unitConversionFactor, 1),
      // Opening stock only — after creation this is derived from movements
      // (api.md §4.2), so updates never send it.
      availableQty: item.availableQty !== undefined ? num(item.availableQty) : undefined,
      reorderLevel: item.reorderLevel !== undefined ? num(item.reorderLevel) : undefined,
      locationId: item.locationId || undefined,
      lifecycleStatus: item.lifecycleStatus || 'Active',
      costPrice: num(item.costPrice),
      sellingPrice: num(item.sellingPrice),
      hsnCode: item.hsnCode || undefined,
      trackingMode: item.trackingMode || 'Quantity',
      serialNumbers: item.serialNumbers?.length ? item.serialNumbers : undefined,
      isWeightItem: item.isWeightItem ?? undefined,
      theoreticalWeight: item.theoreticalWeight ? num(item.theoreticalWeight) : undefined,
      weightUnit: item.weightUnit || undefined,
      tolerancePct: item.tolerancePct !== undefined ? num(item.tolerancePct) : undefined,
      hasSheetSpec: item.hasSheetSpec ?? undefined,
      sheetHeight: item.sheetHeight ? num(item.sheetHeight) : undefined,
      sheetHeightUnit: item.sheetHeightUnit || undefined,
      sheetWidth: item.sheetWidth ? num(item.sheetWidth) : undefined,
      sheetWidthUnit: item.sheetWidthUnit || undefined,
      sheetLength: item.sheetLength ? num(item.sheetLength) : undefined,
      sheetLengthUnit: item.sheetLengthUnit || undefined,
      sheetWeightKg: item.sheetWeightKg ? num(item.sheetWeightKg) : undefined,
      // Fabric spec — only meaningful for Fabric items; cleared otherwise.
      fabricQuality: item.fabricQuality || null,
      fabricDesign: item.fabricDesign || null,
      fabricColor: item.fabricColor || null,
      fabricWidth:
        item.fabricWidth !== undefined && item.fabricWidth !== '' && item.fabricWidth !== null
          ? num(item.fabricWidth) : null,
      fabricGsm:
        item.fabricGsm !== undefined && item.fabricGsm !== '' && item.fabricGsm !== null
          ? num(item.fabricGsm) : null,
      customFieldValues: item.customFieldValues || undefined,
    }),
    // `availableQty` / `status` come off the movement ledger, so the row the
    // server returns is the only correct one.
    fromApi: (row) => ({ ...row, vendor: row.vendor || '', _synced: true }),
    // Derived columns are rejected on update (api.md §4.2).
    omitOnUpdate: ['availableQty', 'serialNumbers'],
  },

  // Sales pipeline (api.md §5)
  estimates: documentResource('/sales/estimates/', { numberField: 'estimateNumber' }),
  quotations: documentResource('/sales/quotations/', { numberField: 'quotationNumber' }),
  salesOrders: documentResource('/sales/orders/', { numberField: 'orderNumber' }),
  proformaInvoices: documentResource('/sales/proforma-invoices/', { numberField: 'piNumber' }),
  deliveryChallans: documentResource('/sales/challans/', { numberField: 'challanNumber' }),
  invoices: (() => {
    const base = documentResource('/sales/invoices/', { numberField: 'invoiceNumber' });
    return {
      ...base,
      // api.md §5.7: an invoice posts as a Draft unless the create says
      // otherwise. The UI decides that up front, so carry the flag through —
      // finalizing is what allocates the number and posts stock and ledger.
      toApi: (doc) => ({
        ...base.toApi(doc),
        finalize: doc.finalized === true || (doc.status && doc.status !== 'Draft'),
      }),
    };
  })(),
  salesReturns: documentResource('/sales/returns/', { numberField: 'returnNumber' }),
  warranties: {
    path: '/sales/warranties/',
    toApi: (w) => compact({
      customerId: w.customerId || w.partyId || undefined,
      contact_person: w.contactPerson || w.contact_person || undefined,
      delivery_challan: w.deliveryChallanId || w.delivery_challan || undefined,
      sales_invoice: w.salesInvoiceId || w.sales_invoice || undefined,
      sales_order: w.salesOrderId || w.sales_order || undefined,
      delivery_date: isoOut(w.deliveryDate || w.delivery_date),
      delivery_location: w.deliveryLocation || w.delivery_location || undefined,
      warranty_period: num(w.warrantyPeriod ?? w.warranty_period, 12),
      warranty_unit: w.warrantyUnit || w.warranty_unit || 'Months',
      warranty_start_event: w.warrantyStartEvent || w.warranty_start_event || 'dispatch',
      start_date: isoOut(w.startDate || w.start_date),
      expiry_date: isoOut(w.expiryDate || w.expiry_date),
      expiring_soon_days: num(w.expiringSoonDays ?? w.expiring_soon_days, 30),
      document_status: w.documentStatus || w.document_status || 'Generated',
      suspended_reason: w.suspendedReason || w.suspendReason || w.suspended_reason || undefined,
      cancelled_reason: w.cancelledReason || w.cancellationReason || w.cancelled_reason || undefined,
      void_reason: w.voidReason || w.void_reason || undefined,
      terms: w.terms || undefined,
      notes: w.notes || undefined,
      items: (w.items || []).map((it) => compact({
        itemId: it.itemId || it.inventoryItemId || undefined,
        sku: it.sku || undefined,
        item_name: it.itemName || it.name || it.item_name || undefined,
        qty: num(it.qty ?? it.quantity, 1),
        serials: Array.isArray(it.serials) ? it.serials : (Array.isArray(it.serialNumbers) ? it.serialNumbers : (it.serialNumber ? [it.serialNumber] : undefined)),
      })),
    }),
    fromApi: (row) => ({
      ...row,
      cardNumber: row.card_number || row.cardNumber,
      customer: row.customerName || row.customer,
      customerId: row.customerId,
      deliveryChallanId: row.delivery_challan,
      salesInvoiceId: row.sales_invoice,
      salesOrderId: row.sales_order,
      deliveryDate: displayIn(row.delivery_date),
      startDate: displayIn(row.start_date),
      expiryDate: displayIn(row.expiry_date),
      warrantyPeriod: row.warranty_period,
      warrantyUnit: row.warranty_unit,
      documentStatus: row.document_status || 'Generated',
      coverageStatus: row.coverageStatus,
      items: (row.items || []).map((it) => ({
        ...it,
        name: it.item_name || it.name || '',
        quantity: it.qty,
      })),
      _synced: true,
    }),
  },

  // Purchase pipeline (api.md §6) — same documents, `vendorId` on the wire.
  purchaseOrders: documentResource('/purchase/orders/', {
    partyField: 'vendorId', partyLabel: 'vendor', numberField: 'poNumber',
  }),
  purchaseBills: documentResource('/purchase/bills/', {
    partyField: 'vendorId', partyLabel: 'vendor', numberField: 'billNumber',
  }),
  purchaseReturns: documentResource('/purchase/returns/', {
    partyField: 'vendorId', partyLabel: 'vendor', numberField: 'returnNumber',
  }),

  paymentIns: {
    path: '/sales/payments/',
    toApi: (p) => compact({
      customerId: p.customerId || p.partyId,
      date: isoOut(p.date) || isoOut('Today'),
      amount: num(p.amount),
      mode: p.mode || 'Bank Transfer',
      bankAccountId: p.bankAccountId || undefined,
      referenceNumber: p.reference || p.referenceNumber || undefined,
      notes: p.notes || undefined,
      invoiceId: p.invoiceId || p.linkedInvoiceId || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      customer: row.customerName,
      reference: row.referenceNumber,
      _synced: true,
    }),
  },
  paymentOuts: {
    path: '/purchase/payments/',
    toApi: (p) => compact({
      vendorId: p.vendorId || p.partyId,
      date: isoOut(p.date) || isoOut('Today'),
      amount: num(p.amount),
      mode: p.mode || 'Bank Wire',
      bankAccountId: p.bankAccountId || undefined,
      referenceNumber: p.reference || p.referenceNumber || undefined,
      notes: p.notes || undefined,
      billId: p.billId || p.linkedBillId || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      vendor: row.vendorName,
      reference: row.referenceNumber,
      _synced: true,
    }),
  },
  expenses: {
    path: '/purchase/expenses/',
    toApi: (e) => compact({
      date: isoOut(e.date) || isoOut('Today'),
      categoryId: e.categoryId || undefined,
      category: e.category || undefined,
      vendorId: e.vendorId || undefined,
      amount: num(e.amount),
      taxAmount: e.taxAmount !== undefined ? num(e.taxAmount) : undefined,
      paymentMode: e.paymentMode || e.mode || undefined,
      bankAccountId: e.bankAccountId || undefined,
      description: e.description || e.notes || undefined,
      referenceNumber: e.reference || e.referenceNumber || undefined,
    }),
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  // ── the rest of the ERP state, which the registry used not to cover ───────

  transfers: {
    path: '/inventory/transfers/',
    toApi: (t) => compact({
      fromLocationId: t.fromLocationId || t.fromLocation || undefined,
      toLocationId: t.toLocationId || t.toLocation || undefined,
      date: isoOut(t.date),
      notes: t.notes || undefined,
      lineItems: (t.items || t.lineItems || []).map(lineToApi),
    }),
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  serviceUsages: {
    path: '/inventory/service-usage/',
    toApi: (u) => compact({
      itemId: u.itemId || undefined,
      date: isoOut(u.date),
      quantity: num(u.quantity ?? u.qty),
      reference: u.reference || undefined,
      notes: u.notes || undefined,
    }),
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  valuationItems: {
    path: '/inventory/valuation/',
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  monthEndAudits: {
    path: '/inventory/audits/',
    toApi: (a) => compact({
      period: a.period || undefined,
      locationId: a.locationId || undefined,
      status: a.status || undefined,
      notes: a.notes || undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  inventoryMovements: {
    path: '/inventory/movements/',
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  faultyParts: {
    path: '/inventory/faulty-parts/',
    toApi: (f) => compact({
      itemId: f.itemId || undefined,
      quantity: num(f.quantity ?? f.qty),
      reason: f.reason || undefined,
      status: f.status || undefined,
      reportedOn: isoOut(f.reportedOn || f.date),
    }),
    fromApi: (row) => ({ ...row, reportedOn: displayIn(row.reportedOn), _synced: true }),
  },

  zoneRequests: {
    path: '/inventory/zone-requests/',
    toApi: (z) => compact({
      itemId: z.itemId || undefined,
      fromZone: z.fromZone || undefined,
      toZone: z.toZone || undefined,
      quantity: num(z.quantity ?? z.qty),
      status: z.status || undefined,
      notes: z.notes || undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  bankAccounts: {
    path: '/accounts/bank-accounts/',
    toApi: (b) => compact({
      name: b.name || b.accountName,
      accountNumber: b.accountNumber || undefined,
      bankName: b.bankName || undefined,
      ifsc: b.ifsc || undefined,
      branch: b.branch || undefined,
      openingBalance: b.openingBalance !== undefined ? num(b.openingBalance) : undefined,
      isActive: b.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  journalEntries: {
    path: '/accounts/journal/',
    toApi: (j) => compact({
      date: isoOut(j.date),
      reference: j.reference || undefined,
      narration: j.narration || j.description || undefined,
      lines: j.lines || undefined,
      debitAccount: j.debitAccount || undefined,
      creditAccount: j.creditAccount || undefined,
      amount: j.amount !== undefined ? num(j.amount) : undefined,
      status: j.status || undefined,
    }),
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  chartOfAccounts: {
    path: '/accounts/chart-of-accounts/',
    toApi: (a) => compact({
      code: a.code,
      name: a.name,
      type: a.type || undefined,
      parentId: a.parentId || undefined,
      isActive: a.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
};

/** Every key the pull step knows how to load, in dependency order. */
export const PULL_ORDER = [
  'categories', 'units', 'locations', 'items',
  'parties', 'customers', 'vendors',
  'estimates', 'quotations', 'salesOrders', 'proformaInvoices',
  'deliveryChallans', 'invoices', 'paymentIns', 'salesReturns', 'warranties',
  'purchaseOrders', 'purchaseBills', 'paymentOuts', 'purchaseReturns', 'expenses',
  'transfers', 'serviceUsages', 'valuationItems', 'monthEndAudits',
  'inventoryMovements', 'faultyParts', 'zoneRequests',
  'bankAccounts', 'chartOfAccounts', 'journalEntries',
];

// ── transport ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 200;

/** One key per create attempt; `randomUUID` needs a secure context. */
function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Load one collection. Returns `null` (not `[]`) when the read fails, so the
 * caller can tell "the server has nothing" from "the server did not answer"
 * and leave the existing rows alone in the second case.
 */
export async function pullResource(key) {
  const resource = RESOURCES[key];
  if (!resource) return null;
  try {
    const body = await api.get(resource.pullPath || resource.path, {
      query: { limit: PAGE_SIZE },
    });
    const rows = Array.isArray(body) ? body : (body?.results || []);
    return rows.map(resource.fromApi || ((r) => r));
  } catch (err) {
    console.warn(`[backendSync] pull ${key} failed:`, err?.message || err);
    return null;
  }
}

/**
 * `GET /settings/company-profile/` — a single object, not a collection.
 *
 * Carries the tenant's currency, which decides how every amount on screen is
 * formatted (api.md §1.6), and the state that drives the CGST+SGST vs IGST
 * split on printed documents.
 */
export async function pullCompanyProfile() {
  if (!isBackendEnabled()) return null;
  try {
    const row = await api.get('/settings/company-profile/');
    if (!row) return null;
    const address = row.address || {};
    return {
      name: row.tradeName || row.legalName || '',
      legalName: row.legalName || '',
      gstin: row.gstin || '',
      pan: row.pan || '',
      // The letterhead wants one line; the API stores the parts.
      address: [address.line1, address.line2, address.city, address.state, address.pincode]
        .filter(Boolean).join(', '),
      addressParts: address,
      state: row.state || address.state || '',
      stateCode: row.stateCode || '',
      phone: row.phone || '',
      email: row.email || '',
      currency: row.currency || 'INR',
    };
  } catch (err) {
    console.warn('[backendSync] pull company profile failed:', err?.message || err);
    return null;
  }
}

/**
 * Load everything the registry covers. Failures are per-collection.
 *
 * Thirty collections sent at once is a burst no development server needs to
 * face, and the browser would queue most of them anyway, so this keeps a small
 * number in flight and works through the rest as they land.
 */
export async function pullAll(keys = PULL_ORDER) {
  const settled = await mapWithLimit(
    keys,
    async (key) => [key, await pullResource(key)],
  );
  return Object.fromEntries(settled.filter(([, rows]) => rows !== null));
}

/**
 * Create `record` on the server and return the server's version of it.
 *
 * Resolves to `null` when there is no session — the caller keeps its local
 * record and the app stays usable. A server *rejection* throws, because a
 * document the server refused must not look saved.
 */
export async function pushCreate(key, record, { idempotencyKey } = {}) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled()) return null;
  // A fresh key per attempt. Its job is to make the client's own retry of a
  // timed-out POST safe (api.md §1.8), not to deduplicate two deliberate
  // creates — deriving it from the local id would reject a legitimate second
  // document whenever an id got reused (mock rows have fixed ones).
  const body = await api.post(resource.path, resource.toApi(record), {
    idempotencyKey: idempotencyKey || newIdempotencyKey(),
  });
  return resource.fromApi ? resource.fromApi(body) : body;
}

export async function pushUpdate(key, id, updates) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
  const payload = resource.toApi(updates);
  (resource.omitOnUpdate || []).forEach((field) => delete payload[field]);
  const body = await api.patch(`${resource.path}${id}/`, payload);
  return resource.fromApi ? resource.fromApi(body) : body;
}

export async function pushDelete(key, id) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
  await api.delete(`${resource.path}${id}/`);
  return true;
}

/**
 * Server ids are UUIDs. Anything else is a local `inv-1758…` placeholder that
 * was never persisted — updating or deleting it over HTTP would 404.
 */
export function isServerId(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** A human-readable reason for a failed push, for the toast. */
export function describeError(err) {
  if (err instanceof ApiError) {
    const fieldErrors = err.payload?.field_errors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const [field, messages] = Object.entries(fieldErrors)[0] || [];
      if (field) return `${field}: ${[].concat(messages)[0]}`;
    }
    return err.message;
  }
  return err?.message || 'Could not reach the server';
}
