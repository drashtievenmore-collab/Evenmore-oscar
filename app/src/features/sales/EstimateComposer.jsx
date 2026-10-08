import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Plus, Trash2, Search, Package, FileText,
  Send, RefreshCw, X, Upload,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { addEstimate, updateEstimate } from '../../services/estimateStore';
import { isServerId } from '../../services/resourceSync';

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

function defaultTerms(validityDays) {
  return [
    '1. This is a preliminary estimate and not a final quotation.',
    `2. Prices are valid for ${validityDays} days from the date of this estimate.`,
    '3. Subject to fabric availability at the time of confirmation.',
    '4. GST and other applicable taxes will be additional.',
    '5. Payment Terms: 30% Advance, 70% Before Dispatch.',
  ].join('\n');
}

function blankLine() {
  return {
    key: uid('li'),
    itemId: '',
    fabric: '',
    quality: '',
    colour: '',
    width: '',
    gsm: '',
    stock: null,
    qty: 1,
    uom: 'Meter',
    rate: 0,
    discPct: 0,
    gstPct: 5,
  };
}

function lineFromMaster(item) {
  return {
    key: uid('li'),
    itemId: item?.id || '',
    fabric: item?.name || '',
    quality: item?.fabricQuality || '',
    colour: item?.fabricColor || '',
    width: item?.fabricWidth != null && item?.fabricWidth !== '' ? String(item.fabricWidth) : '',
    gsm: item?.fabricGsm != null && item?.fabricGsm !== '' ? String(item.fabricGsm) : '',
    stock: item?.availableQty ?? null,
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

function findMasterItem(items, name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  return (items || []).find((it) => String(it?.name || '').trim().toLowerCase() === target) || null;
}

export default function EstimateComposer({
  initialCustomerId = '',
  initialLines = [],
  editingEstimate = null,
  leadId = '',
  leadName = '',
  company = '',
  onBack,
  onSaved,
  onConvert,
}) {
  const { customers = [], items = [], addCustomer } = useERP() || {};
  const fileRef = useRef(null);
  // Edit mode reuses the create form prefilled from the existing estimate —
  // no duplicate composer. The component remounts per open (composerKey), so
  // initializers below are sufficient.
  const editLines = Array.isArray(editingEstimate?.items) && editingEstimate.items.length > 0
    ? editingEstimate.items.map((it) => ({
        name: it.itemName || it.name || it.description || '',
        qty: it.qty ?? 1,
        rate: it.rate ?? 0,
      }))
    : null;
  const editCustomerId = editingEstimate
    ? editingEstimate.customerId ||
      customers.find((c) => c.name === editingEstimate.customer)?.id || ''
    : '';
  const [customerId, setCustomerId] = useState(
    initialCustomerId || editCustomerId || customers.find((c) => company && c.name === company)?.id || customers[0]?.id || '',
  );
  const customer = customers.find((c) => c.id === customerId) || customers[0] || null;
  const [contactPerson, setContactPerson] = useState(editingEstimate?.contactPerson || customer?.contactPerson || '');
  const [estimateDate, setEstimateDate] = useState(todayISO());
  const [validityDays, setValidityDays] = useState(editingEstimate?.validityDays ?? 15);
  const [validUntil, setValidUntil] = useState(
    /^\d{4}-\d{2}-\d{2}/.test(String(editingEstimate?.validUntil || ''))
      ? editingEstimate.validUntil
      : addDaysISO(todayISO(), editingEstimate?.validityDays ?? 15),
  );
  const [itemSearch, setItemSearch] = useState('');
  const [lines, setLines] = useState(() => {
    const seed = editLines || initialLines;
    if (Array.isArray(seed) && seed.length > 0) {
      return seed.map((entry) => {
        const master = findMasterItem(items, entry.name);
        if (master) {
          const row = lineFromMaster(master);
          if (entry.qty) row.qty = Number(entry.qty) || 1;
          if (entry.rate) row.rate = Number(entry.rate) || row.rate;
          return row;
        }
        return { ...blankLine(), fabric: entry.name || '', qty: Number(entry.qty) || 1, rate: Number(entry.rate) || 0 };
      });
    }
    return [blankLine()];
  });
  const [docDiscPct, setDocDiscPct] = useState(0);
  const [freight, setFreight] = useState(0);
  const [loading, setLoading] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [termsText, setTermsText] = useState(
    String(editingEstimate?.terms || '').split('\nPayment Terms:')[0] || defaultTerms(15),
  );
  const [paymentTerms, setPaymentTerms] = useState(editingEstimate?.paymentTerms || PAYMENT_TERMS[0]);
  const [saveAsDraftChecked, setSaveAsDraftChecked] = useState(true);
  const [formError, setFormError] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSelected, setPickerSelected] = useState([]);

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

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = items || [];
    if (!q) return list;
    return list.filter((it) => (
      String(it?.name || '').toLowerCase().includes(q) ||
      String(it?.sku || '').toLowerCase().includes(q)
    ));
  }, [items, pickerQuery]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDisc = 0;
    let lineNet = 0;
    let lineGst = 0;
    let totalQty = 0;
    const gstRates = new Set();
    lines.forEach((line) => {
      const t = lineTotals(line);
      subtotal += t.gross;
      lineDisc += t.disc;
      lineNet += t.net;
      lineGst += t.gst;
      totalQty += num(line.qty);
      gstRates.add(num(line.gstPct));
    });
    const docDisc = subtotal * (num(docDiscPct) / 100);
    const netBase = Math.max(0, lineNet - docDisc);
    const factor = lineNet > 0 ? netBase / lineNet : 0;
    const gstTotal = lineGst * factor;
    const freightNum = num(freight);
    const loadingNum = num(loading);
    const otherNum = num(otherCharges);
    const taxable = netBase + freightNum + loadingNum + otherNum;
    const grand = taxable + gstTotal;
    return {
      items: lines.length,
      totalQty,
      subtotal,
      docDisc,
      lineDisc,
      freight: freightNum,
      loading: loadingNum,
      other: otherNum,
      taxable,
      gstTotal,
      gstLabel: gstRates.size === 1 ? `${[...gstRates][0]}%` : 'blended',
      grand,
    };
  }, [lines, docDiscPct, freight, loading, otherCharges]);

  function handleCustomerChange(id) {
    setCustomerId(id);
    const next = customers.find((c) => c.id === id);
    setContactPerson(next?.contactPerson || '');
  }

  function handleEstimateDateChange(value) {
    setEstimateDate(value);
    setValidUntil(addDaysISO(value, validityDays));
  }

  function handleValidityChange(days) {
    const n = Number(days) || 0;
    setValidityDays(n);
    setValidUntil(addDaysISO(estimateDate, n));
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

  function addPickerLines() {
    const rows = pickerSelected
      .map((id) => (items || []).find((it) => String(it.id) === String(id)))
      .filter(Boolean)
      .map(lineFromMaster);
    if (rows.length > 0) {
      setLines((prev) => {
        const onlyBlank = prev.length === 1 && !prev[0].itemId && !prev[0].fabric && num(prev[0].rate) === 0;
        return onlyBlank ? rows : [...prev, ...rows];
      });
    }
    setPickerSelected([]);
    setPickerOpen(false);
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
      const dataRows = rows.filter((r) => !/name/i.test(r.split(',')[0] || ''));
      const parsed = dataRows.map((row) => {
        const [name = '', qty = '', rate = '', uom = ''] = row.split(',').map((c) => c.trim());
        const master = findMasterItem(items, name);
        if (master) {
          const line = lineFromMaster(master);
          if (qty) line.qty = Number(qty) || 1;
          if (rate) line.rate = Number(rate) || line.rate;
          if (uom) line.uom = uom;
          return line;
        }
        return { ...blankLine(), fabric: name, qty: Number(qty) || 1, rate: Number(rate) || 0, uom: uom || 'Meter' };
      }).filter((line) => line.fabric);
      if (parsed.length > 0) {
        setLines((prev) => {
          const onlyBlank = prev.length === 1 && !prev[0].itemId && !prev[0].fabric && num(prev[0].rate) === 0;
          return onlyBlank ? parsed : [...prev, ...parsed];
        });
      }
    };
    reader.readAsText(file);
  }

  function handleCreateCustomer(event) {
    event?.preventDefault();
    const name = newCust.name.trim();
    if (!name) return;
    const created = addCustomer?.({ name, phone: newCust.phone.trim(), email: newCust.email.trim() });
    const id = created?.id || customers.find((c) => c.name === name)?.id || '';
    if (id) handleCustomerChange(id);
    setNewCust({ name: '', phone: '', email: '' });
    setShowNewCustomer(false);
  }

  function buildPayload(status) {
    return {
      customerId: customer?.id || '',
      customer: customer?.name || 'Acme Corp',
      contactPerson: contactPerson.trim(),
      date: estimateDate,
      validUntil,
      validityDays,
      amount: Math.round(totals.grand * 100) / 100,
      status,
      leadId: leadId ? String(leadId) : (editingEstimate?.leadId || ''),
      leadName: leadName || editingEstimate?.leadName || '',
      discountTotal: Math.round(totals.docDisc * 100) / 100,
      freightCharges: num(freight),
      otherCharges: num(loading) + num(otherCharges),
      loadingCharges: num(loading),
      terms: `${termsText.trim()}\nPayment Terms: ${paymentTerms}`,
      paymentTerms,
      notes: `Estimate for ${customer?.name || leadName || company || 'customer'}`,
      items: lines.map((line, index) => ({
        ...(isServerId(line.itemId) ? { itemId: line.itemId } : {}),
        itemName: line.fabric || `Item ${index + 1}`,
        description: [line.quality, line.colour, line.width ? `${line.width}"` : '', line.gsm ? `${line.gsm} GSM` : ''].filter(Boolean).join(' / ') || line.fabric,
        uom: line.uom,
        qty: num(line.qty),
        rate: num(line.rate),
        discount: num(line.discPct),
        tax: num(line.gstPct),
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

  function handleSave(status) {
    const error = validate();
    if (error) {
      setFormError(error);
      return null;
    }
    setFormError('');
    if (editingEstimate?.id) {
      const payload = buildPayload(editingEstimate.status || status);
      updateEstimate(editingEstimate.id, payload);
      const saved = { ...editingEstimate, ...payload };
      onSaved?.(saved, payload.status);
      return saved;
    }
    const saved = addEstimate(buildPayload(status));
    onSaved?.(saved, status);
    return saved;
  }

  function handleConvert() {
    const saved = handleSave('Draft');
    if (saved) onConvert?.(saved);
  }

  const inputCls = 'w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500';
  const cellInput = 'w-full min-w-0 px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText size={16} /></span>
            {editingEstimate ? `Edit Sales Estimate ${editingEstimate.estimateNumber || ''}`.trim() : 'Create Sales Estimate'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Prepare a preliminary estimate for your customer and share for approval.</p>
        </div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <ArrowLeft size={14} /> Back to Estimates
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs">◉</span>
                Customer Information
              </h3>
              <button type="button" onClick={() => setShowNewCustomer((v) => !v)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200">
                <Plus size={13} /> New Customer
              </button>
            </div>
            {showNewCustomer && (
              <form onSubmit={handleCreateCustomer} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Customer name *" required className={inputCls} />
                <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="Phone" className={inputCls} />
                <input value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="Email" className={inputCls} />
                <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">Add</button>
              </form>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Account *</label>
                <select value={customer?.id || ''} onChange={(e) => handleCustomerChange(e.target.value)} className={inputCls}>
                  {(customers || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                  ))}
                </select>
                {customer && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold shrink-0">
                      {String(customer.name || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="text-[11px] leading-relaxed">
                      <p className="font-bold text-slate-800">{customer.name}</p>
                      <p className="text-slate-500">Credit Limit: ₹{num(customer.creditLimit).toLocaleString('en-IN')} • Outstanding: ₹{num(customer.balance).toLocaleString('en-IN')}</p>
                      <p className="text-slate-500">Payment Terms: {customer.paymentTerms || 'Net 30'}</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact name" className={inputCls} />
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <p>✆ {customer?.phone || '—'}</p>
                  <p>✉ {customer?.email || '—'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estimate Date *</label>
                  <input type="date" value={estimateDate} onChange={(e) => handleEstimateDateChange(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Valid Until *</label>
                    <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Validity</label>
                    <select value={validityDays} onChange={(e) => handleValidityChange(e.target.value)} className={inputCls}>
                      {VALIDITIES.map((d) => (<option key={d} value={d}>{d} Days</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs">◉</span>
                Fabric / Item Details
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search fabric / item…" className="pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-44 focus:outline-none focus:border-blue-500" />
                </div>
                <button type="button" onClick={() => { setPickerQuery(''); setPickerSelected([]); setPickerOpen(true); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">
                  <Package size={13} /> Stock Picker
                </button>
                <button type="button" onClick={() => setLines((prev) => [...prev, blankLine()])} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                  <Plus size={13} /> Add Item
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Add fabric items with specifications, quantity and pricing.</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left text-xs border-collapse min-w-[1080px]">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 w-8">#</th>
                    <th className="py-2 pr-2 min-w-[150px]">Fabric / Item</th>
                    <th className="py-2 pr-2 min-w-[90px]">Quality</th>
                    <th className="py-2 pr-2 min-w-[80px]">Colour</th>
                    <th className="py-2 pr-2 w-[70px]">Width</th>
                    <th className="py-2 pr-2 w-[70px]">GSM</th>
                    <th className="py-2 pr-2 w-[90px]">Available Stock</th>
                    <th className="py-2 pr-2 w-[70px]">Qty</th>
                    <th className="py-2 pr-2 w-[80px]">UOM</th>
                    <th className="py-2 pr-2 w-[80px]">Rate (₹)</th>
                    <th className="py-2 pr-2 w-[64px]">Disc. %</th>
                    <th className="py-2 pr-2 w-[64px]">GST %</th>
                    <th className="py-2 pr-2 w-[100px] text-right">Amount (₹)</th>
                    <th className="py-2 w-[40px] text-center">Action</th>
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
                            {filteredItems.map((it) => (
                              <option key={it.id} value={it.id}>{it.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2"><input value={line.quality} onChange={(e) => updateLine(line.key, { quality: e.target.value })} className={cellInput} /></td>
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
                          <button type="button" onClick={() => removeLine(line.key)} title="Remove line" className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={() => setLines((prev) => [...prev, blankLine()])} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-blue-700 text-xs font-semibold hover:bg-blue-50 rounded-lg">
                <Plus size={13} /> Add Item
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 text-xs font-semibold hover:bg-slate-100 rounded-lg">
                <Upload size={13} /> Import Items
              </button>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs">◉</span>
              Terms &amp; Conditions
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">Add remarks, validity and payment terms.</p>
            <textarea value={termsText} onChange={(e) => setTermsText(e.target.value.slice(0, 1500))} rows={5} className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-blue-500" />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <span className="text-[11px] text-slate-400">{termsText.length}/1500</span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs max-w-[240px]">
                  {PAYMENT_TERMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600"><FileText size={13} /></span>
              Estimate Summary
            </h3>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600"><dt>Total Items</dt><dd className="font-bold text-slate-900">{totals.items}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Total Quantity</dt><dd className="font-bold text-slate-900">{totals.totalQty.toLocaleString('en-IN')} M</dd></div>
              <div className="border-t border-slate-100 my-2" />
              <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-mono font-semibold">{inr(totals.subtotal)}</dd></div>
              <div className="flex justify-between items-center text-slate-600">
                <dt>Discount <input type="number" min="0" max="100" step="any" value={docDiscPct} onChange={(e) => setDocDiscPct(e.target.value)} className="w-14 mx-1 px-1 py-0.5 border border-slate-300 rounded text-xs text-right" />%</dt>
                <dd className="font-mono font-semibold">− {inr(totals.docDisc)}</dd>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <dt>Freight Charges</dt>
                <dd><input type="number" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-xs text-right font-mono" /></dd>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <dt>Loading &amp; Unloading</dt>
                <dd><input type="number" min="0" step="any" value={loading} onChange={(e) => setLoading(e.target.value)} className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-xs text-right font-mono" /></dd>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <dt>Other Charges</dt>
                <dd><input type="number" min="0" step="any" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-xs text-right font-mono" /></dd>
              </div>
              <div className="flex justify-between text-slate-600"><dt>Taxable Amount</dt><dd className="font-mono font-semibold">{inr(totals.taxable)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>GST ({totals.gstLabel})</dt><dd className="font-mono font-semibold">{inr(totals.gstTotal)}</dd></div>
              <div className="border-t border-slate-200 my-2" />
              <div className="flex justify-between items-center">
                <dt className="font-bold text-slate-900">Grand Total</dt>
                <dd className="font-mono font-bold text-slate-900 text-sm">{inr(totals.grand)}</dd>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">Amount in words:<br /><span className="font-semibold text-slate-700">{amountInWords(totals.grand)}</span></p>
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600"><Send size={13} /></span>
              Estimate Actions
            </h3>
            <div className="space-y-2">
              <button type="button" onClick={() => handleSave('Draft')} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
                <FileText size={14} /> Save as Draft
              </button>
              <button type="button" onClick={() => handleSave('Sent')} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl">
                <Send size={14} /> Save &amp; Send
              </button>
              <button type="button" onClick={handleConvert} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl">
                <RefreshCw size={14} /> Convert to Quotation
              </button>
            </div>
          </div>
        </div>
      </div>

      {formError && <p role="alert" className="text-xs font-semibold text-rose-600">{formError}</p>}

      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3">
        <button type="button" onClick={onBack} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={saveAsDraftChecked} onChange={(e) => setSaveAsDraftChecked(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Save as Draft
          </label>
          <button type="button" onClick={() => handleSave(saveAsDraftChecked ? 'Draft' : 'Sent')} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">
            <FileText size={14} /> {editingEstimate ? 'Save Changes' : 'Generate Estimate'}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={() => setPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Stock Picker</h2>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search items…" className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-2 flex-1">
              {pickerItems.map((it) => (
                <label key={it.id} className="flex items-center gap-3 py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={pickerSelected.includes(it.id)}
                    onChange={(e) => setPickerSelected((prev) => (e.target.checked ? [...prev, it.id] : prev.filter((id) => id !== it.id)))}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-800 truncate">{it.name}</span>
                    <span className="block text-[11px] text-slate-500">{[it.fabricQuality, it.fabricColor].filter(Boolean).join(' / ') || it.sku || ''}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-600">Stock: {it.availableQty ?? '—'}</span>
                  <span className="text-[11px] font-mono font-bold text-slate-800 w-20 text-right">₹{num(it.sellingPrice).toLocaleString('en-IN')}</span>
                </label>
              ))}
              {pickerItems.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No items found.</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
              <button type="button" onClick={() => setPickerOpen(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
              <button type="button" onClick={addPickerLines} disabled={pickerSelected.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg">Add {pickerSelected.length > 0 ? `${pickerSelected.length} ` : ''}Selected</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
