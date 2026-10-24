const tones = {
  blue: {
    cardBg: 'linear-gradient(135deg, #eff6ff 0%, #f7faff 55%, #ffffff 100%)',
    border: '#bfdbfe',
    accent: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
    iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    iconShadow: 'rgba(37, 99, 235, 0.35)',
    label: '#1d4ed8',
  },
  emerald: {
    cardBg: 'linear-gradient(135deg, #ecfdf5 0%, #f5fcf8 55%, #ffffff 100%)',
    border: '#a7f3d0',
    accent: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
    iconBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    iconShadow: 'rgba(5, 150, 105, 0.35)',
    label: '#047857',
  },
  rose: {
    cardBg: 'linear-gradient(135deg, #fff1f2 0%, #fff7f8 55%, #ffffff 100%)',
    border: '#fecdd3',
    accent: 'linear-gradient(180deg, #fb7185 0%, #e11d48 100%)',
    iconBg: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    iconShadow: 'rgba(225, 29, 72, 0.35)',
    label: '#be123c',
  },
  purple: {
    cardBg: 'linear-gradient(135deg, #faf5ff 0%, #fbf8ff 55%, #ffffff 100%)',
    border: '#e9d5ff',
    accent: 'linear-gradient(180deg, #c084fc 0%, #9333ea 100%)',
    iconBg: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
    iconShadow: 'rgba(147, 51, 234, 0.35)',
    label: '#7e22ce',
  },
  amber: {
    cardBg: 'linear-gradient(135deg, #fffbeb 0%, #fffdf4 55%, #ffffff 100%)',
    border: '#fde68a',
    accent: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    iconShadow: 'rgba(217, 119, 6, 0.35)',
    label: '#b45309',
  },
  sky: {
    cardBg: 'linear-gradient(135deg, #f0f9ff 0%, #f6fbff 55%, #ffffff 100%)',
    border: '#bae6fd',
    accent: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
    iconBg: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
    iconShadow: 'rgba(2, 132, 199, 0.35)',
    label: '#0369a1',
  },
  teal: {
    cardBg: 'linear-gradient(135deg, #f0fdfa 0%, #f5fcfb 55%, #ffffff 100%)',
    border: '#99f6e4',
    accent: 'linear-gradient(180deg, #2dd4bf 0%, #0d9488 100%)',
    iconBg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
    iconShadow: 'rgba(13, 148, 136, 0.35)',
    label: '#0f766e',
  },
  orange: {
    cardBg: 'linear-gradient(135deg, #fff7ed 0%, #fffaf3 55%, #ffffff 100%)',
    border: '#fed7aa',
    accent: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
    iconBg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
    iconShadow: 'rgba(234, 88, 12, 0.35)',
    label: '#c2410c',
  },
  indigo: {
    cardBg: 'linear-gradient(135deg, #eef2ff 0%, #f8faff 55%, #ffffff 100%)',
    border: '#c7d2fe',
    accent: 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)',
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    iconShadow: 'rgba(79, 70, 229, 0.35)',
    label: '#4338ca',
  },
  cyan: {
    cardBg: 'linear-gradient(135deg, #ecfeff 0%, #f6feff 55%, #ffffff 100%)',
    border: '#a5f3fc',
    accent: 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)',
    iconBg: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
    iconShadow: 'rgba(8, 145, 178, 0.35)',
    label: '#0e7490',
  },
  slate: {
    cardBg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 55%, #ffffff 100%)',
    border: '#cbd5e1',
    accent: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
    iconBg: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
    iconShadow: 'rgba(71, 85, 105, 0.35)',
    label: '#334155',
  },
};

// Aliases for intuitive colors
tones.green = tones.emerald;
tones.red = tones.rose;
tones.yellow = tones.amber;
tones.violet = tones.purple;
tones.gray = tones.slate;

export default function KpiCard({
  label,
  value,
  icon: Icon,
  symbol,
  tone = 'blue',
  sub,
  subtext,
  subtitle,
  unit,
  onClick,
  className = '',
  children,
}) {
  const palette = tones[tone] || tones.blue;
  const secondaryText = sub || subtext || subtitle;

  return (
    <article
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`kpi-std group relative flex min-w-0 items-center overflow-hidden border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={{ background: palette.cardBg, borderColor: palette.border }}
    >
      {/* Gradient accent bar */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: palette.accent }}
      />

      <span
        className="kpi-badge-std grid shrink-0 place-items-center text-white transition-transform duration-200 group-hover:scale-105"
        style={{ background: palette.iconBg, boxShadow: `0 8px 16px -6px ${palette.iconShadow}` }}
      >
        {Icon ? <Icon size={22} strokeWidth={2.1} aria-hidden="true" /> : <span className="text-xl font-extrabold">{symbol}</span>}
      </span>

      <div className="min-w-0 flex-1">
        <span
          className="block text-[11px] font-bold uppercase leading-4 tracking-[0.06em] truncate"
          style={{ color: palette.label }}
          title={label}
        >
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <strong className="block break-words text-[22px] font-extrabold leading-6 text-slate-900">
            {value}
          </strong>
          {unit && (
            <span className="text-xs font-semibold text-slate-500">
              {unit}
            </span>
          )}
        </div>
        {children}
        {!children && secondaryText && (
          <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500" title={secondaryText}>
            {secondaryText}
          </span>
        )}
      </div>
    </article>
  );
}
