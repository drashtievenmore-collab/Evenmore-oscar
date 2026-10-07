import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Badge } from '../../../components/hrms/Badge';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, isBackendEnabled } from '../../../services/hrmsSync';
import {
  Building2,
  Plus,
  Search,
  Users,
  LayoutList,
  LayoutGrid,
  Briefcase,
  DollarSign,
} from 'lucide-react';

const INITIAL_DEPTS = [
  { id: 'DEP-01', name: 'Engineering', head: 'David Park', avatar: 'https://i.pravatar.cc/100?img=11', teams: 8, employees: 142, openRoles: 5, budget: '$450,000', status: 'Active' },
  { id: 'DEP-02', name: 'Sales & CRM', head: 'Alex Rivera', avatar: 'https://i.pravatar.cc/100?img=14', teams: 5, employees: 48, openRoles: 3, budget: '$320,000', status: 'Active' },
  { id: 'DEP-03', name: 'Human Resources', head: 'Ayesha Khan', avatar: 'https://i.pravatar.cc/100?img=5', teams: 3, employees: 24, openRoles: 1, budget: '$110,000', status: 'Active' },
  { id: 'DEP-04', name: 'Finance & Accounts', head: 'James Wilson', avatar: 'https://i.pravatar.cc/100?img=12', teams: 4, employees: 38, openRoles: 2, budget: '$180,000', status: 'Restructuring' },
  { id: 'DEP-05', name: 'Warehouse & Inventory', head: 'Chen Li', avatar: 'https://i.pravatar.cc/100?img=34', teams: 3, employees: 28, openRoles: 4, budget: '$210,000', status: 'Active' },
  { id: 'DEP-06', name: 'Marketing & Design', head: 'Elena Rostova', avatar: 'https://i.pravatar.cc/100?img=9', teams: 4, employees: 56, openRoles: 1, budget: '$160,000', status: 'Active' },
];

export function DepartmentsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const [departments, setDepartments] = useState(INITIAL_DEPTS);
  const [q, setQ] = useState('');
  const [view, setView] = useState('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', head: 'David Park', budget: '$250,000' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await hrmsSync.pull('departments');
        if (active && Array.isArray(rows) && rows.length > 0) {
          setDepartments(rows);
        }
      } catch (err) {
        console.warn('[DepartmentsPage] Failed to pull departments:', err);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = departments.filter((d) =>
    String(d.name ?? '').toLowerCase().includes(q.toLowerCase()) ||
    String(d.head ?? '').toLowerCase().includes(q.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    const created = {
      id: `DEP-0${departments.length + 1}`,
      name: newDept.name,
      head: newDept.head,
      avatar: 'https://i.pravatar.cc/100?img=11',
      teams: 1,
      employees: 1,
      openRoles: 0,
      budget: newDept.budget || '$150,000',
      status: 'Active',
    };
    setDepartments([created, ...departments]);
    try {
      if (isBackendEnabled()) {
        const saved = await hrmsSync.create('departments', created);
        if (saved?.id) {
          setDepartments((prev) => prev.map((d) => (d.id === created.id ? saved : d)));
        }
      }
    } catch (err) {
      console.warn('[DepartmentsPage] Failed to create department on server:', err);
    }
    showToast(`Department "${newDept.name}" created successfully`);
    setIsModalOpen(false);
    setNewDept({ name: '', head: 'David Park', budget: '$250,000' });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational structure, operational units, and leadership"
        guide={hrmsGuides.departments}
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13.5px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Department
          </button>
        }
      />

      {/* Filter / View Control Bar */}
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search department or head..."
            className="pl-9 pr-4 h-9 w-full sm:w-64 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
          />
        </div>

        <div className="flex p-1 bg-off border border-bdr rounded-xl">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${
              view === 'table' ? 'bg-white border border-bdr shadow-xs font-medium text-slate-900' : 'text-muted hover:text-slate-700'
            }`}
          >
            <LayoutList size={14} /> List
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${
              view === 'grid' ? 'bg-white border border-bdr shadow-xs font-medium text-slate-900' : 'text-muted hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={14} /> Grid
          </button>
        </div>
      </div>

      {/* Main Content View */}
      {view === 'table' ? (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Department</th>
                  <th className="py-3 px-5">Head</th>
                  <th className="py-3 px-5">Teams</th>
                  <th className="py-3 px-5">Employees</th>
                  <th className="py-3 px-5">Open Roles</th>
                  <th className="py-3 px-5">Budget</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-off/60 transition-colors">
                    <td className="py-4 px-5 font-semibold text-slate-900 flex items-center gap-2">
                      <Building2 size={16} className="text-navy shrink-0" />
                      {d.name}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <img src={d.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        <span className="font-medium text-slate-800">{d.head}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-slate-700">{d.teams} teams</td>
                    <td className="py-4 px-5 text-slate-700">{d.employees} members</td>
                    <td className="py-4 px-5">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium">
                        {d.openRoles} open
                      </span>
                    </td>
                    <td className="py-4 px-5 font-medium text-slate-700">{d.budget}</td>
                    <td className="py-4 px-5">
                      <Badge tone={d.status === 'Active' ? 'success' : 'warning'}>
                        {d.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white border border-bdr rounded-xl p-5 shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-[15px] text-slate-900">{d.name}</h3>
                  <Badge tone={d.status === 'Active' ? 'success' : 'warning'}>{d.status}</Badge>
                </div>
                <div className="text-[12.5px] text-muted flex items-center gap-2 mt-2.5">
                  <img src={d.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                  <span>Head: <b className="text-slate-800 font-medium">{d.head}</b></span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-bdr/60 text-[11px]">
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {d.teams} teams
                </span>
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {d.employees} employees
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium">
                  {d.openRoles} open roles
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Department */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Department">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Artificial Intelligence"
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Head
            </label>
            <select
              value={newDept.head}
              onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            >
              <option value="David Park">David Park (CTO)</option>
              <option value="Ayesha Khan">Ayesha Khan (HR Director)</option>
              <option value="James Wilson">James Wilson (CFO)</option>
              <option value="Elena Rostova">Elena Rostova (Marketing Lead)</option>
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Annual Budget
            </label>
            <input
              type="text"
              placeholder="e.g. $300,000"
              value={newDept.budget}
              onChange={(e) => setNewDept({ ...newDept, budget: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Save Department
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Departments = DepartmentsPage;
export default DepartmentsPage;

