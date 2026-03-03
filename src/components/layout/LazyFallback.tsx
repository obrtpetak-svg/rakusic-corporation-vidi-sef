export const SkeletonBlock = ({ w = '100%', h = 16, r = 8, style = {} }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'var(--divider)', animation: 'shimmer 1.5s ease infinite', ...style }} />
);
export const LazyFallback = ({ type = 'dashboard' }) => {
    if (type === 'table') return (
        <div className="skel-root">
            <div className="skel-header">
                <SkeletonBlock w={160} h={28} r={10} />
                <SkeletonBlock w={130} h={40} r={12} />
            </div>
            <div className="skel-filter-bar">
                <SkeletonBlock h={40} r={8} style={{ flex: 1 }} />
                <SkeletonBlock w={140} h={40} r={8} />
                <SkeletonBlock w={100} h={40} r={8} />
            </div>
            <div className="skel-table-head">
                {[60, 100, 80, 70, 50, 90].map((w, i) => <SkeletonBlock key={i} w={w} h={10} r={4} />)}
            </div>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skel-table-row">
                    <SkeletonBlock w={70} h={14} r={4} />
                    <div className="skel-row-inner">
                        <SkeletonBlock w={28} h={28} r={14} />
                        <SkeletonBlock w={90 + (i % 3) * 20} h={14} r={4} />
                    </div>
                    <SkeletonBlock w={80} h={14} r={4} />
                    <SkeletonBlock w={50} h={14} r={4} />
                    <SkeletonBlock w={60} h={24} r={12} />
                    <SkeletonBlock w={70} h={24} r={6} />
                </div>
            ))}
        </div>
    );
    if (type === 'cards') return (
        <div className="skel-root">
            <div className="skel-header">
                <SkeletonBlock w={140} h={28} r={10} />
                <SkeletonBlock w={140} h={40} r={12} />
            </div>
            <div className="skel-filter-bar">
                <SkeletonBlock h={40} r={8} style={{ flex: 1 }} />
                <SkeletonBlock w={140} h={40} r={8} />
            </div>
            <div className="skel-card-grid">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skel-card">
                        <div className="skel-card-head">
                            <SkeletonBlock w={44} h={44} r={22} />
                            <div className="skel-flex-1"><SkeletonBlock w={120} h={14} r={4} /><SkeletonBlock w={80} h={12} r={4} style={{ marginTop: 6 }} /></div>
                        </div>
                        <div className="skel-card-mid">
                            <SkeletonBlock w={90} h={12} r={4} />
                            <SkeletonBlock w={80} h={12} r={4} />
                        </div>
                        <div className="skel-card-foot">
                            <SkeletonBlock w={70} h={12} r={4} />
                            <div className="skel-gap-6">
                                <SkeletonBlock w={80} h={28} r={6} />
                                <SkeletonBlock w={28} h={28} r={6} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    // Default: dashboard skeleton
    return (
        <div className="skel-root">
            <div className="skel-header">
                <div><SkeletonBlock w={200} h={28} r={10} /><SkeletonBlock w={140} h={14} style={{ marginTop: 8 }} /></div>
                <SkeletonBlock w={120} h={40} r={12} />
            </div>
            <div className="skel-stat-grid">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="skel-stat-card">
                        <SkeletonBlock w={48} h={48} r={14} />
                        <div className="skel-flex-1"><SkeletonBlock w={60} h={10} /><SkeletonBlock w={80} h={24} style={{ marginTop: 6 }} /><SkeletonBlock w={50} h={10} style={{ marginTop: 4 }} /></div>
                    </div>
                ))}
            </div>
            <div className="skel-content-grid">
                <div className="skel-content-card skel-content-main">
                    <SkeletonBlock w={180} h={16} r={8} style={{ marginBottom: 16 }} />
                    <SkeletonBlock h={160} r={10} />
                </div>
                <div className="skel-content-card">
                    <SkeletonBlock w={100} h={16} r={8} style={{ marginBottom: 16 }} />
                    {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} h={40} r={10} style={{ marginBottom: 8 }} />)}
                </div>
            </div>
        </div>
    );
};
