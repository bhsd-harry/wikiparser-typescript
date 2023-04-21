import hidden = require('../mixin/hidden');
import Parser = require('..');
import Token = require('.');

/** 不可见的节点 */
class HiddenToken extends hidden(Token) {
	/** @browser */
	override readonly type = 'hidden';

	/** @browser */
	constructor(wikitext?: string, config = Parser.getConfig(), accum: Token[] = [], acceptable?: Acceptable) {
		super(wikitext, config, true, accum, acceptable);
	}

	/** @override */
	override cloneNode() {
		const cloned = this.cloneChildNodes(),
			config = this.getAttribute('config'),
			acceptable = this.getAttribute('acceptable');
		return Parser.run(() => {
			const token = new HiddenToken(undefined, config, [], acceptable);
			token.append(...cloned);
			return token as this;
		});
	}
}

Parser.classes['HiddenToken'] = __filename;
export = HiddenToken;
