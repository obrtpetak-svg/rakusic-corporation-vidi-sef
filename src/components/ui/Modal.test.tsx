import { describe, it, expect } from 'vitest';

describe('Modal a11y contract', () => {
    it('Modal is exported from SharedComponents', async () => {
        const mod = await import('../../components/ui/SharedComponents');
        expect(mod.Modal).toBeDefined();
        expect(typeof mod.Modal).toBe('function');
    });
});

describe('OnboardingTour contract', () => {
    it('OnboardingTour is exported', async () => {
        const mod = await import('../../components/layout/OnboardingTour');
        expect(mod.OnboardingTour).toBeDefined();
        expect(typeof mod.OnboardingTour).toBe('function');
    });
});

describe('NotificationPrompt contract', () => {
    it('NotificationPrompt is exported', async () => {
        const mod = await import('../../components/layout/NotificationPrompt');
        expect(mod.NotificationPrompt).toBeDefined();
        expect(typeof mod.NotificationPrompt).toBe('function');
    });
});

describe('Feedback exports', () => {
    it('PageErrorBoundary is exported', async () => {
        const mod = await import('../../components/ui/Feedback');
        expect(mod.PageErrorBoundary).toBeDefined();
    });
    it('useToast is exported', async () => {
        const mod = await import('../../components/ui/Feedback');
        expect(mod.useToast).toBeDefined();
    });
    it('ToastProvider is exported', async () => {
        const mod = await import('../../components/ui/Feedback');
        expect(mod.ToastProvider).toBeDefined();
    });
    it('GlobalSearch is exported', async () => {
        const mod = await import('../../components/ui/Feedback');
        expect(mod.GlobalSearch).toBeDefined();
    });
});
