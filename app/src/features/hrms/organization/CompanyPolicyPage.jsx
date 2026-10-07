import { useState, useEffect } from "react";
import { CompanyPolicyModule } from "../policy/CompanyPolicyModule";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { usePolicyStore } from "../../../stores/policyStore";
import {
  FileText,
  CheckCircle2,
  Clock,
  Shield,
  Upload,
  Download,
  Search,
  Users,
  Eye,
  Check,
  Building,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";

const INITIAL_POLICIES = [
  {
    id: "POL-01",
    title: "Remote & Hybrid Work Policy",
    version: "v2.1",
    status: "Published",
    effectiveDate: "Sep 01, 2024",
    author: "Ayesha Khan",
    dept: "All Staff",
    category: "Workplace",
    ackedCount: 1048,
    totalCount: 1248,
    content: "Guidelines for core working hours, home office security protocols, communication standards, and hardware provisioning for distributed team members.",
  },
  {
    id: "POL-02",
    title: "Code of Conduct & Ethics",
    version: "v3.0",
    status: "Published",
    effectiveDate: "Jan 15, 2024",
    author: "Sarah Mitchell",
    dept: "All Staff",
    category: "Compliance",
    ackedCount: 1210,
    totalCount: 1248,
    content: "Professional behavior standards, anti-harassment regulations, gift acceptance thresholds, and whistleblower protection guarantees.",
  },
  {
    id: "POL-03",
    title: "Information Security & Data Handling",
    version: "v4.2",
    status: "Published",
    effectiveDate: "Jul 20, 2024",
    author: "David Park",
    dept: "Engineering & Operations",
    category: "Security",
    ackedCount: 940,
    totalCount: 1020,
    content: "Mandatory password lifecycles, VPN requirements, customer PII encryption requirements, and incident reporting protocols.",
  },
  {
    id: "POL-04",
    title: "Travel & Expense Reimbursement",
    version: "v1.8",
    status: "Published",
    effectiveDate: "Aug 10, 2024",
    author: "James Wilson",
    dept: "Sales & Leadership",
    category: "Finance",
    ackedCount: 410,
    totalCount: 460,
    content: "Permissible per diem meal allowances, hotel tier restrictions, receipt submission deadlines, and corporate credit card usage guidelines.",
  },
  {
    id: "POL-05",
    title: "Annual & Special Leave Policy (2026)",
    version: "v2.4",
    status: "Under Review",
    effectiveDate: "Pending Q4 Approval",
    author: "Priya Patel",
    dept: "All Staff",
    category: "Leave & Benefits",
    ackedCount: 0,
    totalCount: 1248,
    content: "Proposed carry-over balance expansion, parental leave enhancements, and revised delegation protocols during extended leaves.",
  },
];

export function LegacyCompanyPolicyPage() {
  const showToast = useAppStore((s) => s.showToast);
  const storePolicies = usePolicyStore((s) => s.policies);
  const [policies, setPolicies] = useState(() => (storePolicies && storePolicies.length > 0 ? storePolicies : INITIAL_POLICIES));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedPolicy, setSelectedPolicy] = useState(() => (storePolicies && storePolicies.length > 0 ? storePolicies[0] : INITIAL_POLICIES[0]));

  useEffect(() => {
    if (storePolicies && storePolicies.length > 0) {
      setPolicies(storePolicies);
      setSelectedPolicy((prev) => storePolicies.find((p) => p.id === prev?.id) || storePolicies[0]);
    }
  }, [storePolicies]);
  const [acknowledgedMap, setAcknowledgedMap] = useState({ "POL-01": true });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    title: "",
    category: "Workplace",
    version: "v1.0",
    dept: "All Staff",
    content: "",
  });

  const filtered = policies.filter((p) => {
    const matchesSearch =
      String(p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.author ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleAcknowledge = (id) => {
    setAcknowledgedMap((prev) => ({ ...prev, [id]: true }));
    showToast(`Policy ${id} acknowledged successfully!`);
  };

  const addPolicy = usePolicyStore((s) => s.addPolicy);

  const handleCreatePolicy = (e) => {
    e.preventDefault();
    if (!newPolicy.title) return;
    const added = addPolicy ? addPolicy({
      name: newPolicy.title,
      title: newPolicy.title,
      category: newPolicy.category,
      ownerDept: newPolicy.dept,
      dept: newPolicy.dept,
      version: newPolicy.version,
      content: newPolicy.content,
      status: "Published",
      author: "Adarsh Gupta",
    }) : null;
    const created = added || {
      id: `POL-0${policies.length + 1}`,
      ...newPolicy,
      status: "Published",
      effectiveDate: "Oct 15, 2024",
      author: "Adarsh Gupta",
      ackedCount: 1,
      totalCount: 1248,
    };
    setPolicies((prev) => [created, ...prev]);
    setSelectedPolicy(created);
    setIsModalOpen(false);
    setNewPolicy({ title: "", category: "Workplace", version: "v1.0", dept: "All Staff", content: "" });
    showToast(`Policy "${created.title || created.name}" published`);
  };

  const currentAcked = acknowledgedMap[selectedPolicy.id];
  const ackPercentage = Math.round((selectedPolicy.ackedCount / selectedPolicy.totalCount) * 100) || 0;

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <PageHeader
        title="Company Policy"
        subtitle="Versioned enterprise policies, compliance terms, and employee acknowledgement tracking."
        guide={hrmsGuides.companyPolicy}
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs"
          >
            <Upload size={16} />
            Publish Policy
          </button>
        }
      />

      {/* Featured Policy Card */}
      <div className="bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-[18px] text-slate-900">{selectedPolicy.title}</span>
              <span className="px-2.5 py-0.5 bg-off border border-bdr rounded-full text-[11px] font-mono text-slate-700">
                {selectedPolicy.version}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                  selectedPolicy.status === "Published"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {selectedPolicy.status}
              </span>
            </div>
            <div className="text-[12.5px] text-muted mt-1.5 flex items-center gap-4 flex-wrap">
              <span>Category: <b>{selectedPolicy.category}</b></span>
              <span>•</span>
              <span>Effective: <b>{selectedPolicy.effectiveDate}</b></span>
              <span>•</span>
              <span>Author: <b>{selectedPolicy.author}</b></span>
              <span>•</span>
              <span>Applies to: <b>{selectedPolicy.dept}</b></span>
            </div>
            <p className="text-[13.5px] text-slate-600 mt-3.5 leading-relaxed bg-off p-4 rounded-xl border border-bdr">
              {selectedPolicy.content}
            </p>
          </div>

          <div className="bg-[#f8fafc] border border-bdr rounded-xl p-4 w-full sm:w-auto sm:min-w-[240px] text-right">
            <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">
              Organization Acknowledgement
            </div>
            <div className="text-[26px] font-bold text-slate-900 mt-1">
              {ackPercentage}%
            </div>
            <div className="text-[11.5px] text-muted">
              {selectedPolicy.ackedCount.toLocaleString()} of {selectedPolicy.totalCount.toLocaleString()} acknowledged
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-navy rounded-full transition-all duration-500"
                style={{ width: `${ackPercentage}%` }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-bdr flex justify-end">
              <button
                type="button"
                onClick={() => handleAcknowledge(selectedPolicy.id)}
                className={`px-5 py-2 rounded-xl text-[13px] font-semibold transition ${
                  currentAcked
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-navy text-white hover:bg-navy/90"
                }`}
              >
                {currentAcked ? "Acknowledged ✓" : "Read & Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search policy name, author..."
              className="pl-9 pr-4 h-9 w-full sm:w-64 md:w-80 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-muted font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] focus:outline-none focus:border-navy cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Workplace">Workplace</option>
              <option value="Compliance">Compliance</option>
              <option value="Security">Security</option>
              <option value="Finance">Finance</option>
              <option value="Leave & Benefits">Leave &amp; Benefits</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Policy Name</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Version</th>
                  <th className="py-3 px-5">Applies To</th>
                  <th className="py-3 px-5">Author</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPolicy(p)}
                    className={`cursor-pointer transition ${
                      selectedPolicy.id === p.id ? "bg-navy/5 font-medium" : "hover:bg-off/60"
                    }`}
                  >
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-[11px] text-muted">Effective {p.effectiveDate}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-[11px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-4 px-5 font-mono text-[12px] text-slate-700">{p.version}</td>
                    <td className="py-4 px-5 text-slate-800">{p.dept}</td>
                    <td className="py-4 px-5 text-slate-700">{p.author}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] border ${
                          p.status === "Published"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPolicy(p);
                        }}
                        className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900"
                        title="View Policy"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Publish Policy */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">Publish Company Policy</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePolicy} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Policy Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generative AI Workplace Usage Policy"
                  value={newPolicy.title}
                  onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={newPolicy.category}
                    onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  >
                    <option>Workplace</option>
                    <option>Compliance</option>
                    <option>Security</option>
                    <option>Finance</option>
                    <option>Leave & Benefits</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Version</label>
                  <input
                    type="text"
                    placeholder="e.g. v1.0"
                    value={newPolicy.version}
                    onChange={(e) => setNewPolicy({ ...newPolicy, version: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Applies To</label>
                <input
                  type="text"
                  placeholder="e.g. All Staff or Engineering"
                  value={newPolicy.dept}
                  onChange={(e) => setNewPolicy({ ...newPolicy, dept: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Policy Summary & Guidelines</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Summarize the key compliance expectations and guidelines..."
                  value={newPolicy.content}
                  onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90"
                >
                  Publish Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export const CompanyPolicy = CompanyPolicyModule;
export const CompanyPolicyPage = CompanyPolicyModule;
export default CompanyPolicyModule;
