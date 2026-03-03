/// <reference types="vite/client" />
/**
 * Dev-only logger — strips all log output in production builds.
 * Vite's tree-shaking removes dead code when import.meta.env.DEV === false.
 */
const noop = (): void => { };

const isDev: boolean = import.meta.env.DEV;

export const log: (...args: unknown[]) => void = isDev ? (...args) => console.log(...args) : noop;
export const warn: (...args: unknown[]) => void = isDev ? (...args) => console.warn(...args) : noop;
export const error: (...args: unknown[]) => void = (...args) => console.error(...args); // always show errors
