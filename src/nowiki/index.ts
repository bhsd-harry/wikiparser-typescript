import {generateForSelf} from '../../util/lint';
import Parser = require('../../index');
import NowikiBaseToken = require('./base');
import AttributesToken = require('../attributes');

/** 扩展标签内的纯文字Token */
abstract class NowikiToken extends NowikiBaseToken {
	/** @browser */
	override readonly type = 'ext-inner';
	abstract override get nextSibling(): undefined;
	abstract override get nextElementSibling(): undefined;
	abstract override get previousSibling(): AttributesToken;
	abstract override get previousElementSibling(): AttributesToken;

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
