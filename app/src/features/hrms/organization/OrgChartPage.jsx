import { useState, useEffect, useMemo, useCallback } from 'react';
import { Avatar } from "../../../components/hrms/Avatar";
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
  RefreshCw,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { pullOrgChart } from '../../../services/hrmsSync';

export function OrgChartPage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  // Org Chart state from API
  const [orgTree, setOrgTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Controls
  const [zoom, setZoom] = useState(100);
  const [q, setQ] = useState('');
  const [expandedAll, setExpandedAll] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState({});

  // Feature Integrations
  const [departmentCount, setDepartmentCount] = useState(0);
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [newDept, setNewDept] = useState({
    name: '',
    head: '',
    budget: '',
    location: 'New York',
  });

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pullOrgChart();
      let root = null;
      if (res && res.tree) {
        root = Array.isArray(res.tree) ? (res.tree[0] || null) : res.tree;
      } else if (Array.isArray(res)) {
        root = res[0] || null;
      } else if (res && typeof res === 'object') {
        root = res;
      }
      setOrgTree(root);
    } catch (err) {
      console.warn('[OrgChartPage] Failed to pull org chart:', err);
      setError(err?.message || 'Failed to load organization chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

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
      setExpandedBranches({});
    } else {
      setExpandedAll(true);
      const branches = {};
      function collect(node) {
        if (!node) return;
        if (node.reports && node.reports.length > 0) {
          if (node.name) branches[node.name] = true;
          node.reports.forEach(collect);
        }
      }
      collect(orgTree);
      setExpandedBranches(branches);
    }
  }

  // Check if a person or their children match query
  const matchesQuery = useCallback((person) => {
    if (!person) return false;
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    const role = person.fullRole || person.role || person.designation || '';
    return (
      String(person.name ?? '').toLowerCase().includes(term) ||
      String(role).toLowerCase().includes(term) ||
      String(person.department ?? '').toLowerCase().includes(term)
    );
  }, [q]);

  // Check if any report matches query to keep branch visible
  const branchHasMatch = useCallback((node) => {
    if (!node) return false;
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
    setNewDept({ name: '', head: '', budget: '', location: 'New York' });
  }

  // Handle CSV Export
  function exportCSV() {
    setIsExportOpen(false);
    if (!orgTree) {
      showToast('No org chart data to export', 'error');
      return;
    }
    const rows = [
      ['ID', 'Name', 'Role', 'Department', 'Manager', 'Email', 'Location', 'Status'],
    ];

    function flatten(node) {
      if (!node) return;
      rows.push([
        node.id || node.employeeCode || '',
        `"${node.name || ''}"`,
        `"${node.fullRole || node.role || node.designation || ''}"`,
        `"${node.department || ''}"`,
        `"${node.manager || '—'}"`,
        `"${node.email || ''}"`,
        `"${node.location || ''}"`,
        `"${node.status || 'Active'}"`,
      ]);
      if (node.reports) {
        node.reports.forEach(flatten);
      }
    }

    flatten(orgTree);

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
    if (!orgTree || !Array.isArray(orgTree.reports)) return [];
    return orgTree.reports.filter((person) => branchHasMatch(person));
  }, [orgTree, branchHasMatch]);

  const rootMatches = orgTree ? matchesQuery(orgTree) : false;

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-6 max-w-[1600px] mx-auto w-full printable-document">
      <PageHeader
        title="Org Chart"
        subtitle="Organizational reporting hierarchy and executive structure"
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted text-sm w-full gap-3">
            <RefreshCw size={20} className="animate-spin text-navy" />
            <span>Loading organization chart…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted text-sm w-full gap-3">
            <p className="text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadTree}
              className="px-4 py-1.5 bg-navy text-white text-[12.5px] rounded-lg font-medium"
            >
              Retry
            </button>
          </div>
        ) : !orgTree ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted text-sm w-full gap-2">
            <Building size={32} className="text-slate-300 mb-1" />
            <p className="font-medium text-slate-600">No org chart data available</p>
            <p className="text-[12px] text-muted">Configure reporting lines in the Employees directory to build the chart.</p>
          </div>
        ) : (
          <div
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            className="min-w-[880px] flex flex-col items-center transition-transform duration-150"
          >
            {/* ROOT NODE */}
            <div
              onClick={() => setSelectedEmployee(orgTree)}
              className={`w-[160px] bg-white border-2 border-navy rounded-xl p-3 flex flex-col items-center shadow-xs cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group ${
                rootMatches && q ? 'ring-2 ring-blue-500/40' : ''
              }`}
            >
              <Avatar name={orgTree.name} size="lg" />
              <div className="text-[13px] font-semibold text-slate-900 mt-2 group-hover:text-navy transition-colors text-center">
                {orgTree.name}
              </div>
              <div className="text-[11px] text-muted text-center">
                {orgTree.fullRole || orgTree.role || orgTree.designation || 'Leader'}
              </div>
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
                      <div key={child.id || child.name} className="flex flex-col items-center">
                        {/* Level 1 Node Card */}
                        <div
                          onClick={() => setSelectedEmployee(child)}
                          className={`w-[160px] bg-white border border-bdr rounded-xl p-3 flex flex-col items-center shadow-xs cursor-pointer hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 transition-all group relative ${
                            isMatch && q ? 'ring-2 ring-blue-500/40 border-blue-400' : ''
                          }`}
                        >
                          <Avatar name={child.name} size="md" />
                          <div className="text-[13px] font-semibold text-slate-900 mt-2 group-hover:text-navy transition-colors text-center">
                            {child.name}
                          </div>
                          <div className="text-[11px] text-muted text-center">
                            {child.fullRole || child.role || child.designation || ''}
                          </div>

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

                        {/* LEVEL 2 SUBORDINATES */}
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
                                  <div key={sub.id || sub.name} className="flex flex-col items-center">
                                    {child.reports.length > 1 && <div className="w-px h-5 bg-bdr" />}
                                    <div
                                      onClick={() => setSelectedEmployee(sub)}
                                      className={`w-[148px] bg-white border border-bdr rounded-xl p-2.5 flex flex-col items-center shadow-xs cursor-pointer hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 transition-all group ${
                                        isSubMatch && q ? 'ring-2 ring-blue-500/40 border-blue-400' : ''
                                      }`}
                                    >
                                      <Avatar name={sub.name} size="sm" />
                                      <div className="text-[12px] font-semibold text-slate-900 mt-1.5 group-hover:text-navy transition-colors text-center truncate w-full">
                                        {sub.name}
                                      </div>
                                      <div className="text-[10.5px] text-muted text-center truncate w-full">
                                        {sub.fullRole || sub.role || sub.designation || ''}
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
        )}
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
              <input
                type="text"
                value={newDept.head}
                onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
                placeholder="e.g. Department Head Name"
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
              />
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
            <input
              type="text"
              value={newDept.location}
              onChange={(e) => setNewDept({ ...newDept, location: e.target.value })}
              placeholder="e.g. New York Headquarters"
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
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
              <Avatar name={selectedEmployee.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-slate-900 truncate">
                    {selectedEmployee.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedEmployee.status || 'Active'}
                  </span>
                </div>
                <div className="text-[13px] text-slate-600 font-medium">
                  {selectedEmployee.fullRole || selectedEmployee.role || selectedEmployee.designation || 'Team Member'}
                </div>
                {selectedEmployee.department && (
                  <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                    <Building size={13} /> {selectedEmployee.department}
                  </div>
                )}
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Mail size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Work Email</div>
                  {selectedEmployee.email ? (
                    <a
                      href={`mailto:${selectedEmployee.email}`}
                      className="text-navy hover:underline truncate block font-medium"
                    >
                      {selectedEmployee.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Phone size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Phone</div>
                  {selectedEmployee.phone ? (
                    <a
                      href={`tel:${selectedEmployee.phone}`}
                      className="text-slate-800 hover:underline truncate block font-medium"
                    >
                      {selectedEmployee.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <MapPin size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Location</div>
                  <div className="text-slate-800 font-medium">{selectedEmployee.location || '—'}</div>
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
                      key={rep.id || rep.name}
                      onClick={() => setSelectedEmployee(rep)}
                      className="px-2.5 py-1 bg-white border border-bdr rounded-lg text-[12px] flex items-center gap-2 hover:border-navy cursor-pointer transition-colors"
                    >
                      <Avatar name={rep.name} size="xs" />
                      <span className="font-medium text-slate-800">{rep.name}</span>
                      <span className="text-[11px] text-muted">
                        ({rep.fullRole || rep.role || rep.designation || 'Member'})
                      </span>
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

              {selectedEmployee.email && (
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
              )}
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
