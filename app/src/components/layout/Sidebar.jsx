import { useEffect, useRef, useState, useMemo } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Target,
  Users,
  Briefcase,
  ShoppingCart,
  Truck,
  Package,
  Layers,
  Landmark,
  UserCheck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Infinity as InfinityIcon,
  Building2,
  FileText,
  FileSpreadsheet,
  Receipt,
  ArrowDownLeft,
  RotateCcw,
  Boxes,
  MapPin,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  PieChart,
  CalendarCheck,
  ListChecks,
  ClipboardList,
  UserPlus,
  GraduationCap,
  TrendingUp,
  Shield,
  MessagesSquare,
  Send,
  User,
  ShieldCheck,
  PackageCheck, // [PHASE-2B] Goods Receipt (GRN) nav icon
  Calendar,
  Sliders,
  Search,
  X,
  Sun,
  Moon,
  Sparkles,
  TreePine,
  Waves,
  BookOpen,
  Check,
  LogOut,
  Lock,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { usePmsStore, computeNavBadges } from '../../stores/pmsStore';
import { useERP } from '../../context/ERPContext';
import { useModuleWhenIdle } from '../../hooks/useIdleReady';
import { UserGuideModal } from '../common/UserGuideModal';
import { clearStoredAuth } from '../../utils/authUtils';

const SIDEBAR_THEMES = [
  { id: 'oscar', name: 'Oscar', icon: Waves, color: '#14b8a6' },
  { id: 'light', name: 'Light', icon: Sun, color: '#1f6bff' },
  { id: 'dark', name: 'Dark', icon: Moon, color: '#3b82f6' },
  { id: 'midnight', name: 'Midnight', icon: Sparkles, color: '#818cf8' },
  { id: 'emerald', name: 'Emerald', icon: TreePine, color: '#10b981' },
];

// ── Navigation Structure ──────────────────────────────────────
const NAV = [
  {
    label: 'Dashboard',
    icon: Home,
    to: '/dashboard',
  },

  {
    label: 'CRM',
    icon: LayoutGrid,
    defaultOpen: false,
    children: [
      {
        label: 'Leads',
        icon: Target,
        defaultOpen: true,
        children: [
          { label: 'Leads', to: '/crm/leads', dot: true },
          { label: 'Lead Create Form', to: '/crm/leads/forms' },
          { label: 'Lead Tasks Master', to: '/crm/leads/tasks-master' },
          { label: 'Lead Task Form', to: '/crm/leads/task-form' },
          { label: 'Lead Stage Tasks', to: '/crm/leads/stage-tasks' },
        ],
      },
      {
        label: 'Tasks',
        icon: ListChecks,
        defaultOpen: true,
        children: [
          { label: 'Tasks List', to: '/crm/tasks' },
          { label: 'Task Allocation', to: '/crm/tasks/allocation' },
        ],
      },
      { label: 'Deals', icon: TrendingUp, to: '/crm/deals' },
      { label: 'Contracts', icon: FileText, to: '/crm/contracts' },
      { label: 'CRM System Setup', icon: Settings, to: '/crm/system-setup' },
    ],
  },

  {
    label: 'PMS (Projects)',
    icon: Briefcase,
    badgeKey: 'pmsActiveCount',
    children: [
      { label: 'PMS Dashboard', icon: Home, to: '/pms' },
      { label: 'All Projects', icon: Layers, to: '/pms/projects' },
      { label: 'My Projects', icon: UserCheck, to: '/pms/my-projects' },
      { label: 'My Tasks', icon: ListChecks, to: '/pms/my-tasks', badgeKey: 'pmsMyTasksPending' },
      { label: 'Dynamic Stages', icon: Sliders, to: '/pms/stages' },
      { label: 'Timeline & Gantt', icon: Calendar, to: '/pms/timeline' },
      { label: 'Delay Center', icon: AlertTriangle, to: '/pms/delays', badgeKey: 'pmsDelayedCount', badgeColor: '#ef4444' },
      { label: 'PMS Reports', icon: PieChart, to: '/pms/reports' },
      { label: 'PMS Settings', icon: Settings, to: '/pms/settings' },
    ],
  },

  {
    label: 'Sales',
    icon: BarChart3,
    children: [
      { label: 'Estimates', icon: FileText, to: '/sales/estimates' },
      { label: 'Quotations', icon: FileText, to: '/sales/quotations' },
      { label: 'Sales Orders', icon: ShoppingCart, to: '/sales/orders' },
      { label: 'Proforma Invoices', icon: FileSpreadsheet, to: '/sales/proforma' },
      { label: 'Sales Invoices', icon: Receipt, to: '/sales/invoices' },
      { label: 'Delivery Challans', icon: Send, to: '/sales/delivery' },
      { label: 'Warranty Cards', icon: ShieldCheck, to: '/sales/warranty' },
      { label: 'Sales Returns', icon: RotateCcw, to: '/sales/returns' },
      { label: 'Payment In', icon: ArrowDownLeft, to: '/sales/payments' },
    ],
  },

  {
    label: 'Purchase',
    icon: Truck,
    children: [
      { label: 'Purchase Orders', icon: ClipboardList, to: '/purchase/orders' },
      // ── [PHASE-2B] New standalone Goods Receipt (GRN) nav entry ──
      { label: 'Goods Receipt', icon: PackageCheck, to: '/purchase/receipts' },
      { label: 'Purchase Bills', icon: Receipt, to: '/purchase/bills' },
      { label: 'Purchase Returns', icon: RotateCcw, to: '/purchase/returns' },
      { label: 'Payment Out', icon: ArrowDownLeft, to: '/purchase/payments' },
      { label: 'Expenses', icon: Landmark, to: '/purchase/expenses' },
    ],
  },

  {
    label: 'Parties',
    icon: Building2,
    to: '/parties',
  },

  {
    label: 'Inventory',
    icon: Package,
    children: [
      {
        label: 'Items Master',
        icon: Boxes,
        defaultOpen: false,
        children: [
          { label: 'All Items', to: '/inventory/items', dot: true },
          { label: 'Machine Master', to: '/inventory/items/machines' },
          { label: 'Stock Inventory', to: '/inventory/items/stock' },
        ],
      },
      {
        label: 'Categories',
        icon: Layers,
        defaultOpen: false,
        children: [
          { label: 'All Categories', to: '/inventory/categories', dot: true },
          { label: 'Machine Categories', to: '/inventory/categories/machines' },
          { label: 'Stock Categories', to: '/inventory/categories/stock' },
        ],
      },
      { label: 'Stock Position', icon: BarChart3, to: '/inventory/stock-position' },
      { label: 'Transfers', icon: ArrowLeftRight, to: '/inventory/transfers' },
      { label: 'Locations', icon: MapPin, to: '/inventory/locations' },
      { label: 'Faulty Parts', icon: AlertTriangle, to: '/inventory/faulty-parts', badgeKey: 'faulty' },
      { label: 'Service Usage', icon: Wrench, to: '/inventory/service-usage' },
      { label: 'Zone Requests', icon: Send, to: '/inventory/zone-requests', badgeKey: 'zone' },
      { label: 'Valuation & Ageing', icon: TrendingUp, to: '/inventory/valuation' },
      { label: 'Month-End Audit', icon: CalendarCheck, to: '/inventory/audit' },
    ],
  },

  {
    label: 'Accounts',
    icon: Landmark,
    children: [
      { label: 'Cash / Bank', icon: Landmark, to: '/accounts/cash-bank' },
      { label: 'General Ledger', icon: FileText, to: '/accounts/general-ledger' },
      { label: 'Financial Reports', icon: PieChart, to: '/accounts/reports' },
    ],
  },

  {
    label: 'HRMS',
    icon: UserCheck,
    children: [
      { label: 'Dashboard', icon: Home, to: '/hrms/dashboard' },
      { label: 'Employees', icon: Users, to: '/hrms/employees' },
      {
        label: 'Attendance',
        icon: CalendarCheck,
        defaultOpen: false,
        children: [
          { label: 'Overview', to: '/hrms/attendance', dot: true },
          { label: 'Mark Attendance', to: '/hrms/attendance/mark' },
          { label: 'Individual', to: '/hrms/attendance/individual' },
          { label: 'Bulk', to: '/hrms/attendance/bulk' },
          { label: 'Requests', to: '/hrms/attendance/requests' },
          { label: 'Flexibility', to: '/hrms/attendance/flexibility' },
        ],
      },
      { label: 'Leave', icon: CalendarCheck, to: '/hrms/leave' },
      { label: 'Payroll', icon: Receipt, to: '/hrms/payroll' },
      {
        label: 'Recruitment',
        icon: UserPlus,
        defaultOpen: false,
        children: [
          { label: 'Dashboard', to: '/hrms/recruitment', dot: true },
          { label: 'Jobs', to: '/hrms/recruitment/jobs' },
          { label: 'Candidates', to: '/hrms/recruitment/candidates' },
          { label: 'Interviews', to: '/hrms/recruitment/interviews' },
          { label: 'Applications', to: '/hrms/recruitment/applications' },
          { label: 'Offers', to: '/hrms/recruitment/offers' },
          { label: 'Onboarding', to: '/hrms/recruitment/onboarding' },
          { label: 'Career', to: '/hrms/recruitment/career' },
          { label: 'Custom Questions', to: '/hrms/recruitment/questions' },
          // { label: 'Funnel', to: '/hrms/recruitment/funnel' }, // Hidden: Recruitment Funnel feature commented out
        ],
      },
      {
        label: 'Performance',
        icon: TrendingUp,
        defaultOpen: false,
        children: [
          { label: 'Dashboard', to: '/hrms/performance', dot: true },
          { label: 'Indicators', to: '/hrms/performance/indicators' },
          { label: 'KPI Data', to: '/hrms/performance/kpi-data' },
          { label: 'Appraisal', to: '/hrms/performance/appraisal' },
          { label: 'Appraisal Funnel', to: '/hrms/performance/appraisal-funnel' },
          // { label: 'Goal Tracking', to: '/hrms/performance/goal-tracking' }, // Hidden: Goal Tracking feature commented out
          // { label: 'Goal Funnel', to: '/hrms/performance/goal-funnel' }, // Hidden: Goal Funnel feature commented out
        ],
      },
      { label: 'Training', icon: GraduationCap, to: '/hrms/training' },
      { label: 'HR Admin', icon: ShieldCheck, to: '/hrms/hr-admin' },
      { label: 'Asset Setup', icon: Briefcase, to: '/hrms/assets' },
      { label: 'Documents', icon: FileText, to: '/hrms/documents' },
      {
        label: 'Organization',
        icon: Building2,
        defaultOpen: false,
        children: [
          { label: 'Org Chart', to: '/hrms/org-chart', dot: true },
          { label: 'Departments', to: '/hrms/departments' },
          { label: 'Locations', to: '/hrms/locations' },
          { label: 'Designations', to: '/hrms/designations' },
        ],
      },
      { label: 'Company Policy', icon: ShieldCheck, to: '/hrms/company-policy' },
      { label: 'Calendar', icon: Calendar, to: '/hrms/calendar' },
      // { label: 'HRMS Setup', icon: Sliders, to: '/hrms/hrms-setup' }, // Hidden: HRMS Setup commented out
    ],
  },

  {
    label: 'Reports',
    icon: BarChart3,
    to: '/reports',
  },

  {
    label: 'Administration',
    icon: Shield,
    children: [
      { label: 'Users', to: '/administration/users' },
      { label: 'Roles', to: '/administration/roles' },
      { label: 'Clients', to: '/administration/clients' },
    ],
  },
];

// Flatten all defined navigation paths to compute accurate specificity
function collectNavPaths(items) {
  const paths = [];
  function walk(list) {
    for (const item of list) {
      if (item.to) paths.push(item.to);
      if (item.children) walk(item.children);
    }
  }
  walk(items);
  return paths;
}

const ALL_NAV_PATHS = collectNavPaths(NAV);

function isRouteActive(targetPath, currentPath) {
  if (!targetPath) return false;
  // 1. Exact match
  if (currentPath === targetPath) return true;

  // 2. Prefix match only if no other nav item matches currentPath more specifically
  if (currentPath.startsWith(targetPath + '/')) {
    // If an exact match exists in the navigation tree for currentPath, then prefix match is false
    const exactMatchExists = ALL_NAV_PATHS.some((p) => p === currentPath);
    if (exactMatchExists) return false;

    // Otherwise, check if this is the longest matching prefix
    const matchingPrefixes = ALL_NAV_PATHS.filter(
      (p) => currentPath === p || currentPath.startsWith(p + '/')
    );
    // Sort descending by path length
    matchingPrefixes.sort((a, b) => b.length - a.length);
    return matchingPrefixes[0] === targetPath;
  }

  return false;
}

// ── Filter navigation tree recursively by search query ──────
function filterNavTree(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase().trim();

  function filterItem(item) {
    const labelMatch = String(item.label ?? '').toLowerCase().includes(q);

    if (item.children) {
      const filteredChildren = item.children
        .map(filterItem)
        .filter(Boolean);

      if (labelMatch || filteredChildren.length > 0) {
        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
          forceOpen: true,
        };
      }
      return null;
    }

    return labelMatch ? item : null;
  }

  return items.map(filterItem).filter(Boolean);
}

// ── Sub-item (leaf node) ────────────────────────────────────
// ── Nav count badge ─────────────────────────────────────────
// Defaults to the original blue pill; `color` (hex) opts a row into its own
// tone, e.g. the red used by the PMS Delay Center.
function NavBadge({ count, color }) {
  if (!count) return null;

  if (!color) {
    return (
      <span className="ml-auto px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
        {count}
      </span>
    );
  }

  return (
    <span
      className="ml-auto px-1.5 py-0.2 text-[10px] font-bold rounded-full border"
      style={{ background: `${color}33`, color, borderColor: `${color}4d` }}
    >
      {count}
    </span>
  );
}

function SubItem({ item, depth = 1, badges = {} }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const isExact = currentPath === item.to;
  const isFormBuilderAlias =
    item.label === 'Lead Create Form' &&
    (currentPath === '/crm/leads/forms' || currentPath === '/crm/leads/form-builder' || currentPath === '/crm/leads/create-form');
  const isPrefix = Boolean(item.to && currentPath.startsWith(item.to + '/'));
  const hasBetterMatch =
    isPrefix &&
    (isFormBuilderAlias ||
      ALL_NAV_PATHS.some(
        (p) =>
          p !== item.to &&
          (currentPath === p || (currentPath.startsWith(p + '/') && p.length > item.to.length))
      ) ||
      (item.to === '/crm/leads' &&
        (currentPath === '/crm/leads/forms' ||
          currentPath === '/crm/leads/form-builder' ||
          currentPath === '/crm/leads/create-form')));
  const isActive = isFormBuilderAlias || isExact || (isPrefix && !hasBetterMatch);
  const count = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
  const Icon = item.icon;
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const setTrainingEnabled = useAppStore((s) => s.setTrainingEnabled);
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const setRecruitmentEnabled = useAppStore((s) => s.setRecruitmentEnabled);
  const isTrainingRow = item.label === 'Training';
  const isRecruitmentLeaf = item.label === 'Recruitment';
  const leafEnabled = isTrainingRow ? trainingEnabled : recruitmentEnabled;
  const setLeafEnabled = isTrainingRow ? setTrainingEnabled : setRecruitmentEnabled;

  // Training (and any module leaf) gets an inline toggle where the chevron sits.
  if ((isTrainingRow || isRecruitmentLeaf) && Icon && item.to) {
    return (
      <div
        className={`sub-group-row${isActive ? ' active section-active' : ''}${leafEnabled ? '' : ' opacity-60'}`}
        title={item.label}
      >
        <NavLink
          to={leafEnabled ? item.to : '#'}
          end
          onClick={(e) => {
            if (!leafEnabled) e.preventDefault();
          }}
          className={`flex items-center gap-2 flex-1 min-w-0${leafEnabled ? '' : ' pointer-events-none'}`}
        >
          <Icon size={16} strokeWidth={2} className="nav-ico" />
          <span className="nav-txt">{item.label}</span>
          <NavBadge count={count} color={item.badgeColor} />
        </NavLink>
        <ModuleToggle enabled={leafEnabled} onToggle={setLeafEnabled} label={item.label} />
      </div>
    );
  }

  // Icon leaves (e.g. CRM > Dashboard, Sales > Proforma Invoices, etc.) render like nav row with icon
  if (Icon && item.to) {
    return (
      <NavLink
        to={item.to}
        end
        title={item.label}
        className={({ isActive: navActive }) =>
          `sub-group-row${isActive || navActive ? ' active section-active' : ''}`
        }
      >
        <Icon size={16} strokeWidth={2} className="nav-ico" />
        <span className="nav-txt">{item.label}</span>
        <NavBadge count={count} color={item.badgeColor} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.to || '#'}
      end
      title={item.label}
      className={({ isActive: navActive }) =>
        `sub-item${isActive || navActive ? ' active section-active' : ''}`
      }
    >
      <span className="sub-dot" />
      <span className="sub-label">{item.label}</span>
      <NavBadge count={count} color={item.badgeColor} />
    </NavLink>
  );
}

// ── Sub-list (group of sub-items) ───────────────────────────
function SubList({ items, depth = 1, badges }) {
  const isDeep = depth >= 2;
  return (
    <div className={isDeep ? 'sub-list-deep' : 'sub-list'}>
      {items.map((item) => {
        if (item.children) {
          return (
            <ExpandableRow key={item.label} item={item} depth={depth} badges={badges} />
          );
        }
        return <SubItem key={item.label} item={item} depth={depth} badges={badges} />;
      })}
    </div>
  );
}

// ── Oscar fabric footer (sidebar bottom, Tailwind) ──
// Photo comes from `public/fabric.png` (`public/febric.png` also tried).
// If neither file exists yet, the teal gradient alone still shows.
function FabricFooter() {
  const [src, setSrc] = useState('/guide/febric.png');
  const fallbacks = ['/guide/febric.png', '/fabric.png', '/febric.png'];
  return (
    <div className="relative -ml-[14px] -mr-3 mt-auto h-64 shrink-0 select-none overflow-hidden" aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28%)',
            maskImage: 'linear-gradient(to bottom, transparent 0, black 28%)',
          }}
          onError={() => {
            const next = fallbacks[fallbacks.indexOf(src) + 1] || null;
            setSrc(next);
          }}
        />
      ) : (
        <svg viewBox="0 0 200 160" className="absolute inset-0 h-full w-full text-teal-300/40" fill="none" preserveAspectRatio="none">
          <path d="M0 70 C 30 50, 55 90, 85 70 S 145 40, 200 62" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
          <path d="M0 90 C 35 70, 60 110, 95 90 S 150 60, 200 82" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
          <path d="M0 110 C 40 90, 70 125, 105 108 S 160 80, 200 100" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <path d="M0 130 C 40 112, 70 140, 105 128 S 160 102, 200 118" stroke="currentColor" strokeWidth="1" opacity="0.18" />
        </svg>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#071f2b]/20 to-[#071f2b]/85" />
      <div className="absolute left-4 bottom-24 border-l-2 border-teal-300/80 pl-2.5">
        <p className="text-[11px] font-bold tracking-[0.24em] text-white/95 leading-[1.75]">
          WEAVE<br />PROCESS<br />GROW
        </p>
      </div>
    </div>
  );
}

// ── Inline module toggle (sidebar ">" position) ──
// Uses a hidden checkbox + label so clicks are fully isolated from any parent
// button. The label's onChange fires the store setter directly.
function ModuleToggle({ enabled, onToggle, label }) {
  const id = `mod-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label
      htmlFor={id}
      title={`${label} ${enabled ? 'ON — click to hide module' : 'OFF — click to show module'}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`relative inline-flex shrink-0 w-9 h-5 rounded-full cursor-pointer ring-1 transition-colors ${
        enabled ? 'bg-emerald-500 ring-emerald-300/60' : 'bg-slate-500/70 ring-white/25'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Toggle ${label} module`}
        className="sr-only"
      />
      <span
        className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all ${
          enabled ? 'left-[18px]' : 'left-[2px]'
        }`}
      />
    </label>
  );
}

// ── Expandable group row ────────────────────────────────────
function ExpandableRow({ item, depth = 0, badges = {} }) {
  const location = useLocation();
  const [open, setOpen] = useState(Boolean(item.defaultOpen));
  const Icon = item.icon;
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const setRecruitmentEnabled = useAppStore((s) => s.setRecruitmentEnabled);
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const setTrainingEnabled = useAppStore((s) => s.setTrainingEnabled);

  const isModuleRow = item.label === 'Recruitment' || item.label === 'Training';
  const moduleEnabled = item.label === 'Recruitment' ? recruitmentEnabled : trainingEnabled;
  const setModuleEnabled = item.label === 'Recruitment' ? setRecruitmentEnabled : setTrainingEnabled;

  // Auto-open if a child route is active
  const isChildActive = item.children?.some(
    (c) => (c.to && (location.pathname === c.to || location.pathname.startsWith(c.to + '/'))) ||
      (c.children?.some((sub) => sub.to && (location.pathname === sub.to || location.pathname.startsWith(sub.to + '/'))))
  );

  useEffect(() => {
    if (isChildActive) {
      setOpen(true);
    }
  }, [isChildActive]);

  const isActive = item.to && (location.pathname === item.to || location.pathname.startsWith(item.to + '/'));

  if (item.to && !item.children) {
    // Training is a direct link — render link + inline toggle in chevron spot.
    if (item.label === 'Training') {
      return (
        <div className={`nav-row group ${moduleEnabled ? '' : 'opacity-60'}`} title={item.label}>
          <NavLink
            to={moduleEnabled ? item.to : '#'}
            end
            onClick={(e) => {
              if (!moduleEnabled) e.preventDefault();
            }}
            className={`flex items-center gap-2 flex-1 min-w-0 ${moduleEnabled ? '' : 'pointer-events-none'}`}
          >
            {Icon && <Icon size={18} strokeWidth={1.9} className="nav-ico" />}
            <span className="nav-txt">{item.label}</span>
          </NavLink>
          <ModuleToggle enabled={moduleEnabled} onToggle={setModuleEnabled} label={item.label} />
        </div>
      );
    }
    // Simple root nav row (direct link like Parties, Reports)
    return (
      <NavLink
        to={item.to}
        end
        title={item.label}
        className={({ isActive: directActive }) =>
          `nav-row${directActive || isActive ? ' section-active' : ''}`
        }
      >
        {Icon && <Icon size={18} strokeWidth={1.9} className="nav-ico" />}
        <span className="nav-txt">{item.label}</span>
      </NavLink>
    );
  }

  const isRoot = depth === 0;
  const groupCount = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
  // Recruitment OFF → keep the row (so the toggle stays reachable) but hide children.
  const showChildren = isModuleRow ? (moduleEnabled && open) : open;

  if (isModuleRow) {
    return (
      <div className="nav-group">
        <div
          title={item.label}
          className={
            isRoot
              ? `nav-row${isChildActive ? ' parent-active' : isActive ? ' section-active' : ''}${!moduleEnabled ? ' opacity-60' : ''}`
              : `sub-group-row${isChildActive ? ' parent-active' : ''}`
          }
        >
          <button
            type="button"
            onClick={() => {
              if (!moduleEnabled) return;
              setOpen((v) => !v);
            }}
            className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-0 p-0 text-left cursor-pointer"
          >
            {Icon && <Icon size={isRoot ? 18 : 16} strokeWidth={1.9} className="nav-ico" />}
            <span className="nav-txt">{item.label}</span>
            <NavBadge count={groupCount} color={item.badgeColor} />
          </button>
          <ModuleToggle enabled={moduleEnabled} onToggle={setModuleEnabled} label={item.label} />
        </div>
        {showChildren && item.children && (
          <SubList items={item.children} depth={depth + 1} badges={badges} />
        )}
      </div>
    );
  }

  return (
    <div className="nav-group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={item.label}
        className={
          isRoot
            ? `nav-row${isChildActive ? ' parent-active' : isActive ? ' section-active' : ''}`
            : `sub-group-row${isChildActive ? ' parent-active' : ''}`
        }
      >
        {Icon && <Icon size={isRoot ? 18 : 16} strokeWidth={1.9} className="nav-ico" />}
        <span className="nav-txt">{item.label}</span>
        <NavBadge count={groupCount} color={item.badgeColor} />
        {item.children && (
          <span className="nav-chev">
            {open ? <ChevronDown size={isRoot ? 14 : 12} /> : <ChevronRight size={isRoot ? 14 : 12} />}
          </span>
        )}
      </button>
      {showChildren && item.children && (
        <SubList items={item.children} depth={depth + 1} badges={badges} />
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────
export default function Sidebar() {
  const navigate = useNavigate();
  const sidebarWidth = useAppStore((s) => s.sidebarWidth) ?? 280;
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen);
  const currentUser = useAppStore((s) => s.currentUser);
  const theme = useAppStore((s) => s.theme) || 'light';
  const setTheme = useAppStore((s) => s.setTheme);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startWidth: sidebarWidth });

  const filteredNav = useMemo(() => filterNavTree(NAV, searchQuery), [searchQuery]);

  // Module rows stay visible so their inline toggle is always reachable.
  // OFF only hides children + blocks routes (see routes/index.jsx guard).
  const visibleNav = filteredNav;

  // PMS live nav counters. Subscribe to stable slices and derive, so the
  // selector never hands useSyncExternalStore a fresh object each render.
  //
  // `.raw` subscribes without pulling PMS: a badge in the sidebar must not be
  // the reason every screen in the app loads the project list. `useModuleWhenIdle`
  // asks for it once the browser has finished with the page the user opened.
  const shellReady = useModuleWhenIdle('pms');
  const pmsProjects = usePmsStore.raw((s) => s.projects);
  const pmsCurrentUserId = usePmsStore.raw((s) => s.currentUserId);
  const pmsBadges = useMemo(
    () => computeNavBadges(pmsProjects, pmsCurrentUserId),
    [pmsProjects, pmsCurrentUserId]
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let badges = { zone: 0, faulty: 0, ...pmsBadges };
  try {
    const erp = useERP();
    // Reading these is what loads them, so they wait for the same idle moment.
    if (erp && shellReady) {
      badges.zone = erp.zoneRequests?.filter((r) => r.status === 'Requested')?.length || 0;
      badges.faulty = erp.faultyParts?.filter((f) => f.status === 'Reported' || f.status === 'Sent for Replacement')?.length || 0;
    }
  } catch { }

  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const nextWidth = Math.min(380, Math.max(240, dragRef.current.startWidth + dx));
      setSidebarWidth(nextWidth);
    }

    function handleUp() {
      dragRef.current.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    }

    if (dragRef.current.dragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [setSidebarWidth]);

  function handleResizeStart(e) {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handleMove(ev) {
      const dx = ev.clientX - dragRef.current.startX;
      const nextWidth = Math.min(380, Math.max(240, dragRef.current.startWidth + dx));
      setSidebarWidth(nextWidth);
    }

    function handleUp() {
      dragRef.current.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  // Mobile drawer: any link inside the sidebar dismisses it (including a
  // re-click on the current route, which does not change the pathname).
  function handleNavClick(e) {
    if (e.target.closest?.('a[href]')) setMobileSidebarOpen(false);
  }

  return (
    <>
    <aside className="sidebar" style={{ width: sidebarWidth }} onClick={handleNavClick}>
      <div className="side-top">
        {/* Brand Header */}
        <div className="brand-block">
          <div className="brand-left">
            <span className="brand-logo">
              <InfinityIcon size={28} strokeWidth={2.6} />
            </span>
            <div className="min-w-0">
              <div className="brand-name">EVENMORE INFOTECH</div>
              <div className="brand-tag">PEOPLE | PROCESS | PROGRESS</div>
            </div>
          </div>
          {/* Mobile drawer close (below lg only) */}
          <button
            type="button"
            className="brand-menu sidebar-mobile-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar Above Navigation */}
        <div className="px-1 pb-2.5 pt-0.5">
          <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:border-blue-400/60 focus-within:bg-white/10 transition-all">
            <Search size={14} className="ml-2.5 text-slate-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tabs & menus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-400 py-2 pl-2 pr-7 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="side-nav" aria-label="Primary navigation">
          {visibleNav.length > 0 ? (
            visibleNav.map((item) => (
              <ExpandableRow key={item.label} item={item} depth={0} badges={badges} />
            ))
          ) : (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              <p>No tabs match &ldquo;{searchQuery}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-blue-400 hover:underline text-[11px] cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Oscar fabric footer — photo from public/fabric.png with tagline */}
      {theme === 'oscar' && (
        <FabricFooter />
      )}

      {/* Sticky Bottom User Profile Widget (overlaid on fabric in Oscar theme) */}
      <div
        className={
          theme === 'oscar'
            ? 'relative z-10 -mt-24 -mb-[14px] border-0 bg-transparent px-4 pb-5'
            : 'pt-2 px-1 pb-1 mt-auto border-t border-white/10 relative'
        }
        ref={profileRef}
      >
        <button
          type="button"
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition cursor-pointer text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20">
              {currentUser?.initials || '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {currentUser?.name || 'Signed out'}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                {currentUser?.role || ''}
              </p>
            </div>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-400 group-hover:text-white transition-transform duration-150 ${isProfileOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Rich Theme-Adaptive Profile Popup Menu */}
        {isProfileOpen && (
          <div className="absolute bottom-full left-1 right-1 mb-2 p-3 rounded-2xl bg-[#0f172a]/95 border border-white/20 text-white shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl ring-1 ring-black/40">
            {/* User Profile Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/20">
                {currentUser?.initials || '—'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold truncate text-white">{currentUser?.name || 'Signed out'}</p>
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate">{currentUser?.email || ''}</p>
                <div className="mt-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-blue-300 border border-white/10">
                    {currentUser?.role || ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Theme Switcher */}
            <div className="pb-2.5 mb-2.5 border-b border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Theme Mode</span>
                <span className="text-[9px] text-blue-400 capitalize">{theme}</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {SIDEBAR_THEMES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                      }`}
                      title={t.name}
                    >
                      <Icon size={12} className="mb-0.5" />
                      <span className="text-[9px] leading-none">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="space-y-0.5 text-xs">
              <Link
                to="/hrms/dashboard"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <User size={13} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">HR Profile & Attendance</span>
              </Link>
              <Link
                to="/administration/users"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <ShieldCheck size={13} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">Administration & Roles</span>
              </Link>
              <Link
                to="/administration/settings"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <Settings size={13} className="text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">System Preferences & Currency</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsGuideOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition text-left cursor-pointer group"
              >
                <BookOpen size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">Interactive User Guides</span>
              </button>

              {/* Sign Out / Switch User Button in Person Profile */}
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  clearStoredAuth();
                  navigate('/login');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 transition text-left cursor-pointer group mt-1"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={13} className="text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium">Log Out / Switch Account</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-medium">
                  Login
                </span>
              </button>
            </div>

            {/* Footer / Session */}
            <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="text-[9px] text-slate-400">Evenmore Cloud v2.6</span>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  clearStoredAuth();
                  navigate('/login');
                }}
                className="hover:text-rose-400 flex items-center gap-1 cursor-pointer transition text-slate-300"
                title="Lock Session & Return to Login"
              >
                <Lock size={10} />
                <span>Lock</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visual Drag Handle for Sidebar Width (hidden below lg) */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar width"
      >
        <div className="resize-thumb" />
      </div>
    </aside>

    {/* Interactive Global User Guide Modal — rendered outside the aside so the
        mobile drawer's transform never becomes its containing block. */}
    <UserGuideModal
      isOpen={isGuideOpen}
      onClose={() => setIsGuideOpen(false)}
    />
    </>
  );
}
