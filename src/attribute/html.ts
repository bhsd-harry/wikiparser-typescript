import {generateForChild} from '../../util/lint';
import Parser = require('../..');
import Token = require('..');
import AttributeToken = require('.');
import AtomToken = require('../atom');

/**
 * 扩展和HTML标签属性
 * @classdesc `{childNodes: [AtomToken, Token]}`
 */
class HtmlAttributeToken extends AttributeToken {
	declare type: 'html-attr' | 'table-attr';
	// @ts-expect-error declare accessor
	declare parentNode: import('../attributes');
	// @ts-expect-error declare accessor
	declare parentElement: import('../attributes');
	// @ts-expect-error declare accessor
	declare nextSibling: AtomToken | HtmlAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare nextElementSibling: AtomToken | HtmlAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare previousSibling: AtomToken | HtmlAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare previousElementSibling: AtomToken | HtmlAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare value: string;

	/** @override */
	// @ts-expect-error declare constructor
	declare constructor(
		type: 'html-attr' | 'table-attr',
		tag: string,
		key: string,
		equal?: string,
		value?: string,
		quotes?: [string?, string?],
		config?: Parser.Config,
		accum?: Token[],
	);

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()) {
		const errors = super.lint(start),
			{firstChild, name, parentNode} = this,
			tagName = parentNode?.name,
			{htmlAttrs, commonHtmlAttrs} = AttributeToken;
		if (!/\{\{[^{]+\}\}/u.test(name) && !htmlAttrs[tagName]?.has(name)
			&& !/^(?:xmlns:[\w:.-]+|data-[^:]*)$/u.test(name)
			&& (tagName === 'meta' || tagName === 'link' || !commonHtmlAttrs.has(name))
		) {
			errors.push(generateForChild(firstChild, {start}, 'illegal attribute name'));
		}
		return errors;
	}

	/**
	 * @override
	 * @browser
	 */
	override getValue() {
		const value = super.getValue();
		return value === true ? '' : value;
	}

	/** @override */
	// @ts-expect-error declare method
	declare setValue(value: string): void;
}

Parser.classes['HtmlAttributeToken'] = __filename;
export = HtmlAttributeToken;
