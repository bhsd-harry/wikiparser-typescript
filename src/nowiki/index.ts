import {generateForSelf} from '../../util/lint';
import fixedToken = require('../../mixin/fixedToken');
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
class NowikiToken extends fixedToken(Token) {
	/** @browser */
	override type: NowikiTypes = 'ext-inner';
	declare childNodes: [import('../../lib/text')] | [];
	// @ts-expect-error override accessor
	declare firstChild: import('../../lib/text') | undefined;
	// @ts-expect-error override accessor
	declare lastChild: import('../../lib/text') | undefined;

	/** @browser */
	constructor(wikitext: string | undefined, config = Parser.getConfig(), accum: Token[] = []) {
		super(wikitext, config, true, accum);
	}

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const {type, name} = this;
		return type === 'ext-inner' && (name === 'templatestyles' || name === 'section') && String(this)
			? [generateForSelf(this, {start}, Parser.msg('nothing should be in <$1>', name))]
			: super.lint(start);
	}

	/** @override */
	override cloneNode() {
		const {constructor, firstChild, type} = this,
			token = Parser.run(
				() => new (constructor as typeof NowikiToken)(firstChild?.data, this.getAttribute('config')),
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

Parser.classes['NowikiToken'] = __filename;
export = NowikiToken;
