import InfoBanner from '../../components/ui/InfoBanner';
import PageHeader from '../../components/ui/PageHeader';
import AdministrationGuideButton from './AdministrationGuideButton';
import KpiCard from '../../components/ui/KpiCard';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { adminSync, describeError, pullCustomerClients } from '../../services/adminSync';
import { useERP } from '../../context/ERPContext';
import {
  Users,
  UserCheck,
  Handshake,
  Folder,
  Star,
  Search,
  Plus,
  Download,
  LayoutGrid,
  List,
  MoreVertical,
  X,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  MapPin,
  Mail,
  Phone,
  Building2,
  Tag,
  Lock,
  Unlock,
  KeyRound,
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Camera,
  Check,
  FileSpreadsheet,
  StickyNote,
  Clock,
  Sparkles,
  Ban,
  Shield,
  Layers,
} from 'lucide-react';

const CLIENTS_PER_PAGE = 12;

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getInitialsColor(name = '') {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-indigo-100 text-indigo-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

function getTagStyle(tag = '') {
  const t = tag.toLowerCase();
  if (t === 'vip' || t === 'doctor' || t === 'testing') {
    return 'bg-rose-50 text-rose-600 border-rose-100';
  }
  if (t === 'regular' || t === 'high potential' || t === 'potential') {
    return 'bg-purple-50 text-purple-600 border-purple-100';
  }
  if (t === 'new' || t === 'active' || t === 'repeat client') {
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  }
  if (t === 'follow-up' || t === 'international' || t === 'jewelry designer' || t === 'lead') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  if (t === 'freelancer' || t === 'local' || t === 'inactive') {
    return 'bg-sky-50 text-sky-600 border-sky-100';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function ClientAvatar({ client, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;
  const initials = getInitials(client?.name);
  const initialsColor = getInitialsColor(client?.name);

  if (client?.avatar && !imgError) {
    return (
      <div className={`relative rounded-full overflow-hidden flex-shrink-0 shadow-2xs border border-slate-200/80 ${currentSizeClass} ${className}`}>
        <img
          src={client.avatar}
          alt={client.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-2xs ${initialsColor} ${currentSizeClass} ${className}`}
    >
      {initials}
    </div>
  );
}

export function ClientsPage() {
  const { refreshFromBackend } = useERP();
  const [clients, setClients] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadClients = async () => {
      try {
        const rows = await pullCustomerClients();
        if (!cancelled) {
          setClients(rows);
          setLoadError('');
        }
      } catch (error) {
        if (!cancelled) setLoadError(describeError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadClients();
    window.addEventListener('focus', loadClients);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadClients);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const [toastMessage, setToastMessage] = useState(null);
  const [openMenuClientId, setOpenMenuClientId] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [clientForDeals, setClientForDeals] = useState(null);
  const [clientForProjects, setClientForProjects] = useState(null);
  const [clientForNote, setClientForNote] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.client-menu-container') && !e.target.closest('.export-menu-container')) {
        setOpenMenuClientId(null);
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const allLocations = useMemo(() => {
    const set = new Set(clients.map((c) => c.location).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [clients]);

  const allTags = useMemo(() => {
    const set = new Set(clients.flatMap((c) => c.tags || []));
    return ['All', ...Array.from(set)];
  }, [clients]);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((client) => client.status === 'Active').length,
      withDeals: clients.filter((client) => client.deals > 0).length,
      withProjects: clients.filter((client) => client.projects > 0).length,
      dualPartners: clients.filter((client) => client.type === 'Both').length,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        text(c.name).includes(q) ||
        text(c.code).includes(q) ||
        text(c.email).includes(q) ||
        text(c.phone).includes(q) ||
        text(c.company).includes(q) ||
        text(c.location).includes(q);

      const matchesCategory =
        selectedCategory === 'All' ||
        (c.category && String(c.category ?? '').toLowerCase() === selectedCategory.toLowerCase()) ||
        (c.tags && c.tags.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()));

      const matchesStatus =
        selectedStatus === 'All' ||
        (c.status && String(c.status ?? '').toLowerCase() === selectedStatus.toLowerCase());

      const matchesLocation =
        selectedLocation === 'All' || c.location === selectedLocation;

      const matchesTag =
        selectedTag === 'All' ||
        (c.tags && c.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()));

      return matchesSearch && matchesCategory && matchesStatus && matchesLocation && matchesTag;
    });
  }, [clients, searchQuery, selectedCategory, selectedStatus, selectedLocation, selectedTag]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PER_PAGE));
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(start, start + CLIENTS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const handleSaveClient = async (clientData) => {
    try {
      if (editingClient) {
        const saved = await adminSync.update('customerClients', editingClient.id, clientData);
        if (!saved) throw new Error('The client could not be saved. Please sign in again.');
        if (saved) setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        showNotification(`Client "${clientData.name}" updated successfully!`);
      } else {
        const created = await adminSync.create('customerClients', clientData);
        if (!created) throw new Error('The client could not be saved. Please sign in again.');
        if (created) {
          setClients((prev) => [created, ...prev]);
          showNotification(`New client "${created.name}" created successfully!`);
        }
      }
    } catch (err) {
      showNotification(`Client not saved — ${describeError(err)}`);
      return false;
    }
    refreshFromBackend();
    setIsCreateModalOpen(false);
    setEditingClient(null);
    return true;
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      const deleted = await adminSync.remove('customerClients', clientToDelete.id);
      if (!deleted) throw new Error('The client could not be deleted. Please sign in again.');
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      refreshFromBackend();
      showNotification(`Client "${clientToDelete.name}" deleted.`);
      setClientToDelete(null);
    } catch (error) {
      showNotification(`Client not deleted: ${describeError(error)}`);
    }
  };

  const handleAddNoteToClient = (noteText) => {
    if (!clientForNote || !noteText.trim()) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientForNote.id
          ? { ...c, notes: [noteText.trim(), ...(c.notes || [])] }
          : c
      )
    );
    showNotification(`Note added to ${clientForNote.name}'s file.`);
    setClientForNote(null);
  };

  const handleExportData = (format = 'csv') => {
    setIsExportOpen(false);
    if (format === 'csv') {
      const headers = ['Name', 'Email', 'Phone', 'Location', 'Company', 'Status', 'Deals', 'Projects', 'Tags'];
      const rows = clients.map((c) => [
        `"${c.name}"`,
        `"${c.email}"`,
        `"${c.phone}"`,
        `"${c.location}"`,
        `"${c.company || ''}"`,
        `"${c.status || 'Active'}"`,
        c.deals || 0,
        c.projects || 0,
        `"${(c.tags || []).join(', ')}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Clients exported as CSV successfully!');
    } else {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(clients, null, 2))}`;
      const link = document.createElement('a');
      link.setAttribute('href', jsonString);
      link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Clients exported as JSON successfully!');
    }
  };

  return (
    <div className="min-h-screen text-slate-800 p-4 md:p-7 space-y-6" style={{ backgroundColor: 'var(--page, #f6f9ff)', color: 'var(--text)' }}>
      {toastMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Clients"
        subtitle="Manage your clients, view details, and track deals, projects, and communication."
        actions={
          <>
            <AdministrationGuideButton entity="client" />
            <div className="relative export-menu-container">
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs md:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition-colors"
              >
                <Download size={16} />
                <span>Export</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleExportData('csv')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => handleExportData('json')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <FileText size={15} className="text-blue-600" />
                    <span>Export as JSON</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setEditingClient(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-[#1f6bff] hover:bg-blue-700 text-white font-semibold text-xs md:text-sm px-4 md:px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-95"
            >
              <Plus size={18} strokeWidth={2.4} />
              <span>Create New Client</span>
            </button>
          </>
        }
      />

      <InfoBanner
        storageKey="adminClientsInfoBannerV1"
        title="Why use Client Management?"
        text="Keep client contact details and business information in one place. Review related deals and projects, update client records and use filters to find the customers you need."
      />

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Unable to load clients: {loadError}</div>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading clients...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Clients" value={stats.total} icon={Users} tone="blue" />
        <KpiCard label="Active Clients" value={stats.active} icon={UserCheck} tone="emerald" />
        <KpiCard label="Clients with Deals" value={stats.withDeals} icon={Handshake} tone="sky" />
        <KpiCard label="Clients with Projects" value={stats.withProjects} icon={Folder} tone="amber" />
        <KpiCard label="Dual Partners" value={stats.dualPartners} icon={Building2} tone="orange" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name, code, email, phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Clients</option>
            <option value="Customer">Customers</option>
            <option value="Dual Partner">Dual Partners</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Hold">On Hold</option>
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Locations</option>
            {allLocations
              .filter((loc) => loc !== 'All')
              .map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
          </select>

          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Tags</option>
            {allTags
              .filter((t) => t !== 'All')
              .map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-1 self-end md:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'grid'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'list'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1f6bff] flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No clients match your filter</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or resetting the dropdown filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedStatus('All');
              setSelectedLocation('All');
              setSelectedTag('All');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedClients.map((client) => {
            const isMenuOpen = openMenuClientId === client.id;
            return (
              <div
                key={client.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:border-blue-300 hover:shadow-xs transition-all relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClientAvatar client={client} size="md" />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate leading-tight flex items-center gap-1.5">
                          <span>{client.name}</span>
                          <span className="text-[10px] font-medium text-slate-500">{client.status}</span>
                        </h3>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <Mail size={11} className="flex-shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
                          <Phone size={11} className="flex-shrink-0 text-slate-400" />
                          <span>{client.phone}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="flex-shrink-0 text-slate-400" />
                          <span>{client.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative client-menu-container flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuClientId((prev) => (prev === client.id ? null : client.id));
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          isMenuOpen
                            ? 'bg-slate-200 text-slate-800 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical size={15} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(client);
                              setIsCreateModalOpen(true);
                              setOpenMenuClientId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <Edit2 size={14} className="text-blue-600" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setClientToDelete(client);
                              setOpenMenuClientId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                          >
                            <Trash2 size={14} className="text-rose-500" />
                            <span>Delete</span>
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          <button
                            type="button"
                            onClick={() => {
                              setClientForDeals(client);
                              setOpenMenuClientId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <Handshake size={14} className="text-purple-600" />
                            <span>View Deals</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setClientForProjects(client);
                              setOpenMenuClientId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <Folder size={14} className="text-amber-600" />
                            <span>View Projects</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setClientForNote(client);
                              setOpenMenuClientId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <StickyNote size={14} className="text-indigo-600" />
                            <span>Add Note</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {(client.tags || []).map((tag, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getTagStyle(
                          tag
                        )}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 mt-3 border-y border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Deals</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">{client.deals || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Projects</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">{client.projects || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Last Activity</div>
                      <div className="text-[10px] font-semibold text-slate-700 mt-0.5 truncate">
                        {client.lastActivity || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 mt-1">
                  <button
                    onClick={() => setViewingClient(client)}
                    className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                  >
                    <Eye size={13} />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingClient(client);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] lg:min-w-0 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4 text-center">Deals</th>
                  <th className="py-3 px-4 text-center">Projects</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <ClientAvatar client={client} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900">{client.name}</div>
                          {client.company && (
                            <div className="text-[11px] text-slate-400">{client.company}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{client.phone}</div>
                      <div className="text-[11px] text-slate-400">{client.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{client.location}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(client.tags || []).map((t, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getTagStyle(
                              t
                            )}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {client.deals || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {client.projects || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {client.lastActivity}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          client.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {client.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingClient(client)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200"
                          title="View"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingClient(client);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
        <span>
          Showing {filteredClients.length === 0 ? 0 : (currentPage - 1) * CLIENTS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * CLIENTS_PER_PAGE, filteredClients.length)} of {filteredClients.length} clients
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              onClick={() => setCurrentPage(pg)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold ${
                currentPage === pg
                  ? 'bg-[#1f6bff] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pg}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateEditClientModal
          client={editingClient}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingClient(null);
          }}
          onSave={handleSaveClient}
        />
      )}

      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Client?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>{clientToDelete.name}</strong>? This also removes the customer from the party directory.
            </p>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
              >
                Yes, Delete Client
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingClient && (
        <ClientDetailDrawer
          client={viewingClient}
          onClose={() => setViewingClient(null)}
          onEdit={() => {
            setEditingClient(viewingClient);
            setViewingClient(null);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      {clientForDeals && (
        <ClientDealsModal
          client={clientForDeals}
          onClose={() => setClientForDeals(null)}
        />
      )}

      {clientForProjects && (
        <ClientProjectsModal
          client={clientForProjects}
          onClose={() => setClientForProjects(null)}
        />
      )}

      {clientForNote && (
        <AddNoteModal
          client={clientForNote}
          onClose={() => setClientForNote(null)}
          onSave={handleAddNoteToClient}
        />
      )}
    </div>
  );
}

function CreateEditClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    location: client?.billingAddress?.city || '',
    status: client?.status || 'Active',
  });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    const saved = await onSave({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      status: form.status,
      billingAddress: { ...client?.billingAddress, city: form.location.trim() },
    });
    if (!saved) setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{client ? 'Edit Client' : 'Create New Client'}</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>
        {[
          ['name', 'Client Name', 'text'],
          ['email', 'Email Address', 'email'],
          ['phone', 'Phone Number', 'tel'],
          ['location', 'City', 'text'],
        ].map(([key, label, type]) => (
          <label key={key} className="block text-xs font-semibold text-slate-700">
            {label}{key === 'name' ? ' *' : ''}
            <input type={type} required={key === 'name'} value={form[key]} disabled={saving}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </label>
        ))}
        <label className="block text-xs font-semibold text-slate-700">
          Status
          <select value={form.status} disabled={saving} onChange={(event) => setForm({ ...form, status: event.target.value })}
            className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            {['Active', 'On Hold', 'Inactive'].map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Client'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientDetailDrawer({ client, onClose, onEdit }) {
  if (!client) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users size={15} className="text-[#1f6bff]" />
              <span className="font-semibold text-slate-800">Client Profile</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-4">
              <ClientAvatar client={client} size="lg" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{client.name}</h3>
                <p className="text-xs text-slate-500">{client.company || 'Private Client'}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(client.tags || []).map((t, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getTagStyle(
                        t
                      )}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Total Deals</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{client.deals || 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Active Projects</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{client.projects || 0}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Contact Information
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Mail size={15} className="text-blue-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{client.email}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Phone size={15} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <MapPin size={15} className="text-rose-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{client.location}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Shield size={15} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">
                    Customer Code: {client.code}
                  </span>
                </div>
              </div>
            </div>

            {client.notes && client.notes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notes & Remarks
                </h4>
                <div className="space-y-1.5">
                  {client.notes.map((note, idx) => (
                    <div key={idx} className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex-1 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
          >
            <Edit2 size={14} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientDealsModal({ client, onClose }) {
  const deals = client?.activeDeals || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">Deals for {client.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs max-h-80 overflow-y-auto">
          {deals.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No active deals found for this client.</div>
          ) : (
            deals.map((deal) => (
              <div key={deal.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 lg:gap-0">
                <div>
                  <div className="font-bold text-slate-800">{deal.name}</div>
                  <div className="text-[11px] text-purple-600 font-semibold mt-0.5">{deal.stage}</div>
                </div>
                <div className="text-sm font-extrabold text-slate-900">{deal.value}</div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientProjectsModal({ client, onClose }) {
  const projects = client?.activeProjects || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Folder size={18} className="text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Projects for {client.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs max-h-80 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No active projects found for this client.</div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800">{proj.name}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {proj.status}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="bg-[#1f6bff] h-1.5 rounded-full"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ client, onClose, onSave }) {
  const [noteText, setNoteText] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onSave(noteText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <StickyNote size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Add Note for {client.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Note Content</label>
            <textarea
              rows={4}
              required
              placeholder="Enter meeting notes, follow-up instructions, or client remarks..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
            >
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClientsPage;
