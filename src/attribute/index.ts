import {generateForChild} from '../../util/lint';
import {noWrap, removeComment} from '../../util/string';
import fixed = require('../../mixin/fixed');
import Parser = require('../..');
import Token = require('..');
import AtomToken = require('../atom');
import {TokenAttributeGetter} from '../../lib/node';

declare type AttributeTypes = 'ext-attr' | 'html-attr' | 'table-attr';

const stages = {'ext-attr': 0, 'html-attr': 2, 'table-attr': 3},
	pre = {'ext-attr': '<pre ', 'html-attr': '<p ', 'table-attr': '{|'},
	post = {'ext-attr': '/>', 'html-attr': '>', 'table-attr': ''},
	blockAttrs = new Set(['align']),
	citeAttrs = new Set(['cite']),
	citeAndAttrs = new Set(['cite', 'datetime']),
	widthAttrs = new Set(['width']),
	tdAttrs = new Set(
		['align', 'valign', 'abbr', 'axis', 'headers', 'scope', 'rowspan', 'colspan', 'width', 'height', 'bgcolor'],
	),
	typeAttrs = new Set(['type']),
	insecureStyle = new RegExp(
		`${
			'expression'
		}|${
			'(?:filter|accelerator|-o-link(?:-source)?|-o-replace)\\s*:'
		}|${
			'(?:url|image(?:-set)?)\\s*\\('
		}|${
			'attr\\s*\\([^)]+[\\s,]url'
		}`,
		'u',
	);

/**
 * 扩展和HTML标签属性
 * @classdesc `{childNodes: [AtomToken, Token]}`
 */
class AttributeToken extends fixed(Token) {
	static commonHtmlAttrs = new Set([
		'id',
		'class',
		'style',
		'lang',
		'dir',
		'title',
		'tabindex',
		'aria-describedby',
		'aria-flowto',
		'aria-hidden',
		'aria-label',
		'aria-labelledby',
		'aria-owns',
		'role',
		'about',
		'property',
		'resource',
		'datatype',
		'typeof',
		'itemid',
		'itemprop',
		'itemref',
		'itemscope',
		'itemtype',
	]);

	static htmlAttrs: Record<string, Set<string>> = {
		div: blockAttrs,
		h1: blockAttrs,
		h2: blockAttrs,
		h3: blockAttrs,
		h4: blockAttrs,
		h5: blockAttrs,
		h6: blockAttrs,
		blockquote: citeAttrs,
		q: citeAttrs,
		p: blockAttrs,
		br: new Set(['clear']),
		pre: widthAttrs,
		ins: citeAndAttrs,
		del: citeAndAttrs,
		ul: typeAttrs,
		ol: new Set(['type', 'start', 'reversed']),
		li: new Set(['type', 'value']),
		table: new Set(
			['summary', 'width', 'border', 'frame', 'rules', 'cellspacing', 'cellpadding', 'align', 'bgcolor'],
		),
		caption: blockAttrs,
		tr: new Set(['bgcolor', 'align', 'valign']),
		td: tdAttrs,
		th: tdAttrs,
		img: new Set(['alt', 'src', 'width', 'height', 'srcset']),
		font: new Set(['size', 'color', 'face']),
		hr: widthAttrs,
		rt: new Set(['rbspan']),
		data: new Set(['value']),
		time: new Set(['datetime']),
		meta: new Set(['itemprop', 'content']),
		link: new Set(['itemprop', 'href', 'title']),
		gallery: new Set(['mode', 'showfilename', 'caption', 'perrow', 'widths', 'heights', 'showthumbnails', 'type']),
		poem: new Set(['compact', 'align']),
		categorytree: new Set([
			'align',
			'hideroot',
			'onlyroot',
			'depth',
			'mode',
			'hideprefix',
			'namespaces',
			'showcount',
			'notranslations',
		]),
		combooption: new Set(['name', 'for', 'inline', 'align']),
	};

	declare type: AttributeTypes;
	declare childNodes: [AtomToken, Token];
	// @ts-expect-error declare accessor
	declare children: [AtomToken, Token];
	// @ts-expect-error declare accessor
	declare firstChild: AtomToken;
	// @ts-expect-error declare accessor
	declare firstElementChild: AtomToken;
	// @ts-expect-error declare accessor
	declare lastChild: Token;
	// @ts-expect-error declare accessor
	declare lastElementChild: Token;

	/** @browser */
	#equal;
	/** @browser */
	#quotes;
	/** @browser */
	#tag;

	/**
	 * 引号是否匹配
	 * @browser
	 */
	get balanced() {
		return !this.#equal || this.#quotes[0] === this.#quotes[1];
	}

	/**
	 * 标签名
	 * @browser
	 */
	get tag() {
		return this.#tag;
	}

	/**
	 * getValue()的getter
	 * @browser
	 */
	get value() {
		return this.getValue();
	}

	set value(value) {
		this.setValue(value);
	}

	/**
	 * @browser
	 * @param type 标签类型
	 * @param tag 标签名
	 * @param key 属性名
	 * @param equal 等号
	 * @param value 属性值
	 * @param quotes 引号
	 */
	constructor(
		type: AttributeTypes,
		tag: string,
		key: string,
		equal = '',
		value = '',
		quotes: [string?, string?] = [],
		config = Parser.getConfig(),
		accum: Token[] = [],
	) {
		const keyToken = new AtomToken(key, 'attr-key', config, accum, {
			[type === 'ext-attr' ? 'AstText' : 'Stage-1']: ':', ArgToken: ':', TranscludeToken: ':',
		});
		let valueToken;
		if (key === 'title') {
			valueToken = new Token(value, config, true, accum, {
				[`Stage-${stages[type]}`]: ':', ConverterToken: ':',
			});
			valueToken.type = 'attr-value';
			valueToken.setAttribute('stage', Parser.MAX_STAGE - 1);
		} else if (tag === 'gallery' && key === 'caption') {
			const newConfig = {...config, excludes: [...config.excludes!, 'quote', 'extLink', 'magicLink', 'list']};
			valueToken = new Token(value, newConfig, true, accum, {
				AstText: ':', LinkToken: ':', FileToken: ':', CategoryToken: ':', ConverterToken: ':',
			});
			valueToken.type = 'attr-value';
			valueToken.setAttribute('stage', 5);
		} else if (tag === 'choose' && (key === 'before' || key === 'after')) {
			const newConfig = {...config, excludes: [...config.excludes!, 'heading', 'html', 'table', 'hr', 'list']};
			valueToken = new Token(value, newConfig, true, accum, {
				ArgToken: ':',
				TranscludeToken: ':',
				LinkToken: ':',
				FileToken: ':',
				CategoryToken: ':',
				QuoteToken: ':',
				ExtLinkToken: ':',
				MagicLinkToken: ':',
				ConverterToken: ':',
			});
			valueToken.type = 'attr-value';
			valueToken.setAttribute('stage', 1);
		} else {
			valueToken = new AtomToken(value, 'attr-value', config, accum, {
				[`Stage-${stages[type]}`]: ':',
			});
		}
		super(undefined, config, true, accum);
		this.type = type;
		this.append(keyToken, valueToken);
		this.#equal = equal;
		this.#quotes = quotes;
		this.#tag = tag;
		this.setAttribute('name', removeComment(key).trim().toLowerCase());
	}

	/** @private */
	override afterBuild() {
		if (this.#equal.includes('\0')) {
			this.#equal = this.buildFromStr(this.#equal, 'string');
		}
		if (this.parentNode) {
			this.#tag = this.parentNode.name;
		}
		this.setAttribute('name', this.firstChild.text().trim().toLowerCase());
	}

	/**
	 * @override
	 * @browser
	 */
	override toString(selector?: string) {
		if (selector && this.matches(selector)) {
			return '';
		}
		const [quoteStart = '', quoteEnd = ''] = this.#quotes;
		return this.#equal
			? `${super.toString(selector, `${this.#equal}${quoteStart}`)}${quoteEnd}`
			: this.firstChild.toString(selector);
	}

	/**
	 * @override
	 * @browser
	 */
	override text() {
		return this.#equal ? `${super.text(`${this.#equal.trim()}"`)}"` : this.firstChild.text();
	}

	/** @private */
	override getGaps() {
		return this.#equal ? this.#equal.length + (this.#quotes[0]?.length ?? 0) : 0;
	}

	/**
	 * @override
	 * @browser
	 */
	override print() {
		const [quoteStart = '', quoteEnd = ''] = this.#quotes;
		return this.#equal ? super.print({sep: `${this.#equal}${quoteStart}`, post: quoteEnd}) : super.print();
	}

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()) {
		const errors = super.lint(start),
			{balanced, lastChild, name, value} = this;
		let rect;
		if (!balanced) {
			const root = this.getRootNode();
			rect = {start, ...root.posFromIndex(start)};
			const e = generateForChild(lastChild, rect, 'unclosed quotes', 'warning'),
				startIndex = e.startIndex - 1,
				startCol = e.startCol - 1;
			errors.push({...e, startIndex, startCol, excerpt: String(root).slice(startIndex, startIndex + 50)});
		}
		if (name === 'style' && typeof value === 'string' && insecureStyle.test(value)) {
			rect ||= {start, ...this.getRootNode().posFromIndex(start)};
			errors.push(generateForChild(lastChild, rect, 'insecure style'));
		}
		return errors;
	}

	/**
	 * 获取属性值
	 * @browser
	 */
	getValue() {
		if (this.#equal) {
			const value = this.lastChild.text();
			if (this.#quotes[1]) {
				return value;
			}
			return this.#quotes[0] ? value.trimEnd() : value.trim();
		}
		return true;
	}

	/** @private */
	override getAttribute<T extends string>(key: T) {
		if (key === 'equal') {
			return this.#equal as TokenAttributeGetter<T>;
		}
		return key === 'quotes'
			? this.#quotes as TokenAttributeGetter<T>
			: super.getAttribute(key);
	}

	/** @private */
	override hasAttribute(key: string) {
		return key === 'equal' || key === 'quotes' || super.hasAttribute(key);
	}

	/** @override */
	override cloneNode(this: AttributeToken & {constructor: typeof AttributeToken}) {
		const [key, value] = this.cloneChildNodes() as [AtomToken, Token],
			config = this.getAttribute('config');
		return Parser.run(() => {
			const token = new this.constructor(this.type, this.#tag, '', this.#equal, '', this.#quotes, config);
			token.firstChild.safeReplaceWith(key);
			token.lastChild.safeReplaceWith(value);
			token.afterBuild();
			return token as this;
		});
	}

	/**
	 * 转义等号
	 * @throws `Error` 扩展标签属性不需要转义等号
	 */
	escape() {
		if (this.type === 'ext-attr') {
			throw new Error('扩展标签属性不需要转义等号！');
		}
		this.#equal = '{{=}}';
	}

	/** 闭合引号 */
	close() {
		const [quote] = this.#quotes;
		if (quote) {
			this.#quotes[1] = quote;
		}
	}

	/**
	 * 设置属性值
	 * @param value 参数值
	 * @throws `SyntaxError` 非法的标签属性
	 */
	setValue(value: string | boolean) {
		if (value === false) {
			this.remove();
			return;
		} else if (value === true) {
			this.#equal = '';
			return;
		}
		const {type} = this,
			key = this.name === 'title' ? 'title' : 'data',
			wikitext = `${pre[type]}${key}="${value}"${post[type]}`,
			root = Parser.parse(wikitext, this.getAttribute('include'), stages[type] + 1, this.getAttribute('config')),
			{length, firstChild: tag} = root as Token & {firstChild: Token};
		let attrs;
		if (length !== 1 || tag.type !== type.slice(0, -5)) {
			throw new SyntaxError(`非法的标签属性：${noWrap(value)}`);
		} else if (type === 'table-attr') {
			if (tag.length !== 2) {
				throw new SyntaxError(`非法的标签属性：${noWrap(value)}`);
			}
			attrs = tag.lastChild as import('../attributes');
		} else {
			attrs = tag.firstChild as import('../attributes');
		}
		const {length: attrsLength, firstChild} = attrs;
		if (attrsLength !== 1 || firstChild.type !== this.type || firstChild.name !== key) {
			throw new SyntaxError(`非法的标签属性：${noWrap(value)}`);
		}
		const {lastChild} = firstChild;
		firstChild.destroy();
		this.lastChild.safeReplaceWith(lastChild);
		if (this.#quotes[0]) {
			this.close();
		} else {
			this.#quotes = ['"', '"'] as [string, string];
		}
	}

	/**
	 * 修改属性名
	 * @param key 新属性名
	 * @throws `Error` title属性不能更名
	 * @throws `SyntaxError` 非法的模板参数名
	 */
	rename(key: string) {
		if (this.name === 'title') {
			throw new Error('title 属性不能更名！');
		}
		const {type} = this,
			wikitext = `${pre[type]}${key}${post[type]}`,
			root = Parser.parse(wikitext, this.getAttribute('include'), stages[type] + 1, this.getAttribute('config')),
			{length, firstChild: tag} = root as Token & {firstChild: Token};
		let attrs;
		if (length !== 1 || tag.type !== type.slice(0, -5)) {
			throw new SyntaxError(`非法的标签属性名：${noWrap(key)}`);
		} else if (type === 'table-attr') {
			if (tag.length !== 2) {
				throw new SyntaxError(`非法的标签属性名：${noWrap(key)}`);
			}
			attrs = tag.lastChild;
		} else {
			attrs = tag.firstChild;
		}
		const {length: attrsLength, firstChild: attr} = attrs as import('../attributes');
		if (attrsLength !== 1 || attr.type !== this.type || attr.value !== true) {
			throw new SyntaxError(`非法的标签属性名：${noWrap(key)}`);
		}
		const {firstChild} = attr;
		attr.destroy();
		this.firstChild.safeReplaceWith(firstChild);
	}
}

Parser.classes['AttributeToken'] = __filename;
export = AttributeToken;
