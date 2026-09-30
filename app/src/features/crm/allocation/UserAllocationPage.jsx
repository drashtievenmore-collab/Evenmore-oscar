import CrmKpiCard from '../common/CrmKpiCard';
import React, { useState } from 'react';
import { Users, UserPlus, Search, CheckCircle2, Award, Clock, ArrowUpRight, ShieldCheck, Mail, Phone, MapPin, ListChecks } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { useERP } from '../../../context/ERPContext';
import UserLocationTracking from './UserLocationTracking';

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

export default function UserAllocationPage() {
  const { formatCurrency } = useERP();
  const [teamMembers, setTeamMembers] = useState([
    {
      id: 1,
      name: 'David Patel',
      role: 'Senior Sales Account Manager',
      email: 'david@evenmore.io',
      phone: '+91 98234 11223',
      leadsAssigned: 28,
      dealsClosed: 14,
      conversionRate: '50.0%',
      activePipeline: 485000,
      avatar: 'https://i.pravatar.cc/160?img=68',
      status: 'Online',
    },
    {
      id: 2,
      name: 'Priya Mehta',
      role: 'Enterprise Accounts Executive',
      email: 'priya@evenmore.io',
      phone: '+91 98455 33445',
      leadsAssigned: 32,
      dealsClosed: 18,
      conversionRate: '56.2%',
      activePipeline: 620000,
      avatar: 'https://i.pravatar.cc/160?img=47',
      status: 'In Meeting',
    },
    {
      id: 3,
      name: 'Rohit Sharma',
      role: 'Technical Pre-Sales Specialist',
      email: 'rohit@evenmore.io',
      phone: '+91 98777 88990',
      leadsAssigned: 19,
      dealsClosed: 9,
      conversionRate: '47.4%',
      activePipeline: 280000,
      avatar: 'https://i.pravatar.cc/160?img=12',
      status: 'Offline',
    },
    {
      id: 4,
      name: 'Ananya Deshmukh',
      role: 'Customer Success & Inbound Leads',
      email: 'ananya@evenmore.io',
      phone: '+91 98111 22334',
      leadsAssigned: 24,
      dealsClosed: 11,
      conversionRate: '45.8%',
      activePipeline: 265000,
      avatar: 'https://i.pravatar.cc/160?img=32',
      status: 'Online',
    },
  ]);

  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    role: 'Sales Representative',
    email: '',
    phone: '',
    avatar: 'https://i.pravatar.cc/160?img=33',
  });

  const totalLeads = teamMembers.reduce((sum, m) => sum + m.leadsAssigned, 0);
  const totalDeals = teamMembers.reduce((sum, m) => sum + m.dealsClosed, 0);
  const totalPipeline = teamMembers.reduce((sum, m) => sum + m.activePipeline, 0);
  const [view, setView] = useState('tracking');

  const filtered = teamMembers.filter(
    (m) =>
      text(m.name).includes(search.toLowerCase()) ||
      text(m.role).includes(search.toLowerCase()) ||
      text(m.email).includes(search.toLowerCase())
  );

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) return;

    const created = {
      id: teamMembers.length + 1,
      ...newMember,
      leadsAssigned: 0,
      dealsClosed: 0,
      conversionRate: '0.0%',
      activePipeline: 0,
      status: 'Online',
    };

    setTeamMembers([...teamMembers, created]);
    setNewMember({ name: '', role: 'Sales Representative', email: '', phone: '', avatar: 'https://i.pravatar.cc/160?img=33' });
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Tracking"
        subtitle="Sales representative capacity, lead assignment rules, and workload metrics"
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-bold">
              <button type="button" onClick={() => setView('allocation')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${view === 'allocation' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}>
                <ListChecks size={13} /> Allocation
              </button>
              <button type="button" onClick={() => setView('tracking')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${view === 'tracking' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'}`}>
                <MapPin size={13} /> Live Tracking
              </button>
            </div>
            {view === 'allocation' && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="btn-primary btn-sm flex items-center gap-1.5"
              >
                <UserPlus size={14} strokeWidth={2.4} /> Add Representative
              </button>
            )}
          </div>
        }
      />

      {/* Add Representative Form */}
      {isAddOpen && view === 'allocation' && (
        <form onSubmit={handleAddMember} className="card p-4 space-y-3 bg-blue-50/50 dark:bg-slate-900/40 border border-blue-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">New Representative</h3>
            <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <input
              type="text"
              required
              placeholder="Representative Name *"

              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              required
              placeholder="Role / Designation *"
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
            />
            <input
              type="email"
              required
              placeholder="Work Email *"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={newMember.phone}
              onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAddOpen(false)} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-sm">
              Save Representative
            </button>
          </div>
        </form>
      )}

      {view === 'tracking' ? (
        <UserLocationTracking />
      ) : (
      <>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
        <CrmKpiCard label="Active Representatives" value={teamMembers.length} icon={Users} tone="blue" />
        <CrmKpiCard label="Total Won Deals" value={totalDeals} icon={CheckCircle2} tone="emerald" />
        <CrmKpiCard label="Avg. Conversion Rate" value="48.2%" icon={Award} tone="amber" />
        <CrmKpiCard label="Allocated Pipeline" value={formatCurrency(totalPipeline, { noDecimals: true })} icon={ArrowUpRight} tone="purple" />
      </div>

      {/* Team Roster & Allocation Table */}
      <div className="card">
        <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
          <h3 className="font-bold text-sm">Representative Workload & Performance</h3>
          <label className="search-bar" style={{ width: 240, height: 32 }}>
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search representative..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table text-xs min-w-[760px] lg:min-w-0">
            <thead>
              <tr>
                <th>Representative</th>
                <th>Role & Title</th>
                <th>Contact Details</th>
                <th>Assigned Leads</th>
                <th>Deals Closed</th>
                <th>Conversion Rate</th>
                <th>Active Pipeline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full object-cover shadow-xs" />
                      <div>
                        <strong className="font-bold text-slate-800 dark:text-slate-200 block">{m.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-600 dark:text-slate-300 font-medium">{m.role}</td>
                  <td>
                    <div className="space-y-0.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Mail size={11} /> {m.email}</span>
                      <span className="flex items-center gap-1"><Phone size={11} /> {m.phone}</span>
                    </div>
                  </td>
                  <td className="font-bold font-mono text-center">{m.leadsAssigned}</td>
                  <td className="font-bold font-mono text-center text-emerald-600">{m.dealsClosed}</td>
                  <td className="font-bold font-mono text-center text-blue-600">{m.conversionRate}</td>
                  <td className="font-bold font-mono">{formatCurrency(m.activePipeline, { noDecimals: true })}</td>
                  <td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.status === 'Online'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : m.status === 'In Meeting'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
