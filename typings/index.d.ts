import {AstNodeTypes} from '../lib/node';
import Token = require('../src');
import Ranges = require('../lib/ranges');

declare global {
	interface AstEvent extends Event {
		readonly type: string;
		readonly target: EventTarget & AstNodeTypes;
		currentTarget: EventTarget & Token;
		prevTarget?: Token;
		bubbles: boolean;
	}

	interface AstEventData {
		position?: number;
		removed?: AstNodeTypes;
		inserted?: AstNodeTypes;
		oldToken?: Token;
		newToken?: Token;
		oldText?: string;
		newText?: string;
		oldKey?: string;
		newKey?: string;
	}

	type AstListener = (e: AstEvent, data: AstEventData) => void;

	interface PrintOpt {
		pre?: string;
		post?: string;
		sep?: string;
		class?: string;
	}

	interface SelectorArray extends Array<
		string
		| [string, string]
		| [string, string | undefined, string | undefined, string | undefined]
	> {
		relation?: string;
	}

	type Acceptable = Record<string, number | string | Ranges | (number | string)[]>;
}

export {};
