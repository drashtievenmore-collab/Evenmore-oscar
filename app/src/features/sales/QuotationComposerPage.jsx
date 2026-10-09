import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, FileText, Plus, Search,
  Send, Trash2, Package, RefreshCw, User,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useCrmStore } from '../../stores/crmStore';
import { withSampleTeam } from '../crm/common/sampleTeam';
import { isBackendEnabled, isServerId } from '../../services/resourceSync';
import { toISODate } from '../../utils/dateUtils';

const UOMS = ['Meter', 'Yard', 'Nos', 'Kg', 'Piece', 'Set'];
const GST_RATES = [0, 5, 12, 18, 28];
const VALIDITIES = [15, 30, 45, 60];
const PAYMENT_TERMS = [
  '30% Advance, 70% Before Dispatch',
  '50% Advance, 50% Before Dispatch',
  '100% Advance',
  'Net 15',
  'Net 30',
];
const APPROVAL_STEPS = ['Draft', 'Internal Approval', 'Sent', 'Approved', 'SO'];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysISO(iso, days) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + Number(days || 0));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inr(value) {
  return `₹${(Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

function amountInWords(value) {
  const n = Math.floor(Number(value) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (v) => (v < 20 ? ones[v] : `${tens[Math.floor(v / 10)]}${v % 10 ? ` ${ones[v % 10]}` : ''}`);
  const threeDigits = (v) => {
    const h = Math.floor(v / 100);
    const rest = v % 100;
    return `${h ? `${ones[h]} Hundred${rest ? ' ' : ''}` : ''}${rest ? twoDigits(rest) : ''}`;
  };
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `Rupees ${parts.join(' ')} Only`;
}

function blankLine() {
  return {
    key: uid('li'), itemId: '', fabric: '', quality: '', design: '',
    colour: '', width: '', gsm: '', stock: null, costPrice: null,
    qty: 1, uom: 'Meter', rate: 0, discPct: 0, gstPct: 5,
  };
}

function lineFromMaster(item) {
  return {
    key: uid('li'),
    itemId: item?.id || '',
    fabric: item?.name || '',
    quality: item?.fabricQuality || '',
    design: item?.fabricDesign || '',
    colour: item?.fabricColor || '',
    width: item?.fabricWidth != null && item?.fabricWidth !== '' ? String(item.fabricWidth) : '',
    gsm: item?.fabricGsm != null && item?.fabricGsm !== '' ? String(item.fabricGsm) : '',
    stock: item?.availableQty ?? null,
    costPrice: item?.costPrice ?? null,
    qty: 1,
    uom: item?.uom || 'Meter',
    rate: num(item?.sellingPrice),
    discPct: 0,
    gstPct: item?.taxPct ?? 5,
  };
}

function lineTotals(line) {
  const qty = num(line.qty);
  const rate = num(line.rate);
  const gross = qty * rate;
  const disc = gross * (num(line.discPct) / 100);
  const net = gross - disc;
  const gst = net * (num(line.gstPct) / 100);
  return { gross, disc, net, gst, amount: net + gst };
}

function defaultTerms(validityDays) {
  return [
    '1. This is a preliminary quotation and not a final agreement.',
    `2. Prices are valid for ${validityDays} days from the date of this quotation.`,
    '3. Subject to fabric availability at the time of confirmation.',
    '4. GST and other applicable taxes will be additional.',
    '5. Payment Terms: 30% Advance, 70% Before Dispatch.',
  ].join('\n');
}

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500';
const cellInput = 'w-full min-w-0 px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-blue-500';
const labelCls = 'block text-[11px] font-semibold text-slate-600 mb-1';
const cardCls = 'bg-white rounded-2xl border border-slate-200 p-4 sm:p-5';

/**
 * QuotationComposerPage — full Sales quotation form.
 *
 * Standalone it is the `/sales/quotations/create` page (prefill via
 * `location.state`). Embedded (`embedded={{ prefill?, editQuote?, onDone, onCancel }}`)
 * it renders the same form inside another screen — e.g. the CRM lead
 * Quotations tab — with no navigation: save calls `onDone`, cancel calls
 * `onCancel`. `editQuote` switches the form to edit mode for that row.
 */
export default function QuotationComposerPage({ embedded = null } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isEmbedded = Boolean(embedded);
  const editQuote = embedded?.editQuote || null;
  const prefill = embedded?.prefill || location.state || {};
  const { customers = [], items = [], addQuotation, updateQuotation, convertQuotationToSalesOrder, showToast } = useERP() || {};
  const teamMembers = useCrmStore((s) => s.teamMembers);
  const salesTeam = withSampleTeam(teamMembers);

  const initQuoteDate = toISODate(editQuote?.date) || todayISO();
  const initValidityDays = Number(editQuote?.validityDays) || 30;
  const initialCustomerId = editQuote?.customerId
    || prefill.customerId
    || customers.find((c) => prefill.company && c.name === prefill.company)?.id
    || customers[0]?.id || '';
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const customer = customers.find((c) => c.id === customerId) || null;

  const [contactPerson, setContactPerson] = useState(editQuote?.contactPerson ?? customer?.contactPerson ?? '');
  const [quoteDate, setQuoteDate] = useState(initQuoteDate);
  const [validityDays, setValidityDays] = useState(initValidityDays);
  const [validUntil, setValidUntil] = useState(() => toISODate(editQuote?.validUntil) || addDaysISO(initQuoteDate, initValidityDays));
  const [salesPerson, setSalesPerson] = useState(editQuote?.salesPerson ?? '');
  const [broker, setBroker] = useState(editQuote?.broker ?? '');
  const [dealRef, setDealRef] = useState(editQuote?.dealReference || editQuote?.dealId || prefill.dealReference || prefill.dealId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const [lines, setLines] = useState(() => {
    // Edit mode restores the row's own lines (discount/tax/uom preserved);
    // create mode resolves names against the item master for full specs.
    if (editQuote && Array.isArray(editQuote.items) && editQuote.items.length > 0) {
      return editQuote.items.map((it) => ({
        ...blankLine(),
        key: uid('li'),
        itemId: isServerId(it.itemId) ? it.itemId : '',
        fabric: it.itemName || it.name || it.description || '',
        qty: Number(it.qty ?? it.quantity) || 1,
        uom: it.uom || it.unit || 'Meter',
        rate: Number(it.rate ?? it.price) || 0,
        discPct: Number(it.discount) || 0,
        gstPct: it.tax ?? it.gstPct ?? 5,
      }));
    }
    const seed = Array.isArray(prefill.items) ? prefill.items : [];
    if (seed.length > 0) {
      return seed.map((entry) => {
        const master = (items || []).find((it) => String(it?.name || '').trim().toLowerCase() === String(entry.name || entry.description || '').trim().toLowerCase());
        if (master) {
          const row = lineFromMaster(master);
          if (entry.qty) row.qty = Number(entry.qty) || 1;
          if (entry.rate) row.rate = Number(entry.rate) || row.rate;
          return row;
        }
        return { ...blankLine(), fabric: entry.name || entry.description || '', qty: Number(entry.qty) || 1, rate: Number(entry.rate) || 0 };
      });
    }
    return [blankLine(), blankLine(), blankLine()];
  });
  const [itemSearch, setItemSearch] = useState('');
  const [docDiscPct, setDocDiscPct] = useState(0);
  const [freightType, setFreightType] = useState(editQuote && num(editQuote.freightCharges) > 0 ? 'Paid' : 'To Pay');
  const [freightAmount, setFreightAmount] = useState(num(editQuote?.freightCharges));
  const [loading, setLoading] = useState(num(editQuote?.loadingCharges));
  const [otherCharges, setOtherCharges] = useState(num(editQuote?.otherCharges));
  const [termsText, setTermsText] = useState(editQuote?.terms || editQuote?.termsAndConditions || defaultTerms(initValidityDays));
  const [paymentTerms, setPaymentTerms] = useState(editQuote?.paymentTerms || PAYMENT_TERMS[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => toISODate(editQuote?.deliveryDate) || addDaysISO(initQuoteDate, 12));
  const [withTax, setWithTax] = useState(true);
  const [approvalStep, setApprovalStep] = useState(0);
  const [saveAsDraftChecked, setSaveAsDraftChecked] = useState(false);
  const [formError, setFormError] = useState('');
  // Inline (embedded) save state: guards double-click duplicates and tracks
  // a create that is still waiting for the server so a retry updates it.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(() => editQuote?.id || null);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return (customers || []).filter((c) => (
      String(c?.name || '').toLowerCase().includes(q) ||
      String(c?.code || '').toLowerCase().includes(q) ||
      String(c?.phone || '').toLowerCase().includes(q)
    ));
  }, [customers, customerSearch]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((it) => (
      String(it?.name || '').toLowerCase().includes(q) ||
      String(it?.sku || '').toLowerCase().includes(q) ||
      String(it?.fabricQuality || '').toLowerCase().includes(q) ||
      String(it?.fabricColor || '').toLowerCase().includes(q)
    ));
  }, [items, itemSearch]);

  const totals = useMemo(() => {
    let subtotal = 0; let lineDisc = 0; let lineNet = 0; let lineGst = 0;
    let totalQty = 0; let costSum = 0; let costLines = 0;
    lines.forEach((line) => {
      const t = lineTotals(line);
      subtotal += t.gross; lineDisc += t.disc; lineNet += t.net; lineGst += t.gst;
      totalQty += num(line.qty);
      if (line.costPrice != null && line.costPrice !== '') {
        costSum += num(line.qty) * num(line.costPrice);
        costLines += 1;
      }
    });
    const docDisc = subtotal * (num(docDiscPct) / 100);
    const netBase = Math.max(0, lineNet - docDisc);
    const factor = lineNet > 0 ? netBase / lineNet : 0;
    const gstTotal = lineGst * factor;
    const freightNum = freightType === 'To Pay' ? 0 : num(freightAmount);
    const loadingNum = num(loading);
    const otherNum = num(otherCharges);
    const taxable = netBase + freightNum + loadingNum + otherNum;
    const grand = withTax ? taxable + gstTotal : taxable;
    const hasCost = costLines > 0;
    const profit = hasCost ? grand - costSum : null;
    const marginPct = hasCost ? (grand > 0 ? (profit / grand) * 100 : 0) : null;
    return {
      items: lines.length, totalQty, subtotal, docDisc, freight: freightNum,
      loading: loadingNum, other: otherNum, taxable, gstTotal, grand,
      hasCost, costSum, profit, marginPct,
    };
  }, [lines, docDiscPct, freightType, freightAmount, loading, otherCharges, withTax]);

  const creditLimit = num(customer?.creditLimit);
  const outstanding = num(customer?.balance ?? customer?.outstanding);
  const available = creditLimit - outstanding;

  // Unsaved-changes detection for embedded Cancel (random row `key`
  // excluded — it differs per mount, not per edit).
  function formSignature() {
    return JSON.stringify({
      customerId, contactPerson, salesPerson, broker, quoteDate, validUntil,
      validityDays, dealRef, docDiscPct, freightType, freightAmount, loading,
      otherCharges, termsText, paymentTerms, deliveryDate, withTax,
      lines: (lines || []).map(({ key, ...rest }) => rest),
    });
  }
  const initialSignatureRef = useRef(null);
  if (initialSignatureRef.current === null) initialSignatureRef.current = formSignature();
  const isDirty = () => formSignature() !== initialSignatureRef.current;

  function handleCustomerChange(id) {
    setCustomerId(id);
    const next = customers.find((c) => c.id === id);
    setContactPerson(next?.contactPerson || '');
    setCustomerPickerOpen(false);
    setCustomerSearch('');
  }

  function handleQuoteDateChange(value) {
    setQuoteDate(value);
    setValidUntil(addDaysISO(value, validityDays));
  }

  function handleValidityChange(days) {
    const n = Number(days) || 0;
    setValidityDays(n);
    setValidUntil(addDaysISO(quoteDate, n));
    setTermsText((prev) => prev.replace(/valid for \d+ days/, `valid for ${n} days`));
  }

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleItemPick(key, itemId) {
    if (!itemId) {
      updateLine(key, { ...blankLine(), key });
      return;
    }
    const master = (items || []).find((it) => String(it.id) === String(itemId));
    if (!master) return;
    setLines((prev) => prev.map((line) => {
      if (line.key !== key) return line;
      const filled = lineFromMaster(master);
      return { ...filled, key, qty: num(line.qty) || 1, discPct: num(line.discPct), gstPct: master?.taxPct ?? num(line.gstPct) };
    }));
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  function buildPayload(status) {
    return {
      customerId: customer?.id || '',
      customer: customer?.name || 'Acme Corp',
      contactPerson: contactPerson.trim(),
      salesPerson,
      broker: broker.trim(),
      date: quoteDate,
      validUntil,
      validityDays,
      dealId: prefill.dealId || '',
      dealReference: dealRef.trim(),
      leadId: prefill.leadId ? String(prefill.leadId) : '',
      leadName: prefill.leadName || '',
      amount: Math.round(totals.grand * 100) / 100,
      status,
      discountTotal: Math.round(totals.docDisc * 100) / 100,
      freightCharges: totals.freight,
      otherCharges: totals.other + totals.loading,
      loadingCharges: totals.loading,
      terms: termsText.trim(),
      paymentTerms,
      deliveryDate,
      notes: `Quotation for ${customer?.name || 'customer'}`,
      items: lines.map((line, index) => ({
        ...(isServerId(line.itemId) ? { itemId: line.itemId } : {}),
        itemName: line.fabric || `Item ${index + 1}`,
        description: [line.quality, line.design, line.colour, line.width ? `${line.width}"` : '', line.gsm ? `${line.gsm} GSM` : ''].filter(Boolean).join(' / ') || line.fabric,
        uom: line.uom,
        qty: num(line.qty),
        rate: num(line.rate),
        discount: num(line.discPct),
        tax: withTax ? num(line.gstPct) : 0,
        amount: Math.round(lineTotals(line).amount * 100) / 100,
      })),
    };
  }

  function validate() {
    if (!customer) return 'Select a customer account.';
    if (!isServerId(customer.id)) return 'This customer is still being saved to the server. Please wait a moment and try again.';
    if (lines.length === 0) return 'Add at least one item.';
    if (!lines.some((line) => line.fabric && num(line.qty) > 0)) return 'Add at least one item with a name and quantity.';
    return '';
  }

  function handleSave(status, { stay = false } = {}) {
    if (savingRef.current) return null;
    const error = validate();
    if (error) {
      setFormError(error);
      return null;
    }
    setFormError('');
    // Embedded (lead tab): same form, same validation — but no navigation.
    // The parent swaps the tab content back to the list via onDone.
    if (isEmbedded) {
      void embeddedSave(status);
      return null;
    }
    // The server allocates the real id + number on save and the local row is
    // reconciled to it — navigating to the temp id would land on
    // "no longer exists" once that swap happens. So: temp id → list now,
    // server id → detail when the save confirms.
    const saved = addQuotation(buildPayload(status), {
      onServer: (serverRecord) => {
        if (!stay && serverRecord?.id) navigate(`/sales/quotations/${serverRecord.id}`, { replace: true });
      },
    });
    if (!stay) {
      if (isBackendEnabled() && saved?.id && !isServerId(saved.id)) {
        navigate('/sales/quotations');
      } else {
        navigate(saved?.id ? `/sales/quotations/${saved.id}` : '/sales/quotations');
      }
    }
    return saved;
  }

  // Embedded save: create (or finish a pending create / edit) without
  // leaving the page. Awaiting the server means the success toast and the
  // return to the list only happen after the save succeeds, and the saving
  // flag blocks duplicate submits from repeated clicks.
  async function embeddedSave(status) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError('');
    const finish = () => {
      savingRef.current = false;
      setSaving(false);
    };
    try {
      if (editQuote || pendingId) {
        const id = editQuote ? editQuote.id : pendingId;
        const keepStatus = editQuote ? editQuote.status : status;
        const updated = await updateQuotation(id, buildPayload(keepStatus));
        const number = updated?.quoteNumber || updated?.quotationNumber || editQuote?.quoteNumber || '';
        showToast?.(`Quotation ${number} updated.`);
        finish();
        embedded.onDone(updated || null);
      } else {
        let resolved = false;
        const saved = addQuotation(buildPayload(status), {
          silent: true,
          onServer: (serverRecord) => {
            resolved = true;
            const number = serverRecord?.quoteNumber || serverRecord?.quotationNumber || saved?.quoteNumber || '';
            showToast?.(`Quotation ${number} generated.`);
            finish();
            embedded.onDone(serverRecord || null);
          },
          onError: (err) => {
            resolved = true;
            // Keep the failed optimistic row and retry against it, so a
            // retry updates instead of creating a duplicate.
            setPendingId(saved.id);
            setFormError(err?.message || 'Could not save the quotation to the server.');
            finish();
          },
        });
        if (!resolved) setPendingId(saved.id);
      }
    } catch (err) {
      setFormError(err?.message || 'Could not save the quotation.');
      finish();
    }
  }

  function embeddedCancel() {
    if (isDirty() && !window.confirm('Discard unsaved changes?')) return;
    embedded.onCancel();
  }

  function handleConvert() {
    const saved = handleSave('Draft', { stay: true });
    if (!saved) return;
    setApprovalStep(4);
    const order = convertQuotationToSalesOrder?.(saved.id);
    if (order) navigate('/sales/orders');
  }

  return (
    <div className="space-y-4">
      {!isEmbedded && (
        <>
          <p className="text-[11px] font-medium text-slate-400">
            Sales <span className="mx-1">›</span> Quotations <span className="mx-1">›</span>{' '}
            <span className="text-slate-600 font-semibold">{editQuote ? 'Edit Quotation' : 'Create Quotation'}</span>
          </p>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText size={16} /></span>
                Create Quotation
              </h1>
              <p className="text-xs text-slate-500 mt-1">Prepare a detailed quotation with fabric specifications, pricing and terms.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/sales/quotations')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Back to Quotations
            </button>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600"><User size={13} /></span>
              Customer &amp; Quote Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <label className={labelCls}>Customer Account *</label>
                <div className="relative">
                  <input
                    value={customer ? `${customer.name}${customer.code ? ` (${customer.code})` : ''}` : customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerPickerOpen(true); if (!e.target.value) handleCustomerChange(''); }}
                    onFocus={() => setCustomerPickerOpen(true)}
                    placeholder="Search customer…"
                    className="w-full pl-2.5 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {customerPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCustomerPickerOpen(false)} />
                    <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCustomerChange(c.id)}
                          className="block w-full px-3 py-2 text-left text-xs hover:bg-blue-50"
                        >
                          <span className="block font-bold text-slate-800">{c.name}{c.code ? ` (${c.code})` : ''}</span>
                          <span className="block text-[11px] text-slate-500">{c.phone || ''}{c.email ? ` • ${c.email}` : ''}</span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No customers found.</p>}
                    </div>
                  </>
                )}
                {customer && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold shrink-0">
                      {String(customer.name || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="text-[11px] leading-relaxed">
                      <p className="font-bold text-slate-800">{customer.name}</p>
                      <p className="text-slate-500">Credit Limit: ₹{creditLimit.toLocaleString('en-IN')} • Outstanding: ₹{outstanding.toLocaleString('en-IN')}</p>
                      <p className="text-slate-500">Available: ₹{available.toLocaleString('en-IN')}</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Existing Customer</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Contact Person</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Purchase Manager" className={inputCls} />
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <p>✆ {customer?.phone || '—'}</p>
                  <p>✉ {customer?.email || '—'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Quotation Date *</label>
                  <input type="date" value={quoteDate} onChange={(e) => handleQuoteDateChange(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Valid Until *</label>
                    <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Validity</label>
                    <select value={validityDays} onChange={(e) => handleValidityChange(e.target.value)} className={inputCls}>
                      {VALIDITIES.map((d) => (<option key={d} value={d}>{d} Days</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className={labelCls}>Sales Person</label>
                <select value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)} className={inputCls}>
                  <option value="">Select</option>
                  {salesTeam.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Broker (Optional)</label>
                <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Select Broker" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Deal / Lead Reference</label>
                <input value={dealRef} onChange={(e) => setDealRef(e.target.value)} placeholder="LEAD-0008" className={inputCls} />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Package size={13} /></span>
                  Fabric / Item Details
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Add fabric items with specifications, quantity and pricing.</p>
              </div>
              <button type="button" onClick={() => setLines((prev) => [...prev, blankLine()])} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left text-xs border-collapse min-w-[1240px]">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 w-8">#</th>
                    <th className="py-2 pr-2 min-w-[140px]">Fabric / Item</th>
                    <th className="py-2 pr-2 min-w-[80px]">Quality</th>
                    <th className="py-2 pr-2 min-w-[80px]">Design</th>
                    <th className="py-2 pr-2 min-w-[70px]">Colour</th>
                    <th className="py-2 pr-2 w-[60px]">Width</th>
                    <th className="py-2 pr-2 w-[60px]">GSM</th>
                    <th className="py-2 pr-2 w-[80px]">Stock</th>
                    <th className="py-2 pr-2 w-[64px]">Qty *</th>
                    <th className="py-2 pr-2 w-[76px]">UOM</th>
                    <th className="py-2 pr-2 w-[76px]">Rate (₹)</th>
                    <th className="py-2 pr-2 w-[60px]">Disc. %</th>
                    <th className="py-2 pr-2 w-[60px]">GST %</th>
                    <th className="py-2 pr-2 w-[96px] text-right">Amount (₹)</th>
                    <th className="py-2 w-[76px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => {
                    const t = lineTotals(line);
                    return (
                      <tr key={line.key}>
                        <td className="py-1.5 pr-2 text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 pr-2">
                          <select value={line.itemId} onChange={(e) => handleItemPick(line.key, e.target.value)} className={cellInput} title={line.fabric}>
                            <option value="">{line.fabric || 'Select item…'}</option>
                            {filteredItems.map((it) => (<option key={it.id} value={it.id}>{it.name}</option>))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2"><input value={line.quality} onChange={(e) => updateLine(line.key, { quality: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2"><input value={line.design} onChange={(e) => updateLine(line.key, { design: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2"><input value={line.colour} onChange={(e) => updateLine(line.key, { colour: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2"><input value={line.width} onChange={(e) => updateLine(line.key, { width: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2"><input value={line.gsm} onChange={(e) => updateLine(line.key, { gsm: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${line.stock != null && num(line.stock) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {line.stock != null && line.stock !== '' ? `${num(line.stock).toLocaleString('en-IN')} M` : '—'}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2"><input type="number" min="0" step="any" value={line.qty} onChange={(e) => updateLine(line.key, { qty: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2">
                          <select value={line.uom} onChange={(e) => updateLine(line.key, { uom: e.target.value })} className={cellInput}>
                            {UOMS.map((u) => (<option key={u} value={u}>{u}</option>))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2"><input type="number" min="0" step="any" value={line.rate} onChange={(e) => updateLine(line.key, { rate: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2"><input type="number" min="0" max="100" step="any" value={line.discPct} onChange={(e) => updateLine(line.key, { discPct: e.target.value })} className={cellInput} /></td>
                        <td className="py-1.5 pr-2">
                          <select value={line.gstPct} onChange={(e) => updateLine(line.key, { gstPct: e.target.value })} className={cellInput}>
                            {GST_RATES.map((g) => (<option key={g} value={g}>{g}</option>))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono font-bold text-slate-900">{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-1.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button type="button" title="Pick Stock" onClick={() => setItemSearch(line.fabric || '')} className="px-1.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md">
                              Pick Stock
                            </button>
                            <button type="button" onClick={() => removeLine(line.key)} title="Remove line" className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 max-w-xs">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search fabric / item…" className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText size={13} /></span>
              Price &amp; Commercial Details
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">Configure additional charges, discount, freight and other commercial terms.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Global Discount (%)</label>
                  <input type="number" min="0" max="100" step="any" value={docDiscPct} onChange={(e) => setDocDiscPct(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Freight Charges</label>
                  <select value={freightType} onChange={(e) => setFreightType(e.target.value)} className={inputCls}>
                    <option>To Pay</option>
                    <option>Paid</option>
                    <option>Included</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Freight Amount (₹)</label>
                  <input type="number" min="0" step="any" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value)} disabled={freightType !== 'Paid'} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
                </div>
                <div>
                  <label className={labelCls}>Loading &amp; Unloading (₹)</label>
                  <input type="number" min="0" step="any" value={loading} onChange={(e) => setLoading(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Other Charges (₹)</label>
                  <input type="number" min="0" step="any" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs font-bold text-slate-800 mb-2">Credit Information</p>
                <dl className="text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600"><dt>Credit Limit</dt><dd className="font-mono font-bold text-slate-900">₹{creditLimit.toLocaleString('en-IN')}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>Outstanding</dt><dd className="font-mono font-bold text-slate-900">₹{outstanding.toLocaleString('en-IN')}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>Available Credit</dt><dd className="font-mono font-bold text-emerald-700">₹{available.toLocaleString('en-IN')}</dd></div>
                </dl>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText size={13} /></span>
              Terms &amp; Conditions
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">Add remarks, validity, payment and delivery terms.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <textarea value={termsText} onChange={(e) => setTermsText(e.target.value.slice(0, 1500))} rows={6} className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-blue-500" />
                <p className="text-[11px] text-slate-400 mt-1">{termsText.length}/1500</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Payment Terms</label>
                  <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls}>
                    {PAYMENT_TERMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Expected Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600"><FileText size={13} /></span>
                Quotation Summary
              </h3>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={withTax}
                  onClick={() => setWithTax((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition ${withTax ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${withTax ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                With Tax
              </label>
            </div>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600"><dt>Total Items</dt><dd className="font-bold text-slate-900">{totals.items}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Total Quantity</dt><dd className="font-bold text-slate-900">{totals.totalQty.toLocaleString('en-IN')} M</dd></div>
              <div className="border-t border-slate-100 my-2" />
              <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-mono font-semibold">{inr(totals.subtotal)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Global Discount ({num(docDiscPct)}%)</dt><dd className="font-mono font-semibold">− {inr(totals.docDisc)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Freight Charges</dt><dd className="font-mono font-semibold">{inr(totals.freight)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Loading &amp; Unloading</dt><dd className="font-mono font-semibold">{inr(totals.loading)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Other Charges</dt><dd className="font-mono font-semibold">{inr(totals.other)}</dd></div>
              <div className="border-t border-slate-100 my-2" />
              <div className="flex justify-between text-slate-600"><dt>Taxable Amount</dt><dd className="font-mono font-semibold">{inr(totals.taxable)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>GST ({withTax ? '5%' : 'excluded'})</dt><dd className="font-mono font-semibold">{inr(withTax ? totals.gstTotal : 0)}</dd></div>
              <div className="border-t border-slate-200 my-2" />
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <dt className="font-bold text-slate-900">Grand Total</dt>
                <dd className="font-mono font-extrabold text-emerald-700 text-sm">{inr(totals.grand)}</dd>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">Amount in words:<br /><span className="font-semibold text-slate-700">{amountInWords(totals.grand)}</span></p>
            </dl>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-violet-50 text-violet-600">◉</span>
              Estimated Margin
            </h3>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600"><dt>Total Cost (Est.)</dt><dd className="font-mono font-semibold">{totals.hasCost ? inr(totals.costSum) : '—'}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Estimated Profit</dt><dd className="font-mono font-semibold">{totals.hasCost ? inr(totals.profit) : '—'}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Margin %</dt><dd className="font-mono font-semibold">{totals.hasCost ? `${totals.marginPct.toFixed(1)}%` : '—'}</dd></div>
            </dl>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-600">◉</span>
              Approval &amp; Status
            </h3>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">Status</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">{APPROVAL_STEPS[approvalStep]}</span>
            </div>
            <div className="flex items-center mt-1" aria-hidden="true">
              {APPROVAL_STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <span
                    title={step}
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${i <= approvalStep ? 'bg-blue-600' : 'bg-slate-200'}`}
                  />
                  {i < APPROVAL_STEPS.length - 1 && (
                    <span className={`h-0.5 flex-1 ${i < approvalStep ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span>Draft</span>
              <span>SO</span>
            </div>
          </div>

          {/* Quick Actions stay on the standalone page: inline (lead tab)
              saving returns to the list, and submit/send/convert belong to
              the Sales workflow (list Approve/Send stay available there). */}
          {!isEmbedded && (
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600">⚡</span>
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handleSave('Draft')} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
                <FileText size={13} /> Save as Draft
              </button>
              <button type="button" onClick={() => { const s = handleSave('Sent', { stay: true }); if (s) setApprovalStep((v) => Math.max(v, 1)); }} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
                <CheckCircle2 size={13} /> Submit for Approval
              </button>
              <button type="button" onClick={() => { const s = handleSave('Sent', { stay: true }); if (s) setApprovalStep((v) => Math.max(v, 2)); }} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
                <Send size={13} /> Send to Customer
              </button>
              <button type="button" onClick={handleConvert} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
                <RefreshCw size={13} /> Convert to Sales Order
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {formError && <p role="alert" className="text-xs font-semibold text-rose-600">{formError}</p>}

      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3 sticky bottom-2 shadow-sm">
        <button type="button" onClick={() => (isEmbedded ? embeddedCancel() : navigate('/sales/quotations'))} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
        <div className="flex items-center gap-3">
          {!editQuote && (
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={saveAsDraftChecked} onChange={(e) => setSaveAsDraftChecked(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Save as Draft
          </label>
          )}
          {editQuote ? (
          <button type="button" disabled={saving} onClick={() => handleSave(editQuote.status)} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-60">
            <FileText size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
          ) : (
          <button type="button" disabled={saving} onClick={() => handleSave(saveAsDraftChecked ? 'Draft' : 'Sent')} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-60">
            <FileText size={14} /> {saving ? 'Saving…' : 'Generate Quotation'}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
