import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import {
  Download,
  Search,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Building,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Users,
  X,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';

const INITIAL_TREE = {
  id: 'EMP1031',
  name: 'Sarah Mitchell',
  role: 'CEO',
  fullRole: 'Chief Executive Officer',
  department: 'Executive',
  avatar: 'https://i.pravatar.cc/100?img=8',
  email: 'sarah.mitchell@evenmore.com',
  phone: '+1 (555) 019-2831',
  location: 'New York, USA',
  status: 'Active',
  manager: 'Board of Directors',
  reports: [
    {
      id: 'EMP1030',
      name: 'David Park',
      role: 'CTO',
      fullRole: 'Chief Technology Officer',
      department: 'Engineering',
      avatar: 'https://i.pravatar.cc/100?img=11',
      email: 'david.park@evenmore.com',
      phone: '+1 (555) 014-9923',
      location: 'London, UK',
      status: 'Active',
      manager: 'Sarah Mitchell',
      reports: [
        {
          id: 'EMP1024',
          name: 'Priya Patel',
          role: 'Staff Architect',
          fullRole: 'Staff Backend Architect',
          department: 'Engineering',
          avatar: 'https://i.pravatar.cc/100?img=15',
          email: 'priya.p@evenmore.com',
          phone: '+1 (555) 018-4412',
          location: 'Bangalore, IND',
          status: 'Active',
          manager: 'David Park',
        },
        {
          id: 'EMP1026',
          name: 'Liam Cooper',
          role: 'DevOps Lead',
          fullRole: 'DevOps & Cloud Lead',
          department: 'Engineering',
          avatar: 'https://i.pravatar.cc/100?img=20',
          email: 'liam.c@evenmore.com',
          phone: '+1 (555) 012-7741',
          location: 'London, UK',
          status: 'Active',
          manager: 'David Park',
        },
      ],
    },
    {
      id: 'EMP1029',
      name: 'Ayesha Khan',
      role: 'HR Director',
      fullRole: 'Head of People & HRMS',
      department: 'Human Resources',
      avatar: 'https://i.pravatar.cc/100?img=5',
      email: 'ayesha.khan@evenmore.com',
      phone: '+1 (555) 017-8832',
      location: 'New York, USA',
      status: 'Active',
      manager: 'Sarah Mitchell',
      reports: [
        {
          id: 'EMP1032',
          name: 'Tariq Al-Mansoor',
          role: 'Talent Lead',
          fullRole: 'Talent Acquisition Manager',
          department: 'Human Resources',
          avatar: 'https://i.pravatar.cc/100?img=17',
          email: 'tariq.m@evenmore.com',
          phone: '+1 (555) 015-3390',
          location: 'Dubai, UAE',
          status: 'Active',
          manager: 'Ayesha Khan',
        },
      ],
    },
    {
      id: 'EMP1028',
      name: 'James Wilson',
      role: 'CFO',
      fullRole: 'Chief Financial Officer',
      department: 'Finance',
      avatar: 'https://i.pravatar.cc/100?img=12',
      email: 'james.wilson@evenmore.com',
      phone: '+1 (555) 013-6629',
      location: 'New York, USA',
      status: 'Active',
      manager: 'Sarah Mitchell',
      reports: [
        {
          id: 'EMP1033',
          name: 'Sofia Reyes',
          role: 'Finance Analyst',
          fullRole: 'Senior Financial Analyst',
          department: 'Finance',
          avatar: 'https://i.pravatar.cc/100?img=26',
          email: 'sofia.r@evenmore.com',
          phone: '+1 (555) 016-1188',
          location: 'Madrid, ES',
          status: 'Active',
          manager: 'James Wilson',
        },
      ],
    },
  ],
};

export function OrgChartPage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  // View Controls
  const [zoom, setZoom] = useState(100);
  const [q, setQ] = useState('');
  const [expandedAll, setExpandedAll] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState({
    'David Park': false,
    'Ayesha Khan': false,
    'James Wilson': false,
  });

  // Feature Integrations
  const [departmentCount, setDepartmentCount] = useState(12);
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [newDept, setNewDept] = useState({
    name: '',
    head: 'David Park',
    budget: '',
    location: 'New York',
  });

  // Toggle single branch
  function toggleBranch(name, e) {
    e?.stopPropagation();
    setExpandedBranches((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }

  // Toggle Collapse All / Expand All
  function handleToggleAll() {
    if (expandedAll) {
      setExpandedAll(false);
      setExpandedBranches({
        'David Park': false,
        'Ayesha Khan': false,
        'James Wilson': false,
      });
    } else {
      setExpandedAll(true);
      setExpandedBranches({
        'David Park': true,
        'Ayesha Khan': true,
        'James Wilson': true,
      });
    }
  }

  // Check if a person or their children match query
  const matchesQuery = useCallback((person) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      String(person.name ?? '').toLowerCase().includes(term) ||
      String(person.role ?? '').toLowerCase().includes(term) ||
      String(person.department ?? '').toLowerCase().includes(term)
    );
  }, [q]);

  // Check if any report matches query to keep branch visible
  const branchHasMatch = useCallback((node) => {
    if (matchesQuery(node)) return true;
    if (node.reports) {
      return node.reports.some((r) => branchHasMatch(r));
    }
    return false;
  }, [matchesQuery]);

  // Handle Add Department submission
  function handleAddDepartment(e) {
    e.preventDefault();
    if (!newDept.name.trim()) return;

    setDepartmentCount((c) => c + 1);
    setIsAddDeptOpen(false);
    showToast(`Department "${newDept.name}" created successfully`);
    setNewDept({ name: '', head: 'David Park', budget: '', location: 'New York' });
  }

  // Handle CSV Export
  function exportCSV() {
    setIsExportOpen(false);
    const rows = [
      ['ID', 'Name', 'Role', 'Department', 'Manager', 'Email', 'Location', 'Status'],
    ];

    function flatten(node) {
      rows.push([
        node.id,
        `"${node.name}"`,
        `"${node.fullRole || node.role}"`,
        `"${node.department}"`,
        `"${node.manager || '—'}"`,
        `"${node.email}"`,
        `"${node.location}"`,
        `"${node.status}"`,
      ]);
      if (node.reports) {
        node.reports.forEach(flatten);
      }
    }

    flatten(INITIAL_TREE);

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Evenmore_Org_Chart.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Org Chart exported as CSV');
  }

  // Handle Print Export
  function exportPrint() {
    setIsExportOpen(false);
    showToast('Preparing Org Chart print view');
    setTimeout(() => {
      window.print();
    }, 250);
  }

  // Filtered children of root
  const filteredLevel1 = useMemo(() => {
    return INITIAL_TREE.reports.filter((person) => branchHasMatch(person));
  }, [branchHasMatch]);

  const rootMatches = matchesQuery(INITIAL_TREE);

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-6 max-w-[1600px] mx-auto w-full printable-document">
      <PageHeader
        title="Org Chart"
        subtitle={`${departmentCount} Departments • 1,248 Employees • Last updated Oct 11, 2024`}
        guide={hrmsGuides.orgChart}
        actions={
          <>
            {/* Export Dropdown / Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="px-4 py-2.5 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13.5px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download size={16} />
                <span>Export</span>
                <ChevronDown size={14} className="text-muted" />
              </button>

              {isExportOpen && (
                <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-48 bg-white border border-bdr rounded-xl shadow-lg py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportPrint}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Printer size={16} className="text-blue-600" />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Add Department Button */}
            <button
              type="button"
              onClick={() => setIsAddDeptOpen(true)}
              className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13.5px] font-medium shadow-xs transition-colors cursor-pointer"
            >
              Add Department
            </button>
          </>
        }
      />

      {/* ── Control Bar ─────────────────────────────────────────── */}
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or role"
              className="pl-10 pr-4 h-9 w-full sm:w-64 bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-slate-700 text-[12px] p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Collapse / Expand all */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="px-3 py-1 text-navy hover:bg-slate-100 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
          >
            {expandedAll ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-muted font-medium">Zoom</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(60, z - 10))}
            disabled={zoom <= 60}
            className="w-8 h-8 border border-bdr rounded-lg grid place-items-center bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Zoom out"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="w-10 text-center font-medium hover:text-navy cursor-pointer"
            title="Reset to 100%"
          >
            {zoom}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(140, z + 10))}
            disabled={zoom >= 140}
            className="w-8 h-8 border border-bdr rounded-lg grid place-items-center bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Zoom in"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* ── Main Org Chart Canvas ───────────────────────────────── */}
      <div className="bg-white border border-bdr rounded-xl shadow-xs p-4 sm:p-8 overflow-x-auto min-h-[520px] flex justify-center-safe items-start">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="min-w-[880px] flex flex-col items-center transition-transform duration-150"
        >
          {/* ROOT NODE: Sarah Mitchell (CEO) */}
          <div
            onClick={() => setSelectedEmployee(INITIAL_TREE)}
            className={`w-[160px] bg-white border-2 border-navy rounded-xl p-3 flex flex-col items-center shadow-xs cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group ${
              rootMatches && q ? 'ring-2 ring-blue-500/40' : ''
            }`}
          >
            <img
              src={INITIAL_TREE.avatar}
              alt={INITIAL_TREE.name}
              className="w-8 h-8 rounded-full ring-2 ring-navy object-cover"
            />
            <div className="text-[13px] font-semibold text-slate-900 mt-2 group-hover:text-navy transition-colors text-center">
              {INITIAL_TREE.name}
            </div>
            <div className="text-[11px] text-muted text-center">{INITIAL_TREE.role}</div>
          </div>

          {/* Connectors from Root to Level 1 */}
          {expandedAll && filteredLevel1.length > 0 && (
            <>
              {/* Vertical line from root card */}
              <div className="w-px h-8 bg-bdr" />

              {/* Horizontal bar across Level 1 children */}
              <div
                className="h-px bg-bdr"
                style={{
                  width: `${Math.max(160, (filteredLevel1.length - 1) * 220 + 160)}px`,
                }}
              />

              {/* LEVEL 1 CARDS */}
              <div className="flex gap-6 mt-6 relative">
                {filteredLevel1.map((child) => {
                  const isMatch = matchesQuery(child);
                  const isBranchExpanded = expandedBranches[child.name];
                  const hasReports = child.reports && child.reports.length > 0;

                  return (
                    <div key={child.name} className="flex flex-col items-center">
                      {/* Level 1 Node Card */}
                      <div
                        onClick={() => setSelectedEmployee(child)}
                        className={`w-[160px] bg-white border border-bdr rounded-xl p-3 flex flex-col items-center shadow-xs cursor-pointer hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 transition-all group relative ${
                          isMatch && q ? 'ring-2 ring-blue-500/40 border-blue-400' : ''
                        }`}
                      >
                        <img
                          src={child.avatar}
                          alt={child.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="text-[13px] font-semibold text-slate-900 mt-2 group-hover:text-navy transition-colors text-center">
                          {child.name}
                        </div>
                        <div className="text-[11px] text-muted text-center">{child.role}</div>

                        {/* Subordinate Toggle indicator if reports exist */}
                        {hasReports && (
                          <button
                            type="button"
                            onClick={(e) => toggleBranch(child.name, e)}
                            title={isBranchExpanded ? 'Hide reports' : `View ${child.reports.length} reports`}
                            className="mt-2.5 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 bg-off hover:bg-slate-200 border border-bdr rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>{child.reports.length} reports</span>
                            {isBranchExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {/* LEVEL 2 SUBORDINATES (Expandable under each Level 1 Leader) */}
                      {hasReports && isBranchExpanded && (
                        <div className="flex flex-col items-center mt-0">
                          {/* Vertical connector down from Level 1 card */}
                          <div className="w-px h-6 bg-bdr" />

                          {/* Horizontal connector bar for Level 2 children if > 1 */}
                          {child.reports.length > 1 && (
                            <div
                              className="h-px bg-bdr"
                              style={{
                                width: `${(child.reports.length - 1) * 168}px`,
                              }}
                            />
                          )}

                          {/* Level 2 Subordinate Cards */}
                          <div className="flex gap-4">
                            {child.reports.map((sub) => {
                              const isSubMatch = matchesQuery(sub);
                              return (
                                <div key={sub.name} className="flex flex-col items-center">
                                  {child.reports.length > 1 && <div className="w-px h-5 bg-bdr" />}
                                  <div
                                    onClick={() => setSelectedEmployee(sub)}
                                    className={`w-[148px] bg-white border border-bdr rounded-xl p-2.5 flex flex-col items-center shadow-xs cursor-pointer hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 transition-all group ${
                                      isSubMatch && q ? 'ring-2 ring-blue-500/40 border-blue-400' : ''
                                    }`}
                                  >
                                    <img
                                      src={sub.avatar}
                                      alt={sub.name}
                                      className="w-7 h-7 rounded-full object-cover"
                                    />
                                    <div className="text-[12px] font-semibold text-slate-900 mt-1.5 group-hover:text-navy transition-colors text-center truncate w-full">
                                      {sub.name}
                                    </div>
                                    <div className="text-[10.5px] text-muted text-center truncate w-full">
                                      {sub.role}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty search state */}
          {expandedAll && filteredLevel1.length === 0 && !rootMatches && (
            <div className="text-center py-16 text-muted text-[13px]">
              No employees found matching &quot;{q}&quot;
            </div>
          )}
        </div>
      </div>

      {/* ── ADD DEPARTMENT MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={isAddDeptOpen}
        onClose={() => setIsAddDeptOpen(false)}
        title="Add Department"
        size="md"
      >
        <form onSubmit={handleAddDepartment} className="flex flex-col gap-4">
          <p className="text-[13px] text-muted -mt-1">
            Create an organizational unit to streamline reporting, budget allocations, and employee assignments.
          </p>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              placeholder="e.g. Artificial Intelligence & Analytics"
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Department Head
              </label>
              <select
                value={newDept.head}
                onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] text-slate-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 cursor-pointer"
              >
                <option value="David Park">David Park (CTO)</option>
                <option value="Ayesha Khan">Ayesha Khan (HR Director)</option>
                <option value="James Wilson">James Wilson (CFO)</option>
                <option value="Priya Patel">Priya Patel (Staff Architect)</option>
                <option value="Marcus Chen">Marcus Chen (Design Lead)</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Annual Budget
              </label>
              <input
                type="text"
                value={newDept.budget}
                onChange={(e) => setNewDept({ ...newDept, budget: e.target.value })}
                placeholder="e.g. $350,000"
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Primary Office Location
            </label>
            <select
              value={newDept.location}
              onChange={(e) => setNewDept({ ...newDept, location: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] text-slate-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 cursor-pointer"
            >
              <option value="New York">New York Headquarters</option>
              <option value="London">London Regional Office</option>
              <option value="Bangalore">Bangalore Tech Hub</option>
              <option value="Dubai">Dubai Operations</option>
            </select>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-bdr mt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddDeptOpen(false);
                navigate('/hrms/departments');
              }}
              className="text-navy text-[13px] font-medium hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Building size={14} /> Go to Departments Directory
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddDeptOpen(false)}
                className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Create Department
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── EMPLOYEE QUICK VIEW MODAL / DRAWER ─────────────────────── */}
      <Modal
        isOpen={Boolean(selectedEmployee)}
        onClose={() => setSelectedEmployee(null)}
        title="Employee Profile"
        size="md"
      >
        {selectedEmployee && (
          <div className="flex flex-col gap-5">
            {/* Top Employee Card */}
            <div className="flex items-center gap-4 p-4 bg-off border border-bdr rounded-xl">
              <img
                src={selectedEmployee.avatar}
                alt={selectedEmployee.name}
                className="w-14 h-14 rounded-full ring-2 ring-navy/20 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-slate-900 truncate">
                    {selectedEmployee.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedEmployee.status}
                  </span>
                </div>
                <div className="text-[13px] text-slate-600 font-medium">
                  {selectedEmployee.fullRole || selectedEmployee.role}
                </div>
                <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                  <Building size={13} /> {selectedEmployee.department}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Mail size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Work Email</div>
                  <a
                    href={`mailto:${selectedEmployee.email}`}
                    className="text-navy hover:underline truncate block font-medium"
                  >
                    {selectedEmployee.email}
                  </a>
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Phone size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Phone</div>
                  <a
                    href={`tel:${selectedEmployee.phone}`}
                    className="text-slate-800 hover:underline truncate block font-medium"
                  >
                    {selectedEmployee.phone}
                  </a>
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <MapPin size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Location</div>
                  <div className="text-slate-800 font-medium">{selectedEmployee.location}</div>
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Users size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Reports To</div>
                  <div className="text-slate-800 font-medium">{selectedEmployee.manager || '—'}</div>
                </div>
              </div>
            </div>

            {/* Direct Reports Count if any */}
            {selectedEmployee.reports && selectedEmployee.reports.length > 0 && (
              <div className="p-3.5 bg-slate-50 border border-bdr rounded-xl">
                <div className="text-[12px] font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-navy" /> Direct Reports ({selectedEmployee.reports.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.reports.map((rep) => (
                    <div
                      key={rep.name}
                      onClick={() => setSelectedEmployee(rep)}
                      className="px-2.5 py-1 bg-white border border-bdr rounded-lg text-[12px] flex items-center gap-2 hover:border-navy cursor-pointer transition-colors"
                    >
                      <img src={rep.avatar} alt={rep.name} className="w-4 h-4 rounded-full" />
                      <span className="font-medium text-slate-800">{rep.name}</span>
                      <span className="text-[11px] text-muted">({rep.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployee(null);
                  navigate('/hrms/employees');
                }}
                className="px-4 py-2 bg-white border border-bdr hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>View in Employees Directory</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:${selectedEmployee.email}`;
                }}
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail size={14} />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Named alias for flexibility across legacy and unified imports
export const OrgChart = OrgChartPage;
export default OrgChartPage;

