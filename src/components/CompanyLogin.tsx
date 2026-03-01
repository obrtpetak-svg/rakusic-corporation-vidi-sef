import React, { useState, type FormEvent, type ChangeEvent } from 'react';
import { useApp } from '../context/AppContext';

const COMPANY_USER = 'Vi-Di.me';
const COMPANY_PASS = '45654565Vm';

export default function CompanyLogin(): React.JSX.Element {
    const { setCompanyAuth } = useApp();
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        if (user === COMPANY_USER && pass === COMPANY_PASS) {
            setCompanyAuth(true);
        } else {
            setError('Neispravni podaci za pristup');
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <img src="/icon-192.png" alt="Vi-Di-Sef" style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 12 }} />
                <div className="login-title">Vi-Di-Sef</div>
                <div className="login-subtitle">Profesionalni sustav za upravljanje gradilištem</div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label">Korisničko ime</label>
                        <input
                            className="form-input"
                            type="text"
                            value={user}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => { setUser(e.target.value); setError(''); }}
                            placeholder="Unesite korisničko ime"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Lozinka</label>
                        <input
                            className="form-input"
                            type="password"
                            value={pass}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => { setPass(e.target.value); setError(''); }}
                            placeholder="Unesite lozinku"
                        />
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}

                    <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16 }}>
                        🔑 Prijavi se
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
                    © 2025 Vi-Di-Sef | vi-di.me
                </div>
            </div>
        </div>
    );
}
