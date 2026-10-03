import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';

const isLostLead = (lead) => /lost|closed/i.test(String(lead?.status || ''));

export default function LostLeadsPage() {
  const leads = useCrmStore((s) => s.leads);
  const lostLeads = useMemo(() => leads.filter(isLostLead), [leads]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <XCircle size={18} className="text-rose-500" /> Lost Leads
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Leads that were marked as Lost / Closed and never converted to a customer.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Lead</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Created On</th>
            </tr>
          </thead>
          <tbody>
            {lostLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No lost leads yet. Mark a lead as Lost from its detail page to see it here.
                </td>
              </tr>
            )}
            {lostLeads.map((lead, index) => (
              <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className="text-blue-600 hover:underline font-semibold">
                    {lead.name || 'Untitled Lead'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.company || '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {lead.status || 'Lost'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.owner || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.source || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.createdOn || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
