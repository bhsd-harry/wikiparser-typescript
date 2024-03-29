import * as hidden from '../../mixin/hidden';
import lint_1 = require('../../util/lint');
const {generateForSelf} = lint_1;
import * as Parser from '../../index';
import Token = require('..');
import NowikiBaseToken = require('./base');

/** HTML注释，不可见 */
abstract class CommentToken extends hidden(NowikiBaseToken) {
	/** @browser */
	override readonly type = 'comment';
	closed;

	/** 内部wikitext */
	get innerText(): string {
		return this.firstChild.data;
	}

	/**
	 * @browser
	 * @param closed 是否闭合
	 */
	constructor(wikitext: string, closed = true, config = Parser.getConfig(), accum: Token[] = []) {
		super(wikitext, config, accum);
		this.closed = closed;
		Object.defineProperty(this, 'closed', {enumerable: false});
	}

	/** @private */
	protected override getPadding(): number {
		return 4;
	}

	/**
	 * @override
	 * @browser
	 */
	override print(): string {
		return super.print({pre: '&lt;!--', post: this.closed ? '--&gt;' : ''});
	}

	/**
	 * @override
	 * @browser
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		return this.closed ? [] : [generateForSelf(this, {start}, 'unclosed HTML comment')];
	}

	/**
	 * @override
	 * @browser
	 */
	override toString(selector?: string): string {
		if (!this.closed && this.nextSibling) {
			Parser.error('自动闭合HTML注释', this);
			this.closed = true;
		}
		return selector && this.matches(selector)
			? ''
			: `<!--${this.firstChild.data}${this.closed ? '-->' : ''}`;
	}

	/** @override */
	override cloneNode(): this {
		// @ts-expect-error abstract class
		return Parser.run(() => new CommentToken(this.firstChild.data, this.closed, this.getAttribute('config')));
	}
}

Parser.classes['CommentToken'] = __filename;
export = CommentToken;
