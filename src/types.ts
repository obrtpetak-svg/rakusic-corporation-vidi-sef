/**
 * Vi-Di-Sef — Shared TypeScript Types
 * 
 * Central type definitions for all Firestore collections and app state.
 * Import from here instead of using `any` in components and context.
 */

// ── Base Document ────────────────────────────────────────────────────────
export interface BaseDoc {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}

// ── User ─────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'leader' | 'worker';

export interface User extends BaseDoc {
    name: string;
    username: string;
    pin: string;
    role: UserRole;
    email?: string;
    phone?: string;
    workerId?: string;
    assignedProjects?: string[];
    active?: boolean;
}

// ── Worker ───────────────────────────────────────────────────────────────
export interface Worker extends BaseDoc {
    name: string;
    role: UserRole;
    phone?: string;
    email?: string;
    oib?: string;
    position?: string;
    status?: 'aktivan' | 'neaktivan';
    assignedProjects?: string[];
    hourlyRate?: number;
    startDate?: string;
    photo?: string;
}

// ── Project ──────────────────────────────────────────────────────────────
export type ProjectStatus = 'aktivan' | 'planiran' | 'završen' | 'pauziran';

export interface ProjectPhase {
    id: string;
    name: string;
    status: 'pending' | 'active' | 'done';
    startDate?: string;
    endDate?: string;
}

export interface Project extends BaseDoc {
    name: string;
    status: ProjectStatus;
    client?: string;
    address?: string;
    description?: string;
    workers?: string[];
    startDate?: string;
    endDate?: string;
    budget?: number;
    phases?: ProjectPhase[];
    siteLat?: number;
    siteLng?: number;
}

// ── Timesheet ────────────────────────────────────────────────────────────
export type TimesheetStatus = 'na čekanju' | 'odobreno' | 'odbijeno' | 'odobreno-voditelj';

export interface Timesheet extends BaseDoc {
    workerId: string;
    projectId?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    totalMinutes?: number;
    status: TimesheetStatus;
    note?: string;
    overtime?: number;
    nightHours?: number;
    weekendHours?: number;
    approvedBy?: string;
    approvedAt?: string;
}

// ── Invoice ──────────────────────────────────────────────────────────────
export type InvoiceStatus = 'na čekanju' | 'odobreno' | 'odbijeno' | 'odobreno-voditelj' | 'plaćeno';

export interface Invoice extends BaseDoc {
    title?: string;
    description?: string;
    amount?: number;
    currency?: string;
    projectId?: string;
    workerId?: string;
    vendorName?: string;
    source?: 'admin' | 'radnik';
    status: InvoiceStatus;
    photo?: string;
    date?: string;
    dueDate?: string;
    approvedBy?: string;
}

// ── Vehicle ──────────────────────────────────────────────────────────────
export interface Vehicle extends BaseDoc {
    name: string;
    plate?: string;
    type?: string;
    brand?: string;
    model?: string;
    year?: number;
    assignedWorker?: string;
    assignedProject?: string;
    fuelType?: string;
    mileage?: number;
    registrationExpiry?: string;
    insuranceExpiry?: string;
    photo?: string;
}

// ── Accommodation (Smještaj) ─────────────────────────────────────────────
export interface Smjestaj extends BaseDoc {
    name: string;
    address?: string;
    city?: string;
    capacity?: number;
    workerIds?: string[];
    monthlyRent?: number;
    contact?: string;
    note?: string;
}

// ── Obligation (Obaveza) ─────────────────────────────────────────────────
export interface Obaveza extends BaseDoc {
    title?: string;
    name?: string;
    description?: string;
    dueDate?: string;
    workerIds?: string[];
    projectId?: string;
    priority?: 'low' | 'medium' | 'high';
    completions?: Array<{ workerId: string; completedAt: string; adminSeen?: boolean }>;
}

// ── Delivery Note (Otpremnica) ───────────────────────────────────────────
export type OtpremnicaStatus = 'na čekanju' | 'odobreno' | 'odbijeno' | 'odobreno-voditelj';

export interface Otpremnica extends BaseDoc {
    projectId: string;
    workerId?: string;
    materialName?: string;
    quantity?: number;
    unit?: string;
    supplier?: string;
    date?: string;
    status: OtpremnicaStatus;
    photo?: string;
    note?: string;
}

// ── Production ───────────────────────────────────────────────────────────
export interface ProductionEntry extends BaseDoc {
    projectId?: string;
    productName?: string;
    quantity?: number;
    unit?: string;
    date?: string;
    workerId?: string;
    note?: string;
}

export interface ProductionAlert extends BaseDoc {
    type?: string;
    message?: string;
    status?: 'unread' | 'read';
    targetRole?: UserRole;
    projectId?: string;
}

// ── Audit Log ────────────────────────────────────────────────────────────
export interface AuditEntry extends BaseDoc {
    action: string;
    user: string;
    userId?: string;
    email?: string;
    timestamp: string;
    details?: Record<string, unknown>;
    userAgent?: string;
}

// ── Daily Log ────────────────────────────────────────────────────────────
export type DailyLogStatus = 'na čekanju' | 'odobreno' | 'odbijeno' | 'odobreno voditeljem';

export interface DailyLog extends BaseDoc {
    projectId?: string;
    workerId?: string;
    date?: string;
    weather?: string;
    workDescription?: string;
    issues?: string;
    photos?: string[];
    status: DailyLogStatus;
}

// ── Weather Rules ────────────────────────────────────────────────────────
export interface WeatherRule extends BaseDoc {
    name: string;
    condition: string;
    threshold?: number;
    action?: string;
}

// ── Safety ───────────────────────────────────────────────────────────────
export interface SafetyTemplate extends BaseDoc {
    name: string;
    items?: Array<{ id: string; text: string; required?: boolean }>;
}

export interface SafetyChecklist extends BaseDoc {
    templateId?: string;
    projectId?: string;
    workerId?: string;
    date?: string;
    responses?: Array<{ itemId: string; checked: boolean; note?: string }>;
    status?: 'pending' | 'completed';
}

// ── Company Profile ──────────────────────────────────────────────────────
export interface CompanyProfile {
    companyName: string;
    address?: string;
    city?: string;
    country?: string;
    oib?: string;
    phone?: string;
    email?: string;
    currency?: string;
    defaultBreak?: number;
    logo?: string;
}

// ── Leave Request ────────────────────────────────────────────────────────
export type LeaveType = 'godišnji' | 'bolovanje' | 'slobodan_dan' | 'ostalo';

export interface LeaveRequest extends BaseDoc {
    workerId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
}

// ── Session Config ───────────────────────────────────────────────────────
export interface SessionConfig {
    sessionDuration: number;
    sessionVersion: number | null;
    syncMode: number;
}

// ── App Step ─────────────────────────────────────────────────────────────
export type AppStep = 'loading' | 'appLogin' | 'firebaseConfig' | 'companySetup' | 'adminCreate' | 'userLogin' | 'app';
