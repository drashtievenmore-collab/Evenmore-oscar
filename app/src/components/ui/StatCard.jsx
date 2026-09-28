import { TrendingUp, TrendingDown, Users, Filter, Clock, BarChart3, DollarSign, Package, ShoppingCart, FileText } from 'lucide-react';

const ICONS = {
  users: Users,
  filter: Filter,
  clock: Clock,
  chart: BarChart3,
  bars: BarChart3,
  dollar: DollarSign,
  package: Package,
  cart: ShoppingCart,
  file: FileText,
};

const TONES = {
  blue: { bg: 'rgba(31, 107, 255, 0.12)', fg: '#1f6bff' },
  green: { bg: 'rgba(27, 184, 120, 0.12)', fg: '#1bb878' },
  pink: { bg: 'rgba(255, 79, 143, 0.12)', fg: '#ff4f8f' },
  amber: { bg: 'rgba(239, 155, 6, 0.12)', fg: '#ef9b06' },
  purple: { bg: 'rgba(155, 81, 224, 0.12)', fg: '#9b51e0' },
  teal: { bg: 'rgba(12, 177, 172, 0.12)', fg: '#0cb1ac' },
};

/**
 * StatCard — CRM-styled stat card with icon, value, label, trend.
 * Supports:
 *   1) <StatCard stat={{ icon, value, label, trend, trendDirection, note, tone }} />
 *   2) <StatCard title="Total" value="$500" icon={IconComponent} change="+5%" isPositive={true} />
 */
export function StatCard(props) {
  const rawStat = props.stat || {};
  const label = rawStat.label || props.label || props.title || '';
  const value = rawStat.value ?? props.value ?? '';
  const icon = rawStat.icon || props.icon;
  const tone = rawStat.tone || props.tone || props.color || 'blue';
  const rawTrend = rawStat.trend ?? props.trend ?? rawStat.change ?? props.change;
  const note = rawStat.note || props.note || props.subtitle || props.period || '';

  let trendText = null;
  let isUp = true;

  if (typeof rawTrend === 'string' || typeof rawTrend === 'number') {
    trendText = String(rawTrend);
  } else if (rawTrend && typeof rawTrend === 'object') {
    trendText = rawTrend.text || rawTrend.value || rawTrend.label || '';
    if (rawTrend.positive !== undefined) {
      isUp = Boolean(rawTrend.positive);
    } else if (rawTrend.isPositive !== undefined) {
      isUp = Boolean(rawTrend.isPositive);
    }
  }

  if (props.isPositive !== undefined) {
    isUp = Boolean(props.isPositive);
  } else if (rawStat.isPositive !== undefined) {
    isUp = Boolean(rawStat.isPositive);
  } else if (props.trendDirection) {
    isUp = props.trendDirection !== 'down';
  } else if (rawStat.trendDirection) {
    isUp = rawStat.trendDirection !== 'down';
  }

  const Icon = typeof icon === 'function' ? icon : (ICONS[icon] ?? Users);
  const toneStyle = tone && TONES[tone] ? TONES[tone] : TONES.blue;
  const bg = rawStat.badgeBg || props.badgeBg || toneStyle.bg;
  const fg = rawStat.iconColor || props.iconColor || toneStyle.fg;

  return (
    <article className="stat-card">
      <span className="stat-badge" style={{ background: bg, color: fg }}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="stat-body">
        <strong className="stat-num" title={String(value)}>{value}</strong>
        <span className="stat-label" title={label}>{label}</span>
        {trendText && (
          <p className={`stat-trend ${isUp ? 'up' : 'down'}`}>
            {isUp ? <TrendingUp size={13} className="shrink-0" /> : <TrendingDown size={13} className="shrink-0" />}
            <b className="shrink-0">{trendText}</b>
            {note && <em className="truncate">{note}</em>}
          </p>
        )}
      </div>
    </article>
  );
}

export function MetricChip({ icon: Icon, label, value, colorScheme = 'blue', onClick }) {
  const schemeColors = {
    rose: { bg: 'rgba(255, 79, 143, 0.08)', border: 'rgba(255, 79, 143, 0.25)', text: '#d92569', iconBg: 'rgba(255, 79, 143, 0.15)', iconFg: '#d92569' },
    emerald: { bg: 'rgba(27, 184, 120, 0.08)', border: 'rgba(27, 184, 120, 0.25)', text: '#0e7c4f', iconBg: 'rgba(27, 184, 120, 0.15)', iconFg: '#0e7c4f' },
    purple: { bg: 'rgba(155, 81, 224, 0.08)', border: 'rgba(155, 81, 224, 0.25)', text: '#732ebd', iconBg: 'rgba(155, 81, 224, 0.15)', iconFg: '#732ebd' },
    amber: { bg: 'rgba(239, 155, 6, 0.08)', border: 'rgba(239, 155, 6, 0.25)', text: '#b87200', iconBg: 'rgba(239, 155, 6, 0.15)', iconFg: '#b87200' },
    blue: { bg: 'rgba(31, 107, 255, 0.08)', border: 'rgba(31, 107, 255, 0.25)', text: '#1550c6', iconBg: 'rgba(31, 107, 255, 0.15)', iconFg: '#1550c6' },
    teal: { bg: 'rgba(12, 177, 172, 0.08)', border: 'rgba(12, 177, 172, 0.25)', text: '#097a76', iconBg: 'rgba(12, 177, 172, 0.15)', iconFg: '#097a76' },
    yellow: { bg: 'rgba(239, 155, 6, 0.08)', border: 'rgba(239, 155, 6, 0.25)', text: '#b87200', iconBg: 'rgba(239, 155, 6, 0.15)', iconFg: '#b87200' },
  };

  const s = schemeColors[colorScheme] || schemeColors.blue;

  return (
    <div
      onClick={onClick}
      className="kpi-std flex items-start"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {Icon && (
        <div
          className="kpi-badge-std flex items-center justify-center"
          style={{
            background: s.iconBg,
            color: s.iconFg,
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#7184a3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: s.text, lineHeight: 1.2 }}>{value}</p>
      </div>
    </div>
  );
}

export default StatCard;

