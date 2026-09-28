const tones = {
  blue: ['#eff6ff', '#dbeafe', '#dbeafe', '#3b82f6'],
  emerald: ['#f0fdf4', '#d1fae5', '#d1fae5', '#059669'],
  rose: ['#fff1f2', '#ffe4e6', '#ffe4e6', '#f43f5e'],
  purple: ['#faf5ff', '#f3e8ff', '#f3e8ff', '#a855f7'],
  amber: ['#fffbeb', '#fef3c7', '#fef3c7', '#d97706'],
  sky: ['#f0f9ff', '#e0f2fe', '#e0f2fe', '#0284c7'],
  teal: ['#f0fdfa', '#ccfbf1', '#ccfbf1', '#0d9488'],
  orange: ['#fff7ed', '#ffedd5', '#ffedd5', '#ea580c'],
};

export default function KpiCard({ label, value, icon: Icon, symbol, tone = 'blue', children }) {
  const [background, borderColor, iconBackground, color] = tones[tone] || tones.blue;

  return (
    <article
      className="kpi-std flex min-w-0 items-center border"
      style={{ background, borderColor }}
    >
      <span
        className="kpi-badge-std grid shrink-0 place-items-center text-xl font-bold"
        style={{ background: iconBackground, color }}
      >
        {Icon ? <Icon size={20} strokeWidth={2} aria-hidden="true" /> : symbol}
      </span>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-slate-500">{label}</span>
        <strong className="block break-words text-[20px] font-bold leading-6 text-slate-900">{value}</strong>
        {children}
      </div>
    </article>
  );
}
