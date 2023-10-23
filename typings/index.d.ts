import type {Inserted, InsertionReturn} from '../lib/node';
import type * as Ranges from '../lib/ranges';

declare global {
	interface PrintOpt {
		pre?: string;
		post?: string;
		sep?: string;
		class?: string;
	}

	type Acceptable = Record<string, number | string | Ranges | (number | string)[]>;

	type AstConstructor = abstract new (...args: any[]) => {
		length: number;
		toString(selector?: string, separator?: string): string;
		text(separator?: string): string;
		insertAt<T extends Inserted>(token: T, i?: number): InsertionReturn<T>;
	};
}
