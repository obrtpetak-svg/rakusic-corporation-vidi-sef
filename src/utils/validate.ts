// ── Vi-Di-Sef Data Validation ────────────────────────────────────────────
// Lightweight schema validation for Firestore collections
// Returns { valid: true } or { valid: false, errors: ['...'] }

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

type SchemaValidator = (data: Record<string, unknown>) => (string | null)[];

const required = (val: unknown, name: string): string | null =>
    (!val && val !== 0 && val !== false) ? `${name} je obavezan/a` : null;

const minLen = (val: unknown, min: number, name: string): string | null =>
    (typeof val === 'string' && val.length < min) ? `${name} mora imati najmanje ${min} znakova` : null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isString = (val: unknown, name: string): string | null =>
    (val !== undefined && val !== null && typeof val !== 'string') ? `${name} mora biti tekst` : null;

const schemas: Record<string, SchemaValidator> = {
    workers: (d) => [
        required(d.name, 'Ime'),
        minLen(d.name, 2, 'Ime'),
    ],
    projects: (d) => [
        required(d.name, 'Naziv projekta'),
    ],
    users: (d) => [
        required(d.name, 'Ime'),
        required(d.username, 'Korisničko ime'),
        required(d.pin, 'PIN'),
        minLen(d.pin, 4, 'PIN'),
    ],
    timesheets: (d) => [
        required(d.date, 'Datum'),
        required(d.workerId, 'Radnik'),
    ],
    invoices: (d) => [
        required(d.description || d.title, 'Opis'),
    ],
    vehicles: (d) => [
        required(d.name || d.plate, 'Naziv ili registracija'),
    ],
    smjestaj: (d) => [
        required(d.name || d.address, 'Naziv ili adresa'),
    ],
    obaveze: (d) => [
        required(d.title || d.name, 'Naziv'),
    ],
    otpremnice: (d) => [
        required(d.projectId, 'Projekt'),
    ],
};

/**
 * Validate data for a collection.
 */
export function validate(collection: string, data: Record<string, unknown>): ValidationResult {
    const schema = schemas[collection];
    if (!schema) return { valid: true, errors: [] }; // No schema = no validation

    const errors = schema(data).filter((e): e is string => e !== null);
    return { valid: errors.length === 0, errors };
}

/**
 * Validate and throw if invalid (for use in add/update).
 */
export function validateOrThrow(collection: string, data: Record<string, unknown>): void {
    const result = validate(collection, data);
    if (!result.valid) {
        throw new Error(`Validacija: ${result.errors.join(', ')}`);
    }
}
