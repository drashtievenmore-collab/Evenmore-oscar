import InfoBanner from '../../components/ui/InfoBanner';
import PageHeader from '../../components/ui/PageHeader';
import AdministrationGuideButton from './AdministrationGuideButton';
import KpiCard from '../../components/ui/KpiCard';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { adminSync, describeError } from '../../services/adminSync';
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

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
];

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
  // Tenants, from /admin/clients/.
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    adminSync.pull('clients').then((rows) => {
      if (!cancelled && rows) setClients(rows);
    });
    return () => { cancelled = true; };
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
    const totalClients = 128;
    const activeClients = 46;
    const clientsWithDeals = 24;
    const clientsWithProjects = 18;
    const clientSatisfaction = '96%';

    return {
      total: totalClients,
      active: activeClients,
      withDeals: clientsWithDeals,
      withProjects: clientsWithProjects,
      satisfaction: clientSatisfaction,
    };
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        text(c.name).includes(q) ||
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
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(start, start + CLIENTS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const handleSaveClient = async (clientData) => {
    try {
      if (editingClient) {
        setClients((prev) =>
          prev.map((c) => (c.id === editingClient.id ? { ...c, ...clientData } : c))
        );
        const saved = await adminSync.update('clients', editingClient.id, clientData);
        if (saved) setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        showNotification(`Client "${clientData.name}" updated successfully!`);
      } else {
        const created = await adminSync.create('clients', clientData);
        if (created) {
          setClients((prev) => [created, ...prev]);
          showNotification(`New client "${created.name}" created successfully!`);
        }
      }
    } catch (err) {
      showNotification(`Client not saved — ${describeError(err)}`);
      return;
    }
    setIsCreateModalOpen(false);
    setEditingClient(null);
  };

  const handleDeleteClient = () => {
    if (!clientToDelete) return;
    setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
    adminSync.remove('clients', clientToDelete.id)
      .catch((err) => showNotification(`Client not deleted — ${describeError(err)}`));
    showNotification(`Client "${clientToDelete.name}" deleted.`);
    setClientToDelete(null);
  };

  const handleToggleLogin = (client) => {
    const updatedStatus = !client.loginEnabled;
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, loginEnabled: updatedStatus } : c))
    );
    adminSync.update('clients', client.id, { loginEnabled: updatedStatus })
      .catch((err) => showNotification(`Login access not saved — ${describeError(err)}`));
    setOpenMenuClientId(null);
    showNotification(
      `Login access for ${client.name} is now ${updatedStatus ? 'Enabled' : 'Disabled'}.`
    );
  };

  const handleResetPassword = (client) => {
    setOpenMenuClientId(null);
    showNotification(`Password reset instructions sent to ${client.email}`);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Clients" value={stats.total} icon={Users} tone="blue">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 12%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Active Clients" value={stats.active} icon={UserCheck} tone="emerald">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 18%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Clients with Deals" value={stats.withDeals} icon={Handshake} tone="sky">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 8%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Clients with Projects" value={stats.withProjects} icon={Folder} tone="amber">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 20%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Client Satisfaction" value={stats.satisfaction} icon={Star} tone="orange">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 4%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name, email, phone..."
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
            <option value="VIP">VIP Clients</option>
            <option value="Regular">Regular Clients</option>
            <option value="Doctors">Doctors</option>
            <option value="Leads">Leads</option>
            <option value="Testing">Testing</option>
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
                          {!client.loginEnabled && (
                            <span className="text-[10px] bg-rose-50 text-rose-600 font-semibold px-1.5 py-0.2 rounded">
                              Disabled
                            </span>
                          )}
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
                            onClick={() => handleToggleLogin(client)}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            {client.loginEnabled ? (
                              <>
                                <Ban size={14} className="text-amber-600" />
                                <span>Login Disable</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                <span>Login Enable</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(client)}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <KeyRound size={14} className="text-sky-600" />
                            <span>Reset Password</span>
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
              Are you sure you want to delete <strong>{clientToDelete.name}</strong>? All associated notes and communication history will be archived.
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
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState(
    client?.phone ? client.phone.replace(/^\+\d+\s*/, '') : ''
  );
  const [company, setCompany] = useState(client?.company || '');
  const [location, setLocation] = useState(client?.location || '');
  const [tags, setTags] = useState(client?.tags ? client.tags.join(', ') : 'Regular');
  const [avatar, setAvatar] = useState(
    client?.avatar || AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)]
  );
  const [loginEnabled, setLoginEnabled] = useState(
    client ? Boolean(client.loginEnabled) : true
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Image size exceeds 2MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a valid client name.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (loginEnabled && !client && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    const formattedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const fullPhone = phoneNumber ? `${countryCode} ${phoneNumber.trim()}` : '';

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: fullPhone || '+91 98765 43210',
      company: company.trim(),
      location: location.trim() || 'Surat, India',
      tags: formattedTags.length > 0 ? formattedTags : ['Regular'],
      avatar,
      loginEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 my-4 sm:my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            {client ? 'Edit Client' : 'Create New Client'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="relative group flex-shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg">
                  {name ? getInitials(name) : 'CL'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <Upload size={13} />
                  <span>Upload Photo</span>
                </button>
                <span className="text-[11px] text-slate-400">JPG, PNG (Max 2MB)</span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400">Presets:</span>
                {AVATAR_PRESETS.slice(0, 5).map((preset, idx) => (
                  <img
                    key={idx}
                    src={preset}
                    alt="Preset"
                    onClick={() => setAvatar(preset)}
                    className={`w-6 h-6 rounded-full object-cover cursor-pointer border hover:scale-110 transition-transform ${
                      avatar === preset ? 'ring-2 ring-blue-500' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Enter client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="Enter client email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-24 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="+91">🇮🇳 +91</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+61">🇦🇺 +61</option>
              </select>
              <input
                type="text"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company (Optional)</label>
              <input
                type="text"
                placeholder="Enter company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location</label>
              <input
                type="text"
                placeholder="Enter location (e.g. Surat, India)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tags</label>
            <input
              type="text"
              placeholder="Select or type tags (comma separated, e.g. VIP, Regular)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {['VIP', 'Regular', 'Doctor', 'New', 'Follow-up', 'International'].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    const current = tags.split(',').map((x) => x.trim()).filter(Boolean);
                    if (!current.includes(t)) {
                      setTags([...current, t].join(', '));
                    }
                  }}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 lg:gap-0">
              <div>
                <span className="font-bold text-slate-800">Login Enable</span>
                <p className="text-[11px] text-slate-400">Allow this client to login to the client portal</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={loginEnabled}
                  onChange={(e) => setLoginEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f6bff]"></div>
              </label>
            </div>
          </div>

          {loginEnabled && !client && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Set login password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-all"
            >
              {client ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
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
                    Portal Login: {client.loginEnabled ? 'Enabled' : 'Disabled'}
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
