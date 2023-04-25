import Parser = require('../index');
import Token = require('.');
import NoincludeToken = require('./nowiki/noinclude');

/**
 * `<pre>`
 * @classdesc `{childNodes: [...AstText|NoincludeToken|ConverterToken]}`
 */
abstract class PreToken extends Token {
	/** @browser */
	override readonly type = 'ext-inner';
	/** @browser */
	override readonly name = 'pre';
	abstract override get nextSibling(): undefined;
	abstract override get nextElementSibling(): undefined;
	abstract override get previousSibling(): import('./attributes');
	abstract override get previousElementSibling(): import('./attributes');

	/** @browser */
	constructor(wikitext?: string, config = Parser.getConfig(), accum: Token[] = []) {
		wikitext = wikitext?.replace( // eslint-disable-line no-param-reassign
			/(<nowiki>)(.*?)(<\/nowiki>)/giu,
			(_, opening: string, inner: string, closing: string) => {
				// @ts-expect-error abstract class
				new NoincludeToken(opening, config, accum);
				// @ts-expect-error abstract class
				new NoincludeToken(closing, config, accum);
				return `\0${accum.length - 1}c\x7F${inner}\0${accum.length}c\x7F`;
			},
		);
		super(wikitext, config, true, accum, {
			AstText: ':', NoincludeToken: ':', ConverterToken: ':',
		});
		this.setAttribute('stage', Parser.MAX_STAGE - 1);
	}

	/** @private */
	override isPlain() {
		return true;
	}

	/** @override */
	override cloneNode() {
		const cloned = this.cloneChildNodes();
		return Parser.run(() => {
			// @ts-expect-error abstract class
			const token: this = new PreToken(undefined, this.getAttribute('config'));
			token.append(...cloned);
			return token;
		});
	}
}

Parser.classes['PreToken'] = __filename;
export = PreToken;
