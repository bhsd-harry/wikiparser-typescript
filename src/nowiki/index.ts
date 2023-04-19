import {generateForSelf} from '../../util/lint';
import Parser = require('../..');
import NowikiBaseToken = require('./base');

/**
 * 扩展标签内的纯文字Token，不会被解析
 * @classdesc `{childNodes: [AstText]}`
 */
class NowikiToken extends NowikiBaseToken {
	/** @browser */
	override readonly type = 'ext-inner';
	// @ts-expect-error declare accessor
	declare parentNode: import('../tagPair/ext');
	// @ts-expect-error declare accessor
	declare parentElement: import('../tagPair/ext');
	// @ts-expect-error declare accessor
	declare nextSibling: undefined;
	// @ts-expect-error declare accessor
	declare nextElementSibling: undefined;
	// @ts-expect-error declare accessor
	declare previousSibling: import('../attributes');
	// @ts-expect-error declare accessor
	declare previousElementSibling: import('../attributes');

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const {name} = this;
		return (name === 'templatestyles' || name === 'section') && String(this)
			? [generateForSelf(this, {start}, Parser.msg('nothing should be in <$1>', name))]
			: super.lint(start);
	}
}

Parser.classes['NowikiToken'] = __filename;
export = NowikiToken;
