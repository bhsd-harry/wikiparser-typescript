import Parser = require('..');
import Token = require('.');
import NoincludeToken = require('./nowiki/noinclude');

/**
 * `<pre>`
 * @classdesc `{childNodes: [...AstText|NoincludeToken|ConverterToken]}`
 */
class PreToken extends Token {
	/** @browser */
	override readonly type = 'ext-inner';
	/** @browser */
	override readonly name = 'pre';

	/** @browser */
	constructor(wikitext: string | undefined, config = Parser.getConfig(), accum: Token[] = []) {
		wikitext = wikitext?.replace( // eslint-disable-line no-param-reassign
			/(<nowiki>)(.*?)(<\/nowiki>)/giu,
			(_, opening: string, inner: string, closing: string) => {
				new NoincludeToken(opening, config, accum);
				new NoincludeToken(closing, config, accum);
				return `\0${accum.length - 1}c\x7F${inner}\0${accum.length}c\x7F`;
			},
		);
		super(wikitext, config, true, accum, {
			AstText: ':', NoincludeToken: ':', ConverterToken: ':',
		});
		this.setAttribute('stage', Parser.MAX_STAGE - 1);
	}

	/**
	 * @override
	 * @browser
	 */
	override isPlain() {
		return true;
	}

	/** @override */
	override cloneNode() {
		const cloned = this.cloneChildNodes();
		return Parser.run(() => {
			const token = new PreToken(undefined, this.getAttribute('config'));
			token.append(...cloned);
			return token as this;
		});
	}
}

Parser.classes['PreToken'] = __filename;
export = PreToken;
