import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './SharedComponents';

/**
 * EditableField — click-to-edit inline field component.
 * Usage:
 *   <EditableField value={worker.phone} onSave={(v) => update('phone', v)} label="Telefon" type="tel" />
 */
export function EditableField({ value, onSave, label, type = 'text', placeholder = '—' }) {
    const [editing, setEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value || '');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef();

    useEffect(() => {
        if (editing) {
            setTempValue(value || '');
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [editing, value]);

    const handleSave = async () => {
        if (tempValue === (value || '')) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(tempValue);
            setEditing(false);
        } catch (e) {
            console.error('EditableField save error:', e);
        }
        setSaving(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') { setTempValue(value || ''); setEditing(false); }
    };

    if (editing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {label && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, minWidth: 60 }}>{label}</span>}
                <input
                    ref={inputRef}
                    type={type}
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    disabled={saving}
                    style={{
                        flex: 1, fontSize: 13, fontWeight: 500,
                        padding: '5px 8px', borderRadius: 6,
                        border: '1px solid var(--accent)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color 0.15s ease',
                        boxShadow: '0 0 0 2px var(--input-focus-ring)'
                    }}
                />
                {saving && <span style={{ fontSize: 12, color: 'var(--accent)' }}>⏳</span>}
            </div>
        );
    }

    return (
        <div
            onClick={() => setEditing(true)}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', padding: '3px 0',
                borderRadius: 4,
                transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title={`Uredi ${label || ''}`}
        >
            {label && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, minWidth: 60 }}>{label}</span>}
            <span style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-muted)', fontWeight: 500, flex: 1 }}>
                {value || placeholder}
            </span>
            <Icon name="edit" size={12} style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }} />
        </div>
    );
}
