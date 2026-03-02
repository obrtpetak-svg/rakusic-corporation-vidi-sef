export const STAGES = [
    { id: 'narudzba', label: 'Narudžba', emoji: '📋', color: '#6366F1' },
    { id: 'priprema', label: 'Priprema', emoji: '🔧', color: '#F59E0B' },
    { id: 'proizvodnja', label: 'Proizvodnja', emoji: '⚙️', color: '#3B82F6' },
    { id: 'kontrola', label: 'Kontrola', emoji: '✅', color: '#10B981' },
    { id: 'isporuka', label: 'Isporuka', emoji: '🚚', color: '#8B5CF6' },
    { id: 'zavrseno', label: 'Završeno', emoji: '✓', color: '#047857' },
];

export const QC_CHECKLISTS = {
    priprema: ['📌 Nacrti pregledani', '🧱 Materijal naručen', '📝 Radni nalog izdan', '👷 Radnici dodijeljeni'],
    proizvodnja: ['✂️ Rezanje završeno', '🔩 Bušenje', '🔥 Zavarivanje', '✨ Brušenje i čišćenje', '📏 Dimenzijska kontrola'],
    kontrola: ['📐 Dimenzije usklađene', '🔍 Zavareni spojevi OK', '🧴 Antikorozivna zaštita', '📄 Certifikat izdan', '📸 Foto dokumentacija'],
    isporuka: ['📦 Pakiranje', '🚚 Transport organiziran', '📂 Dokumentacija klijentu', '✍️ Potpis primljeno'],
};

export const fmtDuration = (start, end) => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
};

export const COST_CATEGORIES = [
    { value: 'materijal', label: '🧱 Materijal' },
    { value: 'rad', label: '👷 Rad' },
    { value: 'transport', label: '🚚 Transport' },
    { value: 'ostalo', label: '📦 Ostalo' },
];

export const STEEL_GRADES = ['S235', 'S275', 'S355', 'S460', 'Inox 304', 'Inox 316', 'Al 6060', 'Ostalo'];
export const SPEC_UNITS = ['kg', 't', 'm', 'm²', 'm³', 'kom', 'set', 'l'];

// Profile weights in kg/m for auto-calculation
export const PROFILE_WEIGHTS = {
    'HEA 100': 21.2, 'HEA 200': 42.3, 'HEA 300': 88.3, 'HEA 400': 125,
    'HEB 100': 20.4, 'HEB 200': 61.3, 'HEB 300': 117, 'HEB 400': 155,
    'IPE 100': 8.1, 'IPE 200': 22.4, 'IPE 300': 42.2, 'IPE 400': 66.3,
    'UPN 100': 10.6, 'UPN 200': 25.3, 'UPN 300': 46.2,
    'L 50x5': 3.77, 'L 60x6': 5.42, 'L 80x8': 9.63, 'L 100x10': 15.0,
    'Cijev Ø42': 3.56, 'Cijev 40x40': 4.39, 'Cijev Ø16': 0.99,
    'PL 10mm': 78.5, 'PL 15mm': 117.8, 'PL 20mm': 157.0,
};

export const TEMPLATES = [
    {
        id: 'hala', name: '🏗️ Čelična hala', desc: 'Industrijska/skladišna hala', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Raspon', unit: 'm' }, { label: 'Visina', unit: 'm' }, { label: 'Dužina', unit: 'm' }], materials: [{ name: 'Stupovi HEA/HEB', profile: 'HEA 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Krovni nosači IPE', profile: 'IPE 400', unit: 'kg', steelGrade: 'S355' }, { name: 'Sekundarni nosači', profile: 'IPE 200', unit: 'kg', steelGrade: 'S235' }, { name: 'Spregovi/Ukrute', profile: 'L 80x8', unit: 'kg', steelGrade: 'S235' }] }
    },
    {
        id: 'stupovi', name: '🏛️ Stupovi', desc: 'HEA/HEB/Okrugli stupovi', defaults: { unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Visina', unit: 'm' }, { label: 'Bazna ploča', unit: 'mm' }], materials: [{ name: 'Stup', profile: 'HEB 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Bazna ploča', profile: 'PL 20mm', unit: 'kg', steelGrade: 'S355' }, { name: 'Ankeri', profile: 'M24', unit: 'kom', steelGrade: 'S235' }] }
    },
    {
        id: 'nosaci', name: '🔩 Nosači', desc: 'IPE/HEA/UPN nosači', defaults: { unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Raspon', unit: 'm' }, { label: 'Opterećenje', unit: 'kN/m' }], materials: [{ name: 'Nosač', profile: 'IPE 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Spojna ploča', profile: 'PL 15mm', unit: 'kg', steelGrade: 'S235' }, { name: 'Vijci', profile: 'M20 10.9', unit: 'kom', steelGrade: 'S235' }] }
    },
    {
        id: 'stepeniste', name: '🪜 Stepenište', desc: 'Čelično stepenište/rampa', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Visina', unit: 'm' }, { label: 'Širina', unit: 'mm' }, { label: 'Broj stepenica', unit: 'kom' }], materials: [{ name: 'Gaziša', profile: 'Rešetkasto', unit: 'kom', steelGrade: 'S235' }, { name: 'Podnica', profile: 'UPN 200', unit: 'kg', steelGrade: 'S235' }, { name: 'Ograda', profile: 'Cijev Ø42', unit: 'm', steelGrade: 'S235' }] }
    },
    {
        id: 'ograda', name: '🛡️ Ograde / Railing', desc: 'Zaštitne ograde, rukohvati', defaults: { unit: 'm', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Dužina', unit: 'm' }, { label: 'Visina', unit: 'mm' }], materials: [{ name: 'Stupići', profile: 'Cijev 40x40', unit: 'kom', steelGrade: 'S235' }, { name: 'Rukohvat', profile: 'Cijev Ø42', unit: 'm', steelGrade: 'Inox 304' }, { name: 'Ispuna', profile: 'Cijev Ø16', unit: 'm', steelGrade: 'S235' }] }
    },
    {
        id: 'custom', name: '⚡ Proizvoljno', desc: 'Konstrukcija po mjeri', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [], materials: [] }
    },
];

export const genOrderNumber = () => {
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `PRO-${year}-${num}`;
};
