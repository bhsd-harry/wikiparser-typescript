import Parser = require('..');
import Token = require('.');

declare type AtomTypes = 'arg-name'
	| 'attr-key'
	| 'attr-value'
	| 'ext-attr-dirty'
	| 'html-attr-dirty'
	| 'table-attr-dirty'
	| 'converter-flag'
	| 'converter-rule-variant'
	| 'converter-rule-to'
	| 'converter-rule-from'
	| 'converter-rule-noconvert'
	| 'invoke-function'
	| 'invoke-module'
	| 'template-name'
	| 'link-target';

/** 不会被继续解析的plain Token */
class AtomToken extends Token {
	declare type: AtomTypes;

	/** @browser */
	constructor(
		wikitext: string | undefined,
		type: AtomTypes,
		config = Parser.getConfig(),
		accum: Token[] = [],
		acceptable?: Acceptable,
	) {
		super(wikitext, config, true, accum, acceptable);
		if (type) {
			this.type = type;
		}
	}

	/** @override */
	override cloneNode() {
		const cloned = this.cloneChildNodes(),
			config = this.getAttribute('config'),
			acceptable = this.getAttribute('acceptable');
		return Parser.run(() => {
			const token = new AtomToken(undefined, this.type, config, [], acceptable);
			token.append(...cloned);
			return token as this;
		});
	}
}

Parser.classes['AtomToken'] = __filename;
export = AtomToken;
