import { styles } from '../../utils/helpers';

// Shimmer keyframes injection
if (typeof document !== 'undefined' && !document.getElementById('shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'shimmer-style';
    style.textContent = `@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`;
    document.head.appendChild(style);
}

export const SkeletonLoader = ({ type = 'card', count = 1 }) => {
    const items = Array.from({ length: count });
    if (type === 'stats') return <div className="stats-grid">{items.map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}</div>;
    if (type === 'table') return <div style={{ padding: 16 }}>{items.map((_, i) => <div key={i} className="skeleton skeleton-row" />)}</div>;
    if (type === 'text') return <div style={{ padding: 8 }}><div className="skeleton skeleton-text long" /><div className="skeleton skeleton-text medium" /><div className="skeleton skeleton-text short" /></div>;
    return <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>{items.map((_, i) => <div key={i} className="skeleton skeleton-card" />)}</div>;
};

export const SkeletonLine = ({ width = '100%', height = 14, style: sx = {} }) => (
    <div style={{ width, height, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 37%, rgba(255,255,255,0.04) 63%)', backgroundSize: '800px 100%', animation: 'shimmer 1.5s ease-in-out infinite', ...sx }} />
);

export const SkeletonCard = ({ lines = 3, style: sx = {} }) => (
    <div style={{ ...styles.card, ...sx }}>
        <SkeletonLine width="40%" height={18} className="u-mb-16" />
        {Array.from({ length: lines }).map((_, i) => <SkeletonLine key={i} width={`${85 - i * 15}%`} className="u-mb-12" style={{ marginBottom: 10 }} />)}
    </div>
);

export const SkeletonStatCards = ({ count = 4 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)`, gap: 16, marginBottom: 28 }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 16 }}>
                <SkeletonLine width={44} height={44} style={{ borderRadius: 12, flexShrink: 0 }} />
                <div className="u-flex-1"><SkeletonLine width="60%" height={12} style={{ marginBottom: 8 }} /><SkeletonLine width="40%" height={22} /></div>
            </div>
        ))}
    </div>
);
