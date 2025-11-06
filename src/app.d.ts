// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		ethereum?: {
			request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
			send: (method: string, params?: unknown[]) => Promise<unknown>;
			isMetaMask?: boolean;
			on: (event: string, callback: (...args: any[]) => void) => void;
			removeListener: (event: string, callback: (...args: any[]) => void) => void;
		};
	}
}

export {};
