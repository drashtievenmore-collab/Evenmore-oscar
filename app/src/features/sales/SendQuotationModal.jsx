import React, { useMemo, useState } from 'react';
import { Copy, FileText, Link2, Mail, MessageCircle, Send, X } from 'lucide-react';
import { api } from '../../services/api';
import { isBackendEnabled } from '../../services/resourceSync';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inr(value) {
  return `₹${(Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500';

export default function SendQuotationModal({
  quotation, shareUrl = '', customerEmail = '', customerPhone = '',
  onClose, onSent,
}) {
  const [channel, setChannel] = useState('email');
  const [emails, setEmails] = useState(customerEmail ? [customerEmail] : []);
  const [emailInput, setEmailInput] = useState('');
  const [phone, setPhone] = useState(customerPhone || '');
  const [subject, setSubject] = useState(`Quotation ${quotation?.quoteNumber || ''} from ${quotation?.customer || 'us'}`);
  const [message, setMessage] = useState(
    `Dear ${quotation?.customer || 'Customer'},\n\nPlease find attached our quotation (${quotation?.quoteNumber || ''}) for your reference. You can view the quotation online using the secure link below.\n\nIf you have any questions, please let us know.`,
  );
  const [includeLink, setIncludeLink] = useState(true);
  const [requestApproval, setRequestApproval] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentOk, setSentOk] = useState('');

  const items = useMemo(() => (Array.isArray(quotation?.items) ? quotation.items : []), [quotation]);
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.qty ?? it.quantity) * num(it.rate ?? it.price), 0);
    const gst = Math.max(0, num(quotation?.amount) - subtotal);
    return { subtotal, gst, grand: num(quotation?.amount) || subtotal + gst };
  }, [items, quotation]);

  function addEmail(value) {
    const v = String(value || '').trim().replace(/[,;]$/, '');
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(`"${v}" is not a valid email address.`);
      return;
    }
    if (!emails.includes(v)) setEmails((prev) => [...prev, v]);
    setEmailInput('');
    setError('');
  }

  function fullMessage() {
    let body = message.trim();
    if (requestApproval) {
      body += '\n\nPlease use the secure link below to approve or reject this quotation online.';
    }
    if (includeLink && shareUrl) {
      body += `\n\nView quotation: ${shareUrl}`;
    }
    return body;
  }

  async function handleSendEmail() {
    setError('');
    setSentOk('');
    if (emails.length === 0) {
      setError('Add at least one recipient email address.');
      return;
    }
    if (!isBackendEnabled()) {
      setError('You are not signed in. Sign in and try again.');
      return;
    }
    if (!quotation?.id) {
      setError('Save this quotation first, then send it.');
      return;
    }
    setSending(true);
    try {
      const result = await api.post(`/sales/quotations/${quotation.id}/send/`, {
        channel: 'email',
        recipients: emails,
        subject: subject.trim(),
        message: fullMessage(),
      });
      if (result && result.sent === false) {
        setError(result.note || 'The email was recorded but not delivered.');
        return;
      }
      setSentOk(`Email sent to ${emails.join(', ')}.`);
      onSent?.('email');
    } catch (err) {
      setError(err?.message || 'The email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function handleWhatsApp() {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) {
      setError('Enter the customer mobile number first.');
      return;
    }
    setError('');
    const text = encodeURIComponent(`${subject}\n\n${fullMessage()}`);
    window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener');
    onSent?.('whatsapp');
  }

  async function handleCopyLink() {
    if (!shareUrl) {
      setError('Generate the customer link first (Copy Link on the quotation page).');
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSentOk('Link copied.');
    } catch {
      setError('Clipboard blocked — select the link and copy it manually.');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Send size={14} /></span>
              Send Quotation to Customer
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Share this quotation with your customer via Email or WhatsApp.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 text-[11px] text-blue-800 bg-blue-50/60">
          <Link2 size={13} className="shrink-0" />
          <span>A secure quotation link will be shared with your customer. They can view the quotation and approve or reject it directly.</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setChannel('email'); setError(''); }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${channel === 'email' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Mail size={14} /> Email
            </button>
            <button
              type="button"
              onClick={() => { setChannel('whatsapp'); setError(''); }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${channel === 'whatsapp' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {channel === 'email' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">To (Email Address) *</label>
                    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 min-h-[38px]">
                      {emails.map((m) => (
                        <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                          {m}
                          <button type="button" onClick={() => setEmails((prev) => prev.filter((x) => x !== m))} className="hover:text-blue-900" aria-label={`Remove ${m}`}>×</button>
                        </span>
                      ))}
                      <input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onBlur={() => addEmail(emailInput)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(emailInput); } }}
                        placeholder={emails.length === 0 ? 'name@company.com' : 'Add more email addresses…'}
                        className="flex-1 min-w-[140px] outline-none text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Subject *</label>
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Message *</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className={`${inputCls} leading-relaxed`} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800">Additional Options</p>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                      Include secure quotation link in the email
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={requestApproval} onChange={(e) => setRequestApproval(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                      Request customer to approve online
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp Number *</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 919876543210" className={inputCls} />
                    <p className="text-[11px] text-slate-400 mt-1">Opens WhatsApp with the quotation message prefilled.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className={`${inputCls} leading-relaxed`} />
                  </div>
                </>
              )}
              {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
              {sentOk && <p role="status" className="text-xs font-semibold text-emerald-600">{sentOk}</p>}
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileText size={13} className="text-blue-600" /> Quotation Preview</p>
                <span className="text-[11px] font-semibold text-blue-700">View PDF</span>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">Oscar</p>
                    <p className="text-[10px] tracking-widest text-slate-400 font-bold">TEXTILE ERP</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-slate-900">QUOTATION</p>
                    <p className="text-[11px] font-mono text-slate-600">{quotation?.quoteNumber}</p>
                  </div>
                </div>
                <div className="flex items-start justify-between mt-2 text-[11px]">
                  <div>
                    <p className="font-bold text-slate-800">{quotation?.customer}</p>
                    <p className="text-slate-500">Date: {quotation?.date || '—'}</p>
                  </div>
                  <p className="text-slate-500">Valid Until: {quotation?.validUntil || '—'}</p>
                </div>
                <table className="w-full text-left text-[11px] mt-2">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="py-1 pr-1 w-6">#</th>
                      <th className="py-1 pr-1">Fabric / Item</th>
                      <th className="py-1 pr-1 text-right">Qty</th>
                      <th className="py-1 pr-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="py-1 pr-1 text-slate-400">{i + 1}</td>
                        <td className="py-1 pr-1 font-semibold text-slate-800">{it.itemName || it.name || it.description}</td>
                        <td className="py-1 pr-1 text-right font-mono">{num(it.qty ?? it.quantity).toLocaleString('en-IN')}</td>
                        <td className="py-1 pr-1 text-right font-mono">₹{num(it.rate ?? it.price).toLocaleString('en-IN')}</td>
                        <td className="py-1 text-right font-mono font-bold">{inr(num(it.qty ?? it.quantity) * num(it.rate ?? it.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="text-[11px] mt-2 space-y-0.5">
                  <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-mono">{inr(totals.subtotal)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>GST (5%)</dt><dd className="font-mono">{inr(totals.gst)}</dd></div>
                  <div className="flex justify-between font-bold text-slate-900"><dt>Grand Total</dt><dd className="font-mono">{inr(totals.grand)}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 text-xs font-bold rounded-lg">
            <Copy size={13} /> Copy Link
          </button>
          <span className="hidden sm:block flex-1 min-w-0 truncate font-mono text-[11px] text-slate-400">{shareUrl}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
            {channel === 'email' ? (
              <button type="button" onClick={handleSendEmail} disabled={sending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                <Send size={13} /> {sending ? 'Sending…' : 'Send to Customer'}
              </button>
            ) : (
              <button type="button" onClick={handleWhatsApp} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
                <Send size={13} /> Open WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
