import lint_1 = require('../../util/lint');
const {generateForChild} = lint_1;
import * as fixed from '../../mixin/fixed';
import debug_1 = require('../../util/debug');
const {typeError} = debug_1;
import base_1 = require('../../util/base');
const {isPlainObject} = base_1;
import * as Parser from '../../index';
import Token = require('..');
import TableBaseToken = require('./base');
import SyntaxToken = require('../syntax');
import AttributesToken = require('../attributes');
import type {TokenAttributeGetter, TokenAttributeSetter} from '../../lib/node';

declare interface TdSyntax {
	subtype: 'td' | 'th' | 'caption';
	escape: boolean;
	correction: boolean;
}
declare type TdAttrGetter<T extends string> = T extends 'rowspan' | 'colspan' ? number : string | true | undefined;
declare type TdAttrSetter<T extends string> = T extends 'rowspan' | 'colspan' ? number : string | boolean;
declare type TdAttrs = Record<string, string | true> & {rowspan?: number, colspan?: number};

/**
 * `<td>`、`<th>`和`<caption>`
 * @classdesc `{childNodes: [SyntaxToken, AttributesToken, Token]}`
 */
abstract class TdToken extends fixed(TableBaseToken) {
	/** @browser */
	override readonly type = 'td';
	declare childNodes: [SyntaxToken, AttributesToken, Token];
	abstract override get children(): [SyntaxToken, AttributesToken, Token];
	abstract override get parentNode(): import('./trBase') | undefined;
	abstract override get parentElement(): import('./trBase') | undefined;
	abstract override get nextSibling(): this | import('./tr') | SyntaxToken | undefined;
	abstract override get nextElementSibling(): this | import('./tr') | SyntaxToken | undefined;
	abstract override get previousSibling(): Token | undefined;

	/** @browser */
	#innerSyntax = '';

	/**
	 * 单元格类型
	 * @browser
	 */
	get subtype(): 'td' | 'th' | 'caption' {
		return this.getSyntax().subtype;
	}

	set subtype(subtype) {
		this.setSyntax(subtype);
	}

	/** rowspan */
	get rowspan(): number {
		return this.getAttr('rowspan');
	}

	set rowspan(rowspan) {
		this.setAttr('rowspan', rowspan);
	}

	/** colspan */
	get colspan(): number {
		return this.getAttr('colspan');
	}

	set colspan(colspan) {
		this.setAttr('colspan', colspan);
	}

	/** 内部wikitext */
	get innerText(): string {
		return this.lastChild.text();
	}

	/**
	 * @browser
	 * @param syntax 单元格语法
	 * @param inner 内部wikitext
	 */
	constructor(syntax: string, inner?: string, config = Parser.getConfig(), accum: Token[] = []) {
		let innerSyntax = inner?.match(/\||\0\d+!\x7F/u),
			attr = innerSyntax ? inner!.slice(0, innerSyntax.index) : '';
		if (/\[\[|-\{/u.test(attr)) {
			innerSyntax = undefined;
			attr = '';
		}
		super(
			/^(?:\n[^\S\n]*(?:[|!]|\|\+|\{\{\s*!\s*\}\}\+?)|(?:\||\{\{\s*!\s*\}\}){2}|!!|\{\{\s*!!\s*\}\})$/u,
			syntax,
			attr,
			config,
			accum,
			{SyntaxToken: 0, AttributesToken: 1, Token: 2},
		);
		if (innerSyntax) {
			[this.#innerSyntax] = innerSyntax as [string];
		}
		const innerToken = new Token(
			inner?.slice((innerSyntax?.index ?? NaN) + this.#innerSyntax.length),
			config,
			true,
			accum,
		);
		innerToken.type = 'td-inner';
		this.insertAt(innerToken.setAttribute('stage', 4));
	}

	/** @private */
	protected getSyntax(): TdSyntax {
		const syntax = this.firstChild.text(),
			esc = syntax.includes('{{'),
			char = syntax.at(-1)!;
		let subtype: 'td' | 'th' | 'caption' = 'td';
		if (char === '!') {
			subtype = 'th';
		} else if (char === '+') {
			subtype = 'caption';
		}
		if (this.isIndependent()) {
			return {subtype, escape: esc, correction: false};
		}
		const {previousSibling} = this;
		if (previousSibling?.type !== 'td') {
			return {subtype, escape: esc, correction: true};
		}
		const result = (previousSibling as this).getSyntax();
		result.escape ||= esc;
		result.correction = (previousSibling as this).lastChild
			.toString('comment, ext, include, noinclude, arg, template, magic-word')
			.includes('\n');
		if (subtype === 'th' && result.subtype !== 'th') {
			result.subtype = 'th';
			result.correction = true;
		}
		return result;
	}

	/** @private */
	protected override afterBuild(): void {
		if (this.#innerSyntax.includes('\0')) {
			this.#innerSyntax = this.buildFromStr(this.#innerSyntax, 'string');
		}
	}

	/**
	 * @override
	 * @browser
	 */
	override toString(selector?: string): string {
		this.#correct();
		const {childNodes: [syntax, attr, inner]} = this;
		return selector && this.matches(selector)
			? ''
			: `${syntax.toString(selector)}${attr.toString(selector)}${this.#innerSyntax}${inner.toString(selector)}`;
	}

	/**
	 * @override
	 * @browser
	 */
	override text(): string {
		this.#correct();
		const {childNodes: [syntax, attr, inner]} = this;
		return `${syntax.text()}${attr.text()}${this.#innerSyntax}${inner.text()}`;
	}

	/** @private */
	protected override getGaps(i = 0): number {
		const j = i < 0 ? i + this.length : i;
		if (j === 1) {
			this.#correct();
			return this.#innerSyntax.length;
		}
		return 0;
	}

	/**
	 * @override
	 * @browser
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const errors = super.lint(start),
			newStart = start + this.getRelativeIndex(-1);
		for (const child of this.lastChild.childNodes) {
			if (child.type === 'text' && child.data.includes('|')) {
				errors.push(generateForChild(child, {start: newStart}, 'additional "|" in a table cell', 'warning'));
			}
		}
		return errors;
	}

	/**
	 * @override
	 * @browser
	 */
	override print(): string {
		const {childNodes: [syntax, attr, inner]} = this;
		return `<span class="wpb-td">${syntax.print()}${attr.print()}${this.#innerSyntax}${inner.print()}</span>`;
	}

	/** 是否位于行首 */
	isIndependent(): boolean {
		return this.firstChild.text().startsWith('\n');
	}

	/** @override */
	override cloneNode(): this {
		const token = super.cloneNode();
		token.setAttribute('innerSyntax', this.#innerSyntax);
		return token;
	}

	/** @private */
	override getAttribute<T extends string>(key: T): TokenAttributeGetter<T> {
		return key === 'innerSyntax' ? this.#innerSyntax as TokenAttributeGetter<T> : super.getAttribute(key);
	}

	/** @private */
	override setAttribute<T extends string>(key: T, value: TokenAttributeSetter<T>): this {
		if (key === 'innerSyntax') {
			this.#innerSyntax = value ?? '';
			return this;
		}
		return super.setAttribute(key, value);
	}

	/**
	 * @override
	 * @param syntax 表格语法
	 * @param esc 是否需要转义
	 */
	override setSyntax(syntax: string, esc = false): void {
		const aliases: Record<string, string> = {td: '\n|', th: '\n!', caption: '\n|+'};
		super.setSyntax(aliases[syntax] ?? syntax, esc);
	}

	/** 修复\<td\>语法 */
	#correct(): void {
		if (String(this.childNodes[1])) {
			this.#innerSyntax ||= '|';
		}
		const {subtype, escape, correction} = this.getSyntax();
		if (correction) {
			this.setSyntax(subtype, escape);
		}
	}

	/** 改为独占一行 */
	independence(): void {
		if (!this.isIndependent()) {
			const {subtype, escape} = this.getSyntax();
			this.setSyntax(subtype, escape);
		}
	}

	/**
	 * @override
	 * @param key 属性键
	 */
	override getAttr<T extends string>(key: T): TdAttrGetter<T> {
		const value = super.getAttr(key),
			lcKey = key.toLowerCase().trim();
		return (lcKey === 'rowspan' || lcKey === 'colspan'
			? Number(value) || 1
			: value) as TdAttrGetter<T>;
	}

	/** @override */
	override getAttrs(): TdAttrs {
		const attr: TdAttrs = super.getAttrs();
		if ('rowspan' in attr) {
			attr.rowspan = Number(attr.rowspan);
		}
		if ('colspan' in attr) {
			attr.colspan = Number(attr.colspan);
		}
		return attr;
	}

	/**
	 * @override
	 * @param key 属性键
	 * @param value 属性值
	 */
	override setAttr<T extends string>(key: T, value: TdAttrSetter<T>): void {
		if (typeof key !== 'string') {
			this.typeError('setAttr', 'String');
		}
		const lcKey = key.toLowerCase().trim();
		let v: string | boolean;
		if (typeof value === 'number' && (lcKey === 'rowspan' || lcKey === 'colspan')) {
			v = value === 1 ? false : String(value);
		} else {
			v = value!;
		}
		super.setAttr(lcKey, v);
		if (!String(this.childNodes[1])) {
			this.#innerSyntax = '';
		}
	}

	/** @override */
	override escape(): void {
		super.escape();
		if (String(this.childNodes[1])) {
			this.#innerSyntax ||= '{{!}}';
		}
		if (this.#innerSyntax === '|') {
			this.#innerSyntax = '{{!}}';
		}
	}

	/**
	 * 创建新的单元格
	 * @param inner 内部wikitext
	 * @param subtype 单元格类型
	 * @param attr 单元格属性
	 * @param include 是否嵌入
	 * @throws `RangeError` 非法的单元格类型
	 */
	static create(
		inner?: string | Token,
		subtype: 'td' | 'th' | 'caption' = 'td',
		attr: TdAttrs = {},
		include = false,
		config = Parser.getConfig(),
	): TdToken {
		if (typeof inner !== 'string' && inner?.constructor !== Token || !isPlainObject(attr)) {
			typeError(this, 'create', 'String', 'Token', 'Object');
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		} else if (subtype !== 'td' && subtype !== 'th' && subtype !== 'caption') {
			throw new RangeError('单元格的子类型只能为 "td"、"th" 或 "caption"！');
		}
		const innerToken = typeof inner === 'string' ? Parser.parse(inner, include, undefined, config) : inner!,
			// @ts-expect-error abstract class
			token: TdToken = Parser.run(() => new TdToken('\n|', undefined, config));
		token.setSyntax(subtype);
		token.lastChild.safeReplaceWith(innerToken);
		for (const [k, v] of Object.entries(attr)) {
			token.setAttr(k, v as string | true);
		}
		return token;
	}
}

declare namespace TdToken {
	export type {
		TdAttrs,
	};
}

Parser.classes['TdToken'] = __filename;
export = TdToken;
