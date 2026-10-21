import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  DollarSign,
  Receipt,
  FileCheck,
  Check,
  Award,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function SupplierPaymentInlineSlide({ po, onClose, onPaymentSaved, onPrevStep }) {
  const {
    formatCurrency,
    formatDateDDMMYYYY,
    getPoBilledStatus,
    getBillOutstanding,
    paymentOuts = [],
    purchaseBills = [],
    bankAccounts = [],
    addPaymentOut,
    showToast,
    refreshCollections,
  } = useERP() || {};

  const [submitting, setSubmitting] = useState(false);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState('Bank Transfer');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;

  const poInfo = getPoBilledStatus ? getPoBilledStatus(poId) : { activeBills: [] };
  const linkedBill = poInfo.activeBills?.[0] || purchaseBills.find((b) => b.purchaseOrderId === poId || b.poNumber === poNumber);

  const billTotal = Number(linkedBill?.total || linkedBill?.amount || po?.amount || 0);

  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      const primaryBank = bankAccounts.find((b) => b.isPrimary || b.isDefault) || bankAccounts[0];
      if (primaryBank) setBankAccountId(String(primaryBank.id));
    }
  }, [bankAccounts, bankAccountId]);

  const relatedPayments = useMemo(() => {
    return paymentOuts.filter(
      (p) =>
        (linkedBill && (p.billId === linkedBill.id || p.billNumber === linkedBill.billNumber)) ||
        p.poNumber === poNumber ||
        p.notes?.includes(poNumber)
    );
  }, [paymentOuts, linkedBill, poNumber]);

  const totalPaid = relatedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balanceDue = Math.max(0, billTotal - totalPaid);
  const [payAmount, setPayAmount] = useState(balanceDue || billTotal);

  useEffect(() => {
    if (balanceDue > 0) {
      setPayAmount(balanceDue);
    }
  }, [balanceDue]);

  const isFullySettled = totalPaid >= billTotal && billTotal > 0;

  const handleRecordPayment = async (e) => {
    e?.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      setErrorMsg('Enter a valid disbursement payment amount.');
      return;
    }

    const resolvedBankId = payMode !== 'Cash' ? (bankAccountId || bankAccounts[0]?.id) : undefined;
    if (payMode !== 'Cash' && !resolvedBankId) {
      setErrorMsg('Choose the bank account this payment was made from.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const paymentPayload = {
        vendorId: po?.vendorId || linkedBill?.vendorId,
        billId: linkedBill?.id,
        amount: Number(payAmount),
        date: payDate,
        mode: payMode,
        bankAccountId: resolvedBankId,
        reference: reference || `UTR-${Date.now().toString().slice(-6)}`,
        notes: `Payment disbursement against PO ${poNumber}${remarks ? ` - ${remarks}` : ''}`,
      };

      if (addPaymentOut) {
        await addPaymentOut(paymentPayload);
      } else {
        await api.post('/purchase/payments/', paymentPayload);
      }

      setSuccessMsg(`✓ Disbursement Payment of ₹${numIN(payAmount)} successfully recorded!`);
      if (showToast) showToast('Payment Out Voucher created. Supplier account settled.', 'success');
      if (refreshCollections) refreshCollections(['purchaseOrders', 'purchaseBills', 'paymentOuts']);
      if (onPaymentSaved) onPaymentSaved();
    } catch (err) {
      console.error('Failed to record payment:', err);
      setErrorMsg(err?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Stage 9 Slide (Final Stage)
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Disbursement Payment & Accounts Payable Settlement
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Issue payment voucher to vendor against approved 3-way matched bill and conclude procurement lifecycle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Settlement KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Bill Total</span>
          <p className="text-base font-extrabold font-mono text-slate-800 mt-0.5">
            {formatCurrency ? formatCurrency(billTotal) : `₹${numIN(billTotal)}`}
          </p>
          <span className="text-[10.5px] text-slate-500">{linkedBill?.billNumber || 'Matched Bill'}</span>
        </div>
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Disbursed</span>
          <p className="text-base font-extrabold font-mono text-emerald-800 mt-0.5">
            {formatCurrency ? formatCurrency(totalPaid) : `₹${numIN(totalPaid)}`}
          </p>
          <span className="text-[10.5px] text-emerald-600 font-semibold">{relatedPayments.length} Vouchers Issued</span>
        </div>
        <div className={`p-3 rounded-xl border shadow-2xs ${
          isFullySettled ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-600">Balance Outstanding</span>
          <p className={`text-base font-extrabold font-mono mt-0.5 ${isFullySettled ? 'text-emerald-700' : 'text-amber-800'}`}>
            {formatCurrency ? formatCurrency(balanceDue) : `₹${numIN(balanceDue)}`}
          </p>
          <span className="text-[10.5px] text-slate-500">{isFullySettled ? '✓ Zero AP Balance' : 'Awaiting Payment'}</span>
        </div>
        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Lifecycle Status</span>
          <p className="text-xs font-black text-purple-900 mt-1 flex items-center gap-1">
            {isFullySettled ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <Award size={13} /> 100% Complete
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <CreditCard size={13} /> Payment Due
              </span>
            )}
          </p>
          <span className="text-[10.5px] text-purple-600">PO → Delivery → GRN → Lot → QC → Stock → Bill → Match → Paid</span>
        </div>
      </div>

      {/* ── 100% Completed Celebration Banner ── */}
      {isFullySettled && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-100 border-2 border-emerald-400 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
              <span>Full Procurement Lifecycle Concluded!</span>
              <Sparkles size={15} className="text-amber-500 fill-amber-400" />
            </h4>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">
              Order {poNumber} has achieved 100% completion across all 9 stages. Goods received, takas created, QC approved, inventory updated, vendor bill recorded, 3-way matched, and payment disbursed.
            </p>
          </div>
        </div>
      )}

      {/* ── Record Payment Voucher Form ── */}
      {!isFullySettled && (
        <form onSubmit={handleRecordPayment} className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <CreditCard size={13} className="text-emerald-600" /> Record Disbursement Payment Voucher
            </h4>
            <span className="text-[10.5px] text-slate-500 font-mono">
              Supplier: <strong>{po?.vendor}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Disbursement Amount (₹) *</label>
              <input
                type="number"
                step="any"
                required
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Mode *</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cheque">Bank Cheque</option>
                <option value="UPI">UPI / Online</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            {payMode !== 'Cash' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Account *</label>
                <select
                  required
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold"
                >
                  {bankAccounts.length === 0 ? (
                    <option value="">Default Company Bank</option>
                  ) : (
                    bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName || b.name || 'Bank'} {b.accountNumber ? `(${String(b.accountNumber).slice(-4)})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UTR / Cheque Ref #</label>
              <input
                type="text"
                placeholder="e.g. UTR-98234123"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Disbursing will debit Bank/Cash Account and eliminate Accounts Payable liability.
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Recording Voucher...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Record Payment & Settle AP
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Recorded Payments Table ── */}
      {relatedPayments.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Receipt size={13} className="text-emerald-600" /> Recorded Payment Disbursements ({relatedPayments.length})
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Voucher #</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Mode</th>
                  <th className="py-2 px-3">Reference / UTR</th>
                  <th className="py-2 px-3 text-right">Amount (₹)</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {relatedPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/70 font-mono text-[11px]">
                    <td className="py-1.5 px-3 font-bold text-emerald-800">{p.voucherNumber || p.id}</td>
                    <td className="py-1.5 px-3 text-slate-600">{formatDateDDMMYYYY ? formatDateDDMMYYYY(p.date) : p.date}</td>
                    <td className="py-1.5 px-3 font-sans">{p.mode || 'Bank'}</td>
                    <td className="py-1.5 px-3 font-bold text-slate-700">{p.reference || '—'}</td>
                    <td className="py-1.5 px-3 text-right font-extrabold text-slate-900">
                      {formatCurrency ? formatCurrency(p.amount) : `₹${numIN(p.amount)}`}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-emerald-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-emerald-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={() => onPrevStep('supplier_bill_matching')}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Previous: Bill Matching</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 9 of 9 • Supplier Disbursement
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <CheckCircle2 size={13} />
              <span>Conclude & Close Slide</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierPaymentInlineSlide;
