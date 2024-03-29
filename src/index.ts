// PHP解析器的步骤：
// -1. 替换签名和`{{subst:}}`，参见Parser::preSaveTransform；这在revision中不可能保留，可以跳过
// 0. 移除特定字符`\0`和`\x7F`，参见Parser::parse
// 1. 注释/扩展标签（'<'相关），参见Preprocessor_Hash::buildDomTreeArrayFromText和Sanitizer::decodeTagAttributes
// 2. 模板/模板变量/标题，注意rightmost法则，以及`-{`和`[[`可以破坏`{{`或`{{{`语法，
//    参见Preprocessor_Hash::buildDomTreeArrayFromText
// 3. HTML标签（允许不匹配），参见Sanitizer::internalRemoveHtmlTags
// 4. 表格，参见Parser::handleTables
// 5. 水平线、状态开关和余下的标题，参见Parser::internalParse
// 6. 内链，含文件和分类，参见Parser::handleInternalLinks2
// 7. `'`，参见Parser::doQuotes
// 8. 外链，参见Parser::handleExternalLinks
// 9. ISBN、RFC（未来将废弃，不予支持）和自由外链，参见Parser::handleMagicLinks
// 10. 段落和列表，参见BlockLevelPass::execute
// 11. 转换，参见LanguageConverter::recursiveConvertTopLevel
// \0\d+.\x7F标记Token：
// e: ExtToken
// a: AttributeToken
// c: CommentToken、NoIncludeToken和IncludeToken
// !: `{{!}}`专用
// {: `{{(!}}`专用
// }: `{{!)}}`专用
// -: `{{!-}}`专用
// +: `{{!!}}`专用
// ~: `{{=}}`专用
// s: `{{{|subst:}}}`
// m: `{{fullurl:}}`、`{{canonicalurl:}}`或`{{filepath:}}`
// t: ArgToken或TranscludeToken
// h: HeadingToken
// x: HtmlToken
// b: TableToken
// r: HrToken
// u: DoubleUnderscoreToken
// l: LinkToken
// q: QuoteToken
// w: ExtLinkToken
// d: ListToken
// v: ConverterToken

import string_1 = require('../util/string');
const {text} = string_1;
import type {AstNodeTypes, TokenAttributeGetter, TokenAttributeSetter, CaretPosition} from '../lib/node';
import * as assert from 'assert/strict';
import * as Ranges from '../lib/ranges';
import * as Parser from '../index';
import AstElement = require('../lib/element');
import AstText = require('../lib/text');
const {MAX_STAGE, aliases} = Parser;

declare type TokenTypes = 'root'
	| 'plain'
	| 'onlyinclude'
	| 'noinclude'
	| 'include'
	| 'comment'
	| 'ext'
	| 'ext-attrs'
	| 'ext-attr-dirty'
	| 'ext-attr'
	| 'attr-key'
	| 'attr-value'
	| 'ext-inner'
	| 'arg'
	| 'arg-name'
	| 'arg-default'
	| 'hidden'
	| 'magic-word'
	| 'magic-word-name'
	| 'invoke-function'
	| 'invoke-module'
	| 'template'
	| 'template-name'
	| 'parameter'
	| 'parameter-key'
	| 'parameter-value'
	| 'heading'
	| 'heading-title'
	| 'heading-trail'
	| 'html'
	| 'html-attrs'
	| 'html-attr-dirty'
	| 'html-attr'
	| 'table'
	| 'tr'
	| 'td'
	| 'table-syntax'
	| 'table-attrs'
	| 'table-attr-dirty'
	| 'table-attr'
	| 'table-inter'
	| 'td-inner'
	| 'hr'
	| 'double-underscore'
	| 'link'
	| 'link-target'
	| 'link-text'
	| 'category'
	| 'file'
	| 'gallery-image'
	| 'imagemap-image'
	| 'image-parameter'
	| 'quote'
	| 'ext-link'
	| 'ext-link-text'
	| 'ext-link-url'
	| 'free-ext-link'
	| 'list'
	| 'dd'
	| 'converter'
	| 'converter-flags'
	| 'converter-flag'
	| 'converter-rule'
	| 'converter-rule-noconvert'
	| 'converter-rule-variant'
	| 'converter-rule-to'
	| 'converter-rule-from'
	| 'param-line'
	| 'charinsert-line'
	| 'imagemap-link';
declare type TagToken = import('./tagPair/include') | import('./tagPair/ext') | import('./html');

/**
 * 所有节点的基类
 * @classdesc `{childNodes: ...(AstText|Token)}`
 */
class Token extends AstElement {
	/** @browser */
	override type: TokenTypes = 'root';

	/**
	 * 解析阶段，参见顶部注释。只对plain Token有意义。
	 * @browser
	 */
	#stage = 0;
	/** @browser */
	#config;

	/**
	 * 这个数组起两个作用：1. 数组中的Token会在build时替换`/\0\d+.\x7F/`标记；2. 数组中的Token会依次执行parseOnce和build方法。
	 * @browser
	 */
	#accum;
	/** @browser */
	#include?: boolean;
	#acceptable: Record<string, Ranges> | undefined;
	#protectedChildren = new Ranges();

	/** 所有图片，包括图库 */
	get images(): Token[] {
		return this.querySelectorAll('file, gallery-image, imagemap-image');
	}

	/** 所有内链、外链和自由外链 */
	get links(): Token[] {
		return this.querySelectorAll('link, ext-link, free-ext-link, image-parameter#link');
	}

	/** 所有模板和模块 */
	get embeds(): import('./transclude')[] {
		return this.querySelectorAll('template, magic-word#invoke') as import('./transclude')[];
	}

	/** @browser */
	constructor(
		wikitext?: string,
		config = Parser.getConfig(),
		halfParsed = false,
		accum: Token[] = [],
		acceptable?: Acceptable,
	) {
		super();
		if (typeof wikitext === 'string') {
			this.insertAt(halfParsed ? wikitext : wikitext.replace(/[\0\x7F]/gu, ''));
		}
		this.#config = config;
		this.#accum = accum;
		this.setAttribute('acceptable', acceptable);
		accum.push(this);
	}

	/** @private */
	parseOnce(n = this.#stage, include = false): this {
		if (n < this.#stage || !this.isPlain() || this.length === 0) {
			return this;
		}
		switch (n) {
			case 0:
				if (this.type === 'root') {
					this.#accum.shift();
				}
				this.#include = include;
				this.#parseCommentAndExt(include);
				break;
			case 1:
				this.#parseBrackets();
				break;
			case 2:
				this.#parseHtml();
				break;
			case 3:
				this.#parseTable();
				break;
			case 4:
				this.#parseHrAndDoubleUnderscore();
				break;
			case 5:
				this.#parseLinks();
				break;
			case 6:
				this.#parseQuotes();
				break;
			case 7:
				this.#parseExternalLinks();
				break;
			case 8:
				this.#parseMagicLinks();
				break;
			case 9:
				this.#parseList();
				break;
			case 10:
				this.#parseConverter();
				// no default
		}
		if (this.type === 'root') {
			for (const token of this.#accum) {
				token.parseOnce(n, include);
			}
		}
		this.#stage++;
		return this;
	}

	/** @private */
	buildFromStr(str: string, type: 'string' | 'text'): string;
	/** @private */
	buildFromStr(str: string): AstNodeTypes[];
	/** @private */
	buildFromStr(str: string, type?: string): string | AstNodeTypes[] {
		const nodes = str.split(/[\0\x7F]/u).map((s, i) => {
			if (i % 2 === 0) {
				return new AstText(s);
			// @ts-expect-error isNaN
			} else if (isNaN(s.at(-1))) {
				return this.#accum[Number(s.slice(0, -1))]!;
			}
			throw new Error(`解析错误！未正确标记的 Token：${s}`);
		});
		if (type === 'string') {
			return nodes.map(String).join('');
		} else if (type === 'text') {
			return text(nodes);
		}
		return nodes;
	}

	/**
	 * 将占位符替换为子Token
	 * @browser
	 */
	#build(): void {
		this.#stage = MAX_STAGE;
		const {length, firstChild} = this,
			str = String(firstChild);
		if (length === 1 && firstChild!.type === 'text' && str.includes('\0')) {
			this.replaceChildren(...this.buildFromStr(str));
			this.normalize();
			if (this.type === 'root') {
				for (const token of this.#accum) {
					token.#build();
				}
			}
		}
	}

	/** @private */
	protected afterBuild(): void {
		if (this.type === 'root') {
			for (const token of this.#accum) {
				token.afterBuild();
			}
		}
	}

	/**
	 * 解析、重构、生成部分Token的`name`属性
	 * @browser
	 * @param n 最大解析层级
	 * @param include 是否嵌入
	 */
	parse(n = MAX_STAGE, include = false): this {
		if (!Number.isInteger(n)) {
			this.typeError('parse', 'Number');
		}
		while (this.#stage < n) {
			this.parseOnce(this.#stage, include);
		}
		if (n) {
			this.#build();
			this.afterBuild();
		}
		return this;
	}

	/**
	 * 解析HTML注释和扩展标签
	 * @browser
	 * @param includeOnly 是否嵌入
	 */
	#parseCommentAndExt(includeOnly: boolean): void {
		const parseCommentAndExt: typeof import('../parser/commentAndExt') = require('../parser/commentAndExt');
		this.setText(parseCommentAndExt(String(this.firstChild), this.#config, this.#accum, includeOnly));
	}

	/**
	 * 解析花括号
	 * @browser
	 */
	#parseBrackets(): void {
		const parseBrackets: typeof import('../parser/brackets') = require('../parser/brackets');
		const str = this.type === 'root' ? String(this.firstChild!) : `\0${String(this.firstChild!)}`,
			parsed = parseBrackets(str, this.#config, this.#accum);
		this.setText(this.type === 'root' ? parsed : parsed.slice(1));
	}

	/**
	 * 解析HTML标签
	 * @browser
	 */
	#parseHtml(): void {
		if (this.#config.excludes?.includes('html')) {
			return;
		}
		const parseHtml: typeof import('../parser/html') = require('../parser/html');
		this.setText(parseHtml(String(this.firstChild), this.#config, this.#accum));
	}

	/**
	 * 解析表格
	 * @browser
	 */
	#parseTable(): void {
		if (this.#config.excludes?.includes('table')) {
			return;
		}
		const parseTable: typeof import('../parser/table') = require('../parser/table');
		this.setText(parseTable(this as Token & {firstChild: AstText}, this.#config, this.#accum));
	}

	/**
	 * 解析`<hr>`和状态开关
	 * @browser
	 */
	#parseHrAndDoubleUnderscore(): void {
		if (this.#config.excludes?.includes('hr')) {
			return;
		}
		const parseHrAndDoubleUnderscore: typeof import('../parser/hrAndDoubleUnderscore')
			= require('../parser/hrAndDoubleUnderscore');
		this.setText(parseHrAndDoubleUnderscore(this, this.#config, this.#accum));
	}

	/**
	 * 解析内部链接
	 * @browser
	 */
	#parseLinks(): void {
		const parseLinks: typeof import('../parser/links') = require('../parser/links');
		this.setText(parseLinks(String(this.firstChild), this.#config, this.#accum));
	}

	/**
	 * 解析单引号
	 * @browser
	 */
	#parseQuotes(): void {
		if (this.#config.excludes?.includes('quote')) {
			return;
		}
		const parseQuotes: typeof import('../parser/quotes') = require('../parser/quotes');
		const lines = String(this.firstChild).split('\n');
		for (let i = 0; i < lines.length; i++) {
			lines[i] = parseQuotes(lines[i]!, this.#config, this.#accum);
		}
		this.setText(lines.join('\n'));
	}

	/**
	 * 解析外部链接
	 * @browser
	 */
	#parseExternalLinks(): void {
		if (this.#config.excludes?.includes('extLink')) {
			return;
		}
		const parseExternalLinks: typeof import('../parser/externalLinks') = require('../parser/externalLinks');
		this.setText(parseExternalLinks(String(this.firstChild), this.#config, this.#accum));
	}

	/**
	 * 解析自由外链
	 * @browser
	 */
	#parseMagicLinks(): void {
		if (this.#config.excludes?.includes('magicLink')) {
			return;
		}
		const parseMagicLinks: typeof import('../parser/magicLinks') = require('../parser/magicLinks');
		this.setText(parseMagicLinks(String(this.firstChild), this.#config, this.#accum));
	}

	/**
	 * 解析列表
	 * @browser
	 */
	#parseList(): void {
		if (this.#config.excludes?.includes('list')) {
			return;
		}
		const parseList: typeof import('../parser/list') = require('../parser/list');
		const lines = String(this.firstChild).split('\n');
		let i = this.type === 'root' || this.type === 'ext-inner' && this.name === 'poem' ? 0 : 1;
		for (; i < lines.length; i++) {
			lines[i] = parseList(lines[i]!, this.#config, this.#accum);
		}
		this.setText(lines.join('\n'));
	}

	/**
	 * 解析语言变体转换
	 * @browser
	 */
	#parseConverter(): void {
		if (this.#config.variants.length > 0) {
			const parseConverter: typeof import('../parser/converter') = require('../parser/converter');
			this.setText(parseConverter(String(this.firstChild), this.#config, this.#accum));
		}
	}

	/** @private */
	override getAttribute<T extends string>(key: T): TokenAttributeGetter<T> {
		switch (key) {
			case 'config':
				return structuredClone(this.#config) as TokenAttributeGetter<T>;
			case 'accum':
				return this.#accum as TokenAttributeGetter<T>;
			case 'include': {
				if (this.#include !== undefined) {
					return this.#include as TokenAttributeGetter<T>;
				}
				const root = this.getRootNode();
				if (root.type === 'root' && root !== this) {
					return root.getAttribute('include') as TokenAttributeGetter<T>;
				}
				const includeToken = root.querySelector('include');
				if (includeToken) {
					return (includeToken.name === 'noinclude') as TokenAttributeGetter<T>;
				}
				const noincludeToken = root.querySelector('noinclude');
				return (
					Boolean(noincludeToken) && !/^<\/?noinclude(?:\s[^>]*)?\/?>$/iu.test(String(noincludeToken))
				) as TokenAttributeGetter<T>;
			}
			case 'stage':
				return this.#stage as TokenAttributeGetter<T>;
			case 'acceptable':
				return (this.#acceptable ? {...this.#acceptable} : undefined) as TokenAttributeGetter<T>;
			case 'protectedChildren':
				return new Ranges(this.#protectedChildren) as TokenAttributeGetter<T>;
			default:
				return super.getAttribute(key);
		}
	}

	/** @private */
	override setAttribute<T extends string>(key: T, value: TokenAttributeSetter<T>): this {
		switch (key) {
			case 'stage':
				if (this.#stage === 0 && this.type === 'root') {
					this.#accum.shift();
				}
				this.#stage = (value as TokenAttributeSetter<'stage'>)!;
				return this;
			case 'acceptable': {
				const acceptable: Record<string, Ranges> = {};
				if (value) {
					for (const [k, v] of Object.entries(value as unknown as Acceptable)) {
						if (k.startsWith('Stage-')) {
							for (let i = 0; i <= Number(k.slice(6)); i++) {
								for (const type of aliases[i]!) {
									acceptable[type] = new Ranges(v);
								}
							}
						} else if (k.startsWith('!')) { // `!`项必须放在最后
							delete acceptable[k.slice(1)];
						} else {
							acceptable[k] = new Ranges(v);
						}
					}
				}
				this.#acceptable = value && acceptable;
				return this;
			}
			default:
				return super.setAttribute(key, value);
		}
	}

	/** @private */
	protected isPlain(): boolean {
		return this.constructor === Token;
	}

	/**
	 * @override
	 * @browser
	 * @param child 待插入的子节点
	 * @param i 插入位置
	 * @throws `RangeError` 不可插入的子节点
	 */
	override insertAt(child: string, i?: number): AstText;
	/** @ignore */
	override insertAt<T extends AstNodeTypes>(child: T, i?: number): T;
	/** @ignore */
	override insertAt<T extends AstNodeTypes>(child: T | string, i = this.length): T | AstText {
		const token = typeof child === 'string' ? new AstText(child) : child;
		if (!Parser.running && this.#acceptable) {
			const acceptableIndices = Object.fromEntries(
					Object.entries(this.#acceptable).map(([str, ranges]) => [str, ranges.applyTo(this.length + 1)]),
				),
				nodesAfter = this.childNodes.slice(i),
				{constructor: {name: insertedName}} = token,
				k = i < 0 ? i + this.length : i;
			if (!acceptableIndices[insertedName]?.includes(k)) {
				throw new RangeError(`${this.constructor.name} 的第 ${k} 个子节点不能为 ${insertedName}！`);
			} else if (nodesAfter.some(({constructor: {name}}, j) => !acceptableIndices[name]?.includes(k + j + 1))) {
				throw new Error(`${this.constructor.name} 插入新的第 ${k} 个子节点会破坏规定的顺序！`);
			}
		}
		super.insertAt(token, i);
		if (token.type === 'root') {
			token.type = 'plain';
		}
		return token;
	}

	/**
	 * 规范化页面标题
	 * @browser
	 * @param title 标题（含或不含命名空间前缀）
	 * @param defaultNs 命名空间
	 * @param decode 是否需要解码
	 * @param selfLink 是否允许selfLink
	 */
	normalizeTitle(
		title: string,
		defaultNs = 0,
		halfParsed = false,
		decode = false,
		selfLink = false,
	): import('../lib/title') {
		return Parser.normalizeTitle(title, defaultNs, this.#include, this.#config, halfParsed, decode, selfLink);
	}

	/** @private */
	protected protectChildren(...args: (string | number | Ranges.Range)[]): void {
		this.#protectedChildren.push(...new Ranges(args));
	}

	/**
	 * @override
	 * @param i 移除位置
	 * @throws `Error` 不可移除的子节点
	 */
	override removeAt(i: number): AstNodeTypes {
		if (!Number.isInteger(i)) {
			this.typeError('removeAt', 'Number');
		}
		const iPos = i < 0 ? i + this.length : i;
		if (!Parser.running) {
			const protectedIndices = this.#protectedChildren.applyTo(this.childNodes);
			if (protectedIndices.includes(iPos)) {
				throw new Error(`${this.constructor.name} 的第 ${i} 个子节点不可移除！`);
			} else if (this.#acceptable) {
				const acceptableIndices = Object.fromEntries(
						Object.entries(this.#acceptable).map(([str, ranges]) => [str, ranges.applyTo(this.length - 1)]),
					),
					nodesAfter = i === -1 ? [] : this.childNodes.slice(i + 1);
				if (nodesAfter.some(({constructor: {name}}, j) => !acceptableIndices[name]?.includes(i + j))) {
					throw new Error(`移除 ${this.constructor.name} 的第 ${i} 个子节点会破坏规定的顺序！`);
				}
			}
		}
		return super.removeAt(i);
	}

	/**
	 * 替换为同类节点
	 * @param token 待替换的节点
	 * @throws `Error` 不存在父节点
	 * @throws `Error` 待替换的节点具有不同属性
	 */
	safeReplaceWith(token: this): void {
		const {parentNode} = this;
		if (!parentNode) {
			throw new Error('不存在父节点！');
		} else if (token.constructor !== this.constructor) {
			this.typeError('safeReplaceWith', this.constructor.name);
		}
		try {
			assert.deepEqual(token.getAttribute('acceptable'), this.#acceptable);
		} catch (e) {
			if (e instanceof assert.AssertionError) {
				throw new Error(`待替换的 ${this.constructor.name} 带有不同的 #acceptable 属性！`);
			}
			throw e;
		}
		const i = parentNode.childNodes.indexOf(this);
		super.removeAt.call(parentNode, i);
		super.insertAt.call(parentNode, token, i);
		if (token.type === 'root') {
			token.type = 'plain';
		}
		const e = new Event('replace', {bubbles: true});
		token.dispatchEvent(e, {position: i, oldToken: this, newToken: token});
	}

	/**
	 * 创建HTML注释
	 * @param data 注释内容
	 */
	createComment(data = ''): import('./nowiki/comment') {
		if (typeof data === 'string') {
			const CommentToken = require('./nowiki/comment');
			const config = this.getAttribute('config');
			return Parser.run(() => new CommentToken(data.replaceAll('-->', '--&gt;'), true, config));
		}
		return this.typeError('createComment', 'String');
	}

	/**
	 * 创建标签
	 * @param tagName 标签名
	 * @param options 选项
	 * @param options.selfClosing 是否自封闭
	 * @param options.closing 是否是闭合标签
	 * @throws `RangeError` 非法的标签名
	 */
	createElement(tagName: string, {selfClosing, closing}: {selfClosing?: boolean, closing?: boolean} = {}): TagToken {
		if (typeof tagName !== 'string') {
			this.typeError('createElement', 'String');
		}
		const config = this.getAttribute('config'),
			include = this.getAttribute('include');
		if (tagName === (include ? 'noinclude' : 'includeonly')) {
			const IncludeToken: typeof import('./tagPair/include') = require('./tagPair/include');
			return Parser.run(
				// @ts-expect-error abstract class
				() => new IncludeToken(tagName, '', undefined, selfClosing ? undefined : tagName, config),
			);
		} else if (config.ext.includes(tagName)) {
			const ExtToken: typeof import('./tagPair/ext') = require('./tagPair/ext');
			// @ts-expect-error abstract class
			return Parser.run(() => new ExtToken(tagName, '', '', selfClosing ? undefined : '', config));
		} else if (config.html.flat().includes(tagName)) {
			const HtmlToken: typeof import('./html') = require('./html');
			// @ts-expect-error abstract class
			return Parser.run(() => new HtmlToken(tagName, '', closing, selfClosing, config));
		}
		throw new RangeError(`非法的标签名：${tagName}`);
	}

	/**
	 * 创建纯文本节点
	 * @param data 文本内容
	 */
	createTextNode(data = ''): AstText {
		return typeof data === 'string' ? new AstText(data) : this.typeError('createTextNode', 'String');
	}

	/**
	 * 找到给定位置所在的节点
	 * @param index 位置
	 */
	caretPositionFromIndex(index?: number): CaretPosition | undefined {
		if (index === undefined) {
			return undefined;
		} else if (!Number.isInteger(index)) {
			this.typeError('caretPositionFromIndex', 'Number');
		}
		const {length} = String(this);
		if (index > length || index < -length) {
			return undefined;
		}
		const idx = index < 0 ? index + length : index;
		let self: AstNodeTypes = this,
			acc = 0,
			start = 0;
		while (self.type !== 'text') {
			const {childNodes}: Token = self;
			acc += self.getPadding();
			for (let i = 0; acc <= idx && i < childNodes.length; i++) {
				const cur: AstNodeTypes = childNodes[i]!,
					{length: l} = String(cur);
				acc += l;
				if (acc >= idx) {
					self = cur;
					acc -= l;
					start = acc;
					break;
				}
				acc += self.getGaps(i);
			}
			if (self.childNodes === childNodes) {
				return {offsetNode: self, offset: idx - start};
			}
		}
		return {offsetNode: self, offset: idx - start};
	}

	/**
	 * 找到给定位置所在的节点
	 * @param x 列数
	 * @param y 行数
	 */
	caretPositionFromPoint(x: number, y: number): CaretPosition | undefined {
		return this.caretPositionFromIndex(this.indexFromPos(y, x));
	}

	/**
	 * 找到给定位置所在的最外层节点
	 * @param index 位置
	 * @throws `Error` 不是根节点
	 */
	elementFromIndex(index?: number): AstNodeTypes | undefined {
		if (index === undefined) {
			return undefined;
		} else if (!Number.isInteger(index)) {
			this.typeError('elementFromIndex', 'Number');
		} else if (this.type !== 'root') {
			throw new Error('elementFromIndex方法只可用于根节点！');
		}
		const {length} = String(this);
		if (index > length || index < -length) {
			return undefined;
		}
		const idx = index < 0 ? index + length : index,
			{childNodes} = this;
		let acc = 0,
			i = 0;
		for (; acc < idx && i < childNodes.length; i++) {
			const {length: l} = String(childNodes[i]);
			acc += l;
		}
		return childNodes[i && i - 1];
	}

	/**
	 * 找到给定位置所在的最外层节点
	 * @param x 列数
	 * @param y 行数
	 */
	elementFromPoint(x: number, y: number): AstNodeTypes | undefined {
		return this.elementFromIndex(this.indexFromPos(y, x));
	}

	/**
	 * 找到给定位置所在的所有节点
	 * @param index 位置
	 */
	elementsFromIndex(index?: number): AstNodeTypes[] {
		const offsetNode = this.caretPositionFromIndex(index)?.offsetNode;
		return offsetNode ? [...offsetNode.getAncestors().reverse(), offsetNode] : [];
	}

	/**
	 * 找到给定位置所在的所有节点
	 * @param x 列数
	 * @param y 行数
	 */
	elementsFromPoint(x: number, y: number): AstNodeTypes[] {
		return this.elementsFromIndex(this.indexFromPos(y, x));
	}

	/**
	 * 判断标题是否是跨维基链接
	 * @param title 标题
	 */
	isInterwiki(title: string): [string, string] | null {
		return Parser.isInterwiki(title, this.#config);
	}

	/** @private */
	protected cloneChildNodes(): AstNodeTypes[] {
		return this.childNodes.map(child => child.cloneNode());
	}

	/**
	 * 深拷贝节点
	 * @throws `Error` 未定义复制方法
	 */
	cloneNode(): this {
		if (this.constructor !== Token) {
			throw new Error(`未定义 ${this.constructor.name} 的复制方法！`);
		}
		const cloned = this.cloneChildNodes();
		return Parser.run(() => {
			const token = new Token(undefined, this.#config, false, [], this.#acceptable) as this;
			token.type = this.type;
			token.append(...cloned);
			token.protectChildren(...this.#protectedChildren);
			return token;
		});
	}

	/** 获取全部章节 */
	sections(): (AstText | Token)[][] | undefined {
		if (this.type !== 'root') {
			return undefined;
		}
		const {childNodes} = this,
			headings: [number, number][] = ([...childNodes.entries()]
				.filter(([, {type}]) => type === 'heading') as [number, import('./heading')][])
				.map(([i, {name}]) => [i, Number(name)]),
			lastHeading = [-1, -1, -1, -1, -1, -1],
			sections: (AstText | Token)[][] = new Array(headings.length);
		for (let i = 0; i < headings.length; i++) {
			const [index, level] = headings[i]!;
			for (let j = level; j < 6; j++) {
				const last = lastHeading[j]!;
				if (last >= 0) {
					sections[last] = childNodes.slice(headings[last]![0], index);
				}
				lastHeading[j] = j === level ? i : -1;
			}
		}
		for (const last of lastHeading) {
			if (last >= 0) {
				sections[last] = childNodes.slice(headings[last]![0]);
			}
		}
		sections.unshift(childNodes.slice(0, headings[0]?.[0]));
		return sections;
	}

	/**
	 * 获取指定章节
	 * @param n 章节序号
	 */
	section(n: number): (AstText | Token)[] | undefined {
		return Number.isInteger(n) ? this.sections()?.[n] : this.typeError('section', 'Number');
	}

	/**
	 * 获取指定的外层HTML标签
	 * @param tag HTML标签名
	 * @throws `RangeError` 非法的标签或空标签
	 */
	findEnclosingHtml(tag?: string): [import('./html'), import('./html')] | undefined {
		if (tag !== undefined && typeof tag !== 'string') {
			this.typeError('findEnclosingHtml', 'String');
		}
		const lcTag = tag?.toLowerCase();
		if (lcTag !== undefined && !this.#config.html.slice(0, 2).flat().includes(lcTag)) {
			throw new RangeError(`非法的标签或空标签：${lcTag}`);
		}
		const {parentNode} = this;
		if (!parentNode) {
			return undefined;
		}
		const {childNodes} = parentNode,
			index = childNodes.indexOf(this);
		let i: number;
		for (i = index - 1; i >= 0; i--) {
			const {
				type, name, selfClosing, closing,
			} = childNodes[i] as AstNodeTypes & {selfClosing?: boolean, closing?: boolean};
			if (type === 'html' && (!lcTag || name === lcTag) && selfClosing === false && closing === false) {
				break;
			}
		}
		if (i === -1) {
			return parentNode.findEnclosingHtml(lcTag);
		}
		const opening = childNodes[i] as import('./html');
		for (i = index + 1; i < childNodes.length; i++) {
			const {
				type, name, selfClosing, closing,
			} = childNodes[i] as AstNodeTypes & {selfClosing?: boolean, closing?: boolean};
			if (type === 'html' && name === opening.name && selfClosing === false && closing === true) {
				break;
			}
		}
		return i === childNodes.length
			? parentNode.findEnclosingHtml(lcTag)
			: [opening, childNodes[i] as import('./html')];
	}

	/** 获取全部分类 */
	getCategories(): [string, string | undefined][] {
		const categories = this.querySelectorAll('category') as import('./link/category')[];
		return categories.map(({name, sortkey}) => [name, sortkey]);
	}

	/**
	 * 重新解析单引号
	 * @throws `Error` 不接受QuoteToken作为子节点
	 */
	redoQuotes(): void {
		const acceptable = this.getAttribute('acceptable');
		if (acceptable && !acceptable['QuoteToken']?.some(
			range => typeof range !== 'number' && range.start === 0 && range.end === Infinity && range.step === 1,
		)) {
			throw new Error(`${this.constructor.name} 不接受 QuoteToken 作为子节点！`);
		}
		for (const quote of this.childNodes) {
			if (quote.type === 'quote') {
				quote.replaceWith(String(quote));
			}
		}
		this.normalize();
		const textNodes = [...this.childNodes.entries()]
			.filter(([, {type}]) => type === 'text') as [number, AstText][],
			indices = textNodes.map(([i]) => this.getRelativeIndex(i)),
			token = Parser.run(() => {
				const root = new Token(text(textNodes.map(([, str]) => str)), this.getAttribute('config'));
				return root.setAttribute('stage', 6).parse(7);
			});
		for (const quote of [...token.childNodes].reverse()) {
			if (quote.type === 'quote') {
				const index = quote.getRelativeIndex(),
					n = indices.findLastIndex(textIndex => textIndex <= index),
					cur = this.childNodes[n] as AstText;
				cur.splitText(index - indices[n]!).splitText(Number(quote.name));
				this.removeAt(n + 1);
				this.insertAt(quote, n + 1);
			}
		}
		this.normalize();
	}

	/** 解析部分魔术字 */
	solveConst(): void {
		const targets = this.querySelectorAll('magic-word, arg'),
			magicWords = new Set(['if', 'ifeq', 'switch']);
		for (let i = targets.length - 1; i >= 0; i--) {
			const target = targets[i] as import('./arg') | import('./transclude') & {default: undefined},
				{type, name, default: argDefault, childNodes, length} = target;
			if (type === 'arg' || type === 'magic-word' && magicWords.has(name)) {
				let replace = '';
				if (type === 'arg') {
					replace = argDefault === false ? String(target) : argDefault;
				} else if (name === 'if' && !childNodes[1]?.querySelector('magic-word, template')) {
					replace = String(childNodes[String(childNodes[1] ?? '').trim() ? 2 : 3] ?? '').trim();
				} else if (name === 'ifeq'
					&& !childNodes.slice(1, 3).some(child => child.querySelector('magic-word, template'))
				) {
					replace = String(childNodes[
						String(childNodes[1] ?? '').trim() === String(childNodes[2] ?? '').trim() ? 3 : 4
					] ?? '').trim();
				} else if (name === 'switch' && !childNodes[1]?.querySelector('magic-word, template')) {
					const key = String(childNodes[1] ?? '').trim();
					let defaultVal = '',
						found = false,
						transclusion = false;
					for (let j = 2; j < length; j++) {
						const {anon, name: option, value, firstChild} = childNodes[j] as import('./parameter');
						transclusion = Boolean(firstChild.querySelector('magic-word, template'));
						if (anon) {
							if (j === length - 1) {
								defaultVal = value;
							} else if (transclusion) {
								break;
							} else {
								found ||= key === value;
							}
						} else if (transclusion) {
							break;
						} else if (found || option === key) {
							replace = value;
							break;
						} else if (option.toLowerCase() === '#default') {
							defaultVal = value;
						}
						if (j === length - 1) {
							replace = defaultVal;
						}
					}
					if (transclusion) {
						continue;
					}
					target.replaceWith(replace);
				}
			}
		}
	}
}

Parser.classes['Token'] = __filename;
export = Token;
