import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { C, styles } from '../../utils/helpers';

// ── Types ────────────────────────────────────────────────────────────────

interface ConfirmOptions {
    danger?: boolean;
}

interface ConfirmState {
    message: string;
    danger: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

interface ConfirmProviderProps {
    children: ReactNode;
}

// ── Context ──────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));
export const useConfirm = (): ConfirmFn => useContext(ConfirmContext);

// ── Provider ─────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: ConfirmProviderProps): React.JSX.Element {
    const [state, setState] = useState<ConfirmState | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm: ConfirmFn = useCallback((message, { danger = false } = {}) => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({
                message,
                danger: danger || message?.includes?.('brisat') || message?.includes?.('obrisat') || message?.includes?.('Obrisat') || false,
            });
        });
    }, []);

    // Keep window.confirm as native fallback (can't override sync with async)
    useEffect(() => {
        const originalConfirm = window.confirm;
        return () => { window.confirm = originalConfirm; };
    }, []);

    const handleConfirm = (): void => { resolveRef.current?.(true); setState(null); };
    const handleCancel = (): void => { resolveRef.current?.(false); setState(null); };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.15s ease',
                }} onClick={handleCancel}>
                    <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{
                        background: 'var(--card)', borderRadius: 16, padding: 28,
                        maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.2s ease',
                    }}>
                        <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
                            {state.message}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={handleCancel} style={{
                                ...styles.btnSecondary, padding: '10px 20px', fontSize: 14,
                                borderRadius: 10, fontWeight: 600,
                            }}>
                                Odustani
                            </button>
                            <button onClick={handleConfirm} autoFocus style={{
                                ...(state.danger ? styles.btnDanger : styles.btn),
                                padding: '10px 20px', fontSize: 14, borderRadius: 10, fontWeight: 600,
                                minWidth: 100,
                            }}>
                                {state.danger ? '🗑️ Obriši' : '✓ Potvrdi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
