import string_1 = require('../../util/string');
const {decodeHtml} = string_1;
import * as Parser from '../../index';
import LinkToken = require('.');

/** 分类 */
abstract class CategoryToken extends LinkToken {
	/** @browser */
	override readonly type = 'category';

	/** 分类排序关键字 */
	get sortkey(): string | undefined {
		const {childNodes: [, child]} = this;
		return child && decodeHtml(child.text());
	}

	set sortkey(text) {
		this.setSortkey(text);
	}

	/**
	 * 设置排序关键字
	 * @param text 排序关键字
	 */
	setSortkey(text?: string): void {
		this.setLinkText(text);
	}
}

Parser.classes['CategoryToken'] = __filename;
export = CategoryToken;
