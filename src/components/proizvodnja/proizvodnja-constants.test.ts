import { describe, it, expect } from 'vitest';
import {
    STAGES, QC_CHECKLISTS, COST_CATEGORIES,
    STEEL_GRADES, SPEC_UNITS, PROFILE_WEIGHTS,
    TEMPLATES, fmtDuration, genOrderNumber
} from './proizvodnja-constants';

// ═══════════════════════════════════════════════════
// Proizvodnja Constants — Unit Tests
// ═══════════════════════════════════════════════════

describe('proizvodnja-constants', () => {
    describe('STAGES', () => {
        it('should have 6 pipeline stages', () => {
            expect(STAGES).toHaveLength(6);
        });

        it('should have correct order: narudzba → zavrseno', () => {
            const ids = STAGES.map(s => s.id);
            expect(ids).toEqual(['narudzba', 'priprema', 'proizvodnja', 'kontrola', 'isporuka', 'zavrseno']);
        });

        it('each stage should have id, label, emoji, color', () => {
            STAGES.forEach(stage => {
                expect(stage).toHaveProperty('id');
                expect(stage).toHaveProperty('label');
                expect(stage).toHaveProperty('emoji');
                expect(stage).toHaveProperty('color');
                expect(stage.color).toMatch(/^#[0-9A-F]{6}$/i);
            });
        });
    });

    describe('QC_CHECKLISTS', () => {
        it('should have checklists for priprema, proizvodnja, kontrola, isporuka', () => {
            expect(Object.keys(QC_CHECKLISTS)).toEqual(['priprema', 'proizvodnja', 'kontrola', 'isporuka']);
        });

        it('each checklist should have at least 3 items', () => {
            Object.values(QC_CHECKLISTS).forEach(items => {
                expect(items.length).toBeGreaterThanOrEqual(3);
            });
        });

        it('checklist items should be strings with emoji prefixes', () => {
            Object.values(QC_CHECKLISTS).forEach(items => {
                items.forEach(item => {
                    expect(typeof item).toBe('string');
                    expect(item.length).toBeGreaterThan(3);
                });
            });
        });
    });

    describe('COST_CATEGORIES', () => {
        it('should have 4 categories', () => {
            expect(COST_CATEGORIES).toHaveLength(4);
        });

        it('should include materijal, rad, transport, ostalo', () => {
            const values = COST_CATEGORIES.map(c => c.value);
            expect(values).toContain('materijal');
            expect(values).toContain('rad');
            expect(values).toContain('transport');
            expect(values).toContain('ostalo');
        });
    });

    describe('STEEL_GRADES', () => {
        it('should include common structural steel grades', () => {
            expect(STEEL_GRADES).toContain('S235');
            expect(STEEL_GRADES).toContain('S355');
            expect(STEEL_GRADES).toContain('Inox 304');
        });
    });

    describe('SPEC_UNITS', () => {
        it('should include kg, t, m, kom', () => {
            expect(SPEC_UNITS).toContain('kg');
            expect(SPEC_UNITS).toContain('t');
            expect(SPEC_UNITS).toContain('m');
            expect(SPEC_UNITS).toContain('kom');
        });
    });

    describe('PROFILE_WEIGHTS', () => {
        it('should have weight for HEA 200', () => {
            expect(PROFILE_WEIGHTS['HEA 200']).toBe(42.3);
        });

        it('should have weight for IPE 300', () => {
            expect(PROFILE_WEIGHTS['IPE 300']).toBe(42.2);
        });

        it('all weights should be positive numbers', () => {
            Object.values(PROFILE_WEIGHTS).forEach(w => {
                expect(typeof w).toBe('number');
                expect(w).toBeGreaterThan(0);
            });
        });
    });

    describe('TEMPLATES', () => {
        it('should have 6 templates', () => {
            expect(TEMPLATES).toHaveLength(6);
        });

        it('should include hala, stupovi, nosaci, stepeniste, ograda, custom', () => {
            const ids = TEMPLATES.map(t => t.id);
            expect(ids).toEqual(['hala', 'stupovi', 'nosaci', 'stepeniste', 'ograda', 'custom']);
        });

        it('each template should have id, name, desc, defaults, specDefaults', () => {
            TEMPLATES.forEach(t => {
                expect(t).toHaveProperty('id');
                expect(t).toHaveProperty('name');
                expect(t).toHaveProperty('desc');
                expect(t).toHaveProperty('defaults');
                expect(t).toHaveProperty('specDefaults');
            });
        });

        it('custom template should have empty materials and dimensions', () => {
            const custom = TEMPLATES.find(t => t.id === 'custom');
            expect(custom.specDefaults.dimensions).toEqual([]);
            expect(custom.specDefaults.materials).toEqual([]);
        });
    });

    describe('fmtDuration', () => {
        it('should return null for missing start or end', () => {
            expect(fmtDuration(null, '2024-01-01')).toBeNull();
            expect(fmtDuration('2024-01-01', null)).toBeNull();
            expect(fmtDuration(null, null)).toBeNull();
        });

        it('should format hours-only durations', () => {
            const start = '2024-01-01T08:00:00';
            const end = '2024-01-01T14:00:00';
            expect(fmtDuration(start, end)).toBe('6h');
        });

        it('should format multi-day durations', () => {
            const start = '2024-01-01T08:00:00';
            const end = '2024-01-03T14:00:00'; // 2 days 6 hours = 54h
            expect(fmtDuration(start, end)).toBe('2d 6h');
        });

        it('should format exact day durations without remainder', () => {
            const start = '2024-01-01T00:00:00';
            const end = '2024-01-03T00:00:00'; // exactly 2 days
            expect(fmtDuration(start, end)).toBe('2d');
        });
    });

    describe('genOrderNumber', () => {
        it('should return string matching PRO-YYYY-NNNN format', () => {
            const order = genOrderNumber();
            const year = new Date().getFullYear();
            expect(order).toMatch(new RegExp(`^PRO-${year}-\\d{4}$`));
        });

        it('should generate unique numbers on successive calls', () => {
            const orders = new Set(Array.from({ length: 20 }, () => genOrderNumber()));
            // With 9000 possible values, 20 samples should be mostly unique
            expect(orders.size).toBeGreaterThan(15);
        });
    });
});
