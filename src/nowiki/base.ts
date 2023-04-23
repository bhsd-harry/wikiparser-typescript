import fixed = require('../../mixin/fixed');
import Parser = require('../..');
import Token = require('..');

declare type NowikiTypes = 'ext-inner'
	| 'comment'
	| 'dd'
	| 'double-underscore'
	| 'hr'
	| 'list'
	| 'noinclude'
	| 'quote';

/**
 * 纯文字Token，不会被解析
 * @classdesc `{childNodes: [AstText]}`
 */
class NowikiBaseToken extends fixed(Token) {
	declare type: NowikiTypes;
	declare childNodes: [import('../../lib/text')];
	// @ts-expect-error declare accessor
	declare children: [];
	// @ts-expect-error declare accessor
	declare firstChild: import('../../lib/text');
	// @ts-expect-error declare accessor
	declare firstElementChild: undefined;
	// @ts-expect-error declare accessor
	declare lastChild: import('../../lib/text');
	// @ts-expect-error declare accessor
	declare lastElementChild: undefined;

	/** @browser */
	constructor(wikitext?: string, config = Parser.getConfig(), accum: Token[] = []) {
		super(wikitext, config, true, accum);
	}

	/** @override */
	override cloneNode() {
		const {constructor, firstChild, type} = this,
			token = Parser.run(
				() => new (constructor as typeof NowikiBaseToken)(firstChild?.data, this.getAttribute('config')),
			);
		token.type = type;
		return token as this;
	}

	/**
	 * @override
	 * @param str 新文本
	 */
	override setText(str: string) {
		return super.setText(str, 0);
	}
}

Parser.classes['NowikiBaseToken'] = __filename;
export = NowikiBaseToken;
