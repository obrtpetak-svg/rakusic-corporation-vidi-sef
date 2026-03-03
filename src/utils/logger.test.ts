import { describe, it, expect, vi } from 'vitest';
import { log, warn, error } from './logger';

describe('logger', () => {
    it('log is a function', () => {
        expect(typeof log).toBe('function');
    });
    it('warn is a function', () => {
        expect(typeof warn).toBe('function');
    });
    it('error is a function', () => {
        expect(typeof error).toBe('function');
    });
    it('log does not throw', () => {
        expect(() => log('test log')).not.toThrow();
    });
    it('warn does not throw', () => {
        expect(() => warn('test warn')).not.toThrow();
    });
    it('error does not throw', () => {
        expect(() => error('test error')).not.toThrow();
    });
    it('error always calls console.error', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        error('test error message');
        expect(spy).toHaveBeenCalledWith('test error message');
        spy.mockRestore();
    });
    it('can pass multiple arguments', () => {
        expect(() => log('a', 'b', 'c')).not.toThrow();
        expect(() => warn('a', 'b', 'c')).not.toThrow();
        expect(() => error('a', 'b', 'c')).not.toThrow();
    });
    it('handles objects', () => {
        expect(() => log({ key: 'value' })).not.toThrow();
        expect(() => warn({ key: 'value' })).not.toThrow();
        expect(() => error({ key: 'value' })).not.toThrow();
    });
});
