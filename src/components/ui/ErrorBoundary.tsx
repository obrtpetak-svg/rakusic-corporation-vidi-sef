import { C, styles } from '../../utils/helpers';

/**
 * Reusable Error Boundary with retry and fallback UI.
 * Wrap around feature sections that might fail independently.
 * 
 * Usage:
 *   <FeatureErrorBoundary name="GPS Module">
 *     <GpsAdminPanel />
 *   </FeatureErrorBoundary>
 */
export class FeatureErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error(`[${this.props.name || 'Feature'}] Error:`, error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    ...styles.card,
                    textAlign: 'center',
                    padding: '40px 24px',
                    border: '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(239,68,68,0.04)',
                }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                        {this.props.name ? `Greška u modulu: ${this.props.name}` : 'Došlo je do greške'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
                        {this.state.error?.message || 'Neočekivana greška. Pokušajte ponovo.'}
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            ...styles.btn,
                            background: 'var(--accent)',
                            color: 'var(--text-on-accent)',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            padding: '10px 20px',
                        }}
                    >
                        🔄 Pokušaj ponovo
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default FeatureErrorBoundary;
