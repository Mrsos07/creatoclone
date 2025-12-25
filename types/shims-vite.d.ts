declare module 'vite';
declare module '@vitejs/plugin-react';

// Minimal `process` shim to satisfy editor TypeScript checks when
// @types/node is not installed in the environment.
declare const process: {
	cwd(): string;
	env: { [key: string]: string | undefined };
};
