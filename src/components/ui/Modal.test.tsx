import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

import { Modal, Field, StatusBadge } from '../../components/ui/SharedComponents';

afterEach(() => cleanup());

describe('Modal component', () => {
    it('renders with title', () => {
        render(<Modal title="Test Modal" onClose={() => { }}>Content</Modal>);
        expect(screen.getByText('Test Modal')).toBeTruthy();
        expect(screen.getByText('Content')).toBeTruthy();
    });

    it('has role="dialog" and aria-modal', () => {
        const { container } = render(<Modal title="A11y" onClose={() => { }}>X</Modal>);
        const dialog = container.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.getAttribute('aria-modal')).toBe('true');
        expect(dialog?.getAttribute('aria-label')).toBe('A11y');
    });

    it('calls onClose when Escape key pressed', () => {
        const onClose = vi.fn();
        render(<Modal title="Esc" onClose={onClose}>X</Modal>);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', () => {
        const onClose = vi.fn();
        const { container } = render(<Modal title="Outside" onClose={onClose}>X</Modal>);
        const overlay = container.querySelector('[role="dialog"]')!;
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalled();
    });

    it('does NOT call onClose when clicking inside content', () => {
        const onClose = vi.fn();
        render(<Modal title="Inside" onClose={onClose}><p>Inner</p></Modal>);
        fireEvent.click(screen.getByText('Inner'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('locks body scroll', () => {
        render(<Modal title="Scroll" onClose={() => { }}>X</Modal>);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll on unmount', () => {
        const { unmount } = render(<Modal title="Scroll" onClose={() => { }}>X</Modal>);
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('');
    });

    it('has close button with aria-label Zatvori', () => {
        render(<Modal title="Close" onClose={() => { }}>X</Modal>);
        const btn = screen.getByLabelText('Zatvori');
        expect(btn).toBeTruthy();
    });

    it('renders wide modal', () => {
        const { container } = render(<Modal title="Wide" onClose={() => { }} wide>X</Modal>);
        const inner = container.querySelector('[tabindex="-1"]');
        expect(inner).not.toBeNull();
    });
});

describe('Field component', () => {
    it('renders label and children', () => {
        render(<Field label="Ime"><input /></Field>);
        expect(screen.getByText('Ime')).toBeTruthy();
    });

    it('renders required asterisk', () => {
        const { container } = render(<Field label="Email" required><input /></Field>);
        expect(container.textContent).toContain('*');
    });
});

describe('StatusBadge', () => {
    it('renders with status text', () => {
        const { container } = render(<StatusBadge status="active" />);
        expect(container.textContent?.length).toBeGreaterThan(0);
    });
});
