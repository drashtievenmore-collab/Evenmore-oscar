import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Calendar,
  X,
} from 'lucide-react';
import { salesService } from '../../../services/domainServices';

export default function BrokerCommissionPage() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('register'); // register | statement

  // Pay modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedComm, setSelectedComm] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Statement data
  const [statementData, setStatementData] = useState([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await salesService.getBrokerCommissions({
        status: statusFilter || undefined,
      });
      const data = res?.data || res?.results || res || [];
      setCommissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load broker commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchStatement = useCallback(async () => {
    try {
      const res = await salesService.getBrokerStatement({ brokerId: selectedBrokerId || undefined });
      const data = res?.data || res || [];
      setStatementData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load broker statement:', err);
    }
  }, [selectedBrokerId]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  useEffect(() => {
    if (activeTab === 'statement') {
      fetchStatement();
    }
  }, [activeTab, fetchStatement]);

  const handleApprove = async (id) => {
    try {
      await salesService.approveBrokerCommission(id);
      fetchCommissions();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Approval failed.');
    }
  };

  const handleMakePayable = async (id) => {
    try {
      await salesService.makeBrokerPayable(id);
      fetchCommissions();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Status change failed.');
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedComm) return;
    try {
      setSubmitting(true);
      await salesService.payBrokerCommission(selectedComm.id, {
        amount: payAmount,
        bankAccount,
        reference,
      });
      setShowPayModal(false);
      setSelectedComm(null);
      setPayAmount('');
      fetchCommissions();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Payment recording failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = commissions.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.broker_name || c.broker?.name || '').toLowerCase().includes(q) ||
      (c.invoice_number || '').toLowerCase().includes(q) ||
      (c.party_name || '').toLowerCase().includes(q)
    );
  });

  const totals = commissions.reduce(
    (acc, curr) => {
      const amt = Number(curr.commission_amount) || 0;
      if (curr.status === 'Accrued') acc.accrued += amt;
      else if (curr.status === 'Approved') acc.approved += amt;
      else if (curr.status === 'Payable') acc.payable += amt;
      else if (curr.status === 'Paid') acc.paid += amt;
      return acc;
    },
    { accrued: 0, approved: 0, payable: 0, paid: 0 }
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Broker Commission Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track invoice-level brokerage accrual, verification, payout workflows, and automatic return adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'register' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Commission Register
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'statement' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Broker Balances & Statement
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400">ACCRUED (INVOICED)</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">₹{totals.accrued.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting verification</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400">APPROVED</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">₹{totals.approved.toLocaleString()}</div>
          <div className="text-xs text-indigo-600/80 mt-1">Verified against collections</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400">PAYABLE DUE</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">₹{totals.payable.toLocaleString()}</div>
          <div className="text-xs text-amber-600/80 mt-1">Ready for bank payout</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400">DISBURSED / PAID</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">₹{totals.paid.toLocaleString()}</div>
          <div className="text-xs text-emerald-600/80 mt-1">Settled to broker</div>
        </div>
      </div>

      {activeTab === 'register' ? (
        <>
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search broker, invoice, party..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="Accrued">Accrued</option>
                <option value="Approved">Approved</option>
                <option value="Payable">Payable</option>
                <option value="Paid">Paid</option>
                <option value="Hold">Hold</option>
              </select>
            </div>
          </div>

          {/* Register Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                    <th className="py-3 px-4">Invoice No / Date</th>
                    <th className="py-3 px-4">Broker</th>
                    <th className="py-3 px-4">Customer Party</th>
                    <th className="py-3 px-4 text-right">Invoice Total</th>
                    <th className="py-3 px-4 text-right">Commission</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400">Loading commissions...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400">No broker commissions recorded.</td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {c.invoice_number || 'Direct'}
                          <div className="text-xs text-slate-400 font-normal">{c.invoice_date || c.created_at?.slice(0, 10)}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {c.broker_name || c.broker?.name || 'Direct / Unassigned'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{c.party_name || '—'}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          ₹{(Number(c.invoice_total) || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600">
                          ₹{(Number(c.commission_amount) || 0).toLocaleString()}
                          <div className="text-xs text-slate-400 font-normal">
                            {c.rate_percentage ? `${c.rate_percentage}%` : `${c.rate_per_meter || 0}/m`}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              c.status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : c.status === 'Payable'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : c.status === 'Approved'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          {c.status === 'Accrued' && (
                            <button
                              onClick={() => handleApprove(c.id)}
                              className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                            >
                              Approve
                            </button>
                          )}
                          {c.status === 'Approved' && (
                            <button
                              onClick={() => handleMakePayable(c.id)}
                              className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                            >
                              Mark Payable
                            </button>
                          )}
                          {c.status === 'Payable' && (
                            <button
                              onClick={() => {
                                setSelectedComm(c);
                                setPayAmount(String(c.commission_amount));
                                setShowPayModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                            >
                              Pay Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Statement Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Broker Summary Statement</h2>
            <div className="text-xs text-slate-500">Statement as of {new Date().toLocaleDateString()}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3">Broker Name</th>
                  <th className="p-3 text-right">Accrued</th>
                  <th className="p-3 text-right">Approved</th>
                  <th className="p-3 text-right">Payable</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Net Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statementData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">No broker balance statements found.</td>
                  </tr>
                ) : (
                  statementData.map((row) => (
                    <tr key={row.brokerId} className="hover:bg-slate-50/75">
                      <td className="p-3 font-semibold text-slate-800">{row.brokerName}</td>
                      <td className="p-3 text-right text-slate-600">₹{(row.accrued || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-600">₹{(row.approved || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-amber-600 font-medium">₹{(row.payable || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-600 font-medium">₹{(row.paid || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{(row.balance || 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && selectedComm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Pay Brokerage: {selectedComm.broker_name || 'Broker'}
              </h2>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bank / Cash Account</label>
                <input
                  type="text"
                  placeholder="HDFC / SBI / Cash in Hand"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cheque / UTR Ref</label>
                <input
                  type="text"
                  placeholder="UTR-2026-9988"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                Posts Dr Brokerage Payable / Cr Bank account in General Ledger.
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
