import lint_1 = require('../util/lint');
const {generateForSelf, generateForChild} = lint_1;
import type {BoundingRect} from '../util/lint';
import string_1 = require('../util/string');
const {toCase, normalizeSpace, text, removeComment} = string_1;
import * as Parser from '../index';
import Token = require('.');
import AtomToken = require('./atom');
import AttributeToken = require('./attribute');

const stages = {'ext-attrs': 0, 'html-attrs': 2, 'table-attrs': 3};

declare type AttributesTypes = 'ext-attrs' | 'html-attrs' | 'table-attrs';

/**
 * 扩展和HTML标签属性
 * @classdesc `{childNodes: ...AtomToken|AttributeToken}`
 */
abstract class AttributesToken extends Token {
	declare type: AttributesTypes;
	declare name: string;
	declare childNodes: (AtomToken | AttributeToken)[];
	abstract override get children(): (AtomToken | AttributeToken)[];
	abstract override get firstChild(): AtomToken | AttributeToken;
	abstract override get firstElementChild(): AtomToken | AttributeToken;
	abstract override get lastChild(): AtomToken | AttributeToken;
	abstract override get lastElementChild(): AtomToken | AttributeToken;
	abstract override get parentNode(): import('./tagPair/ext') | import('./html') | import('./table/base') | undefined;
	abstract override get parentElement(): import('./tagPair/ext') | import('./html') | import('./table/base') | undefined;

	/** getAttrs()方法的getter写法 */
	get attributes(): Record<string, string | true> {
		return this.getAttrs();
	}

	/** 以字符串表示的class属性 */
	get className(): string {
		const attr = this.getAttr('class');
		return typeof attr === 'string' ? attr : '';
	}

	set className(className) {
		this.setAttr('class', className);
	}

	/** 以Set表示的class属性 */
	get classList(): Set<string> {
		return new Set(this.className.split(/\s/u));
	}

	/** id属性 */
	get id(): string {
		const attr = this.getAttr('id');
		return typeof attr === 'string' ? attr : '';
	}

	set id(id) {
		this.setAttr('id', id);
	}

	/** 是否含有无效属性 */
	get sanitized(): boolean {
		return this.getDirtyAttrs().length === 0;
	}

	/**
	 * @browser
	 * @param attr 标签属性
	 * @param type 标签类型
	 * @param name 标签名
	 */
	constructor(
		attr: string | undefined,
		type: AttributesTypes,
		name: string,
		config = Parser.getConfig(),
		accum: Token[] = [],
	) {
		super(undefined, config, true, accum, {
			AtomToken: ':', AttributeToken: ':',
		});
		this.type = type;
		this.setAttribute('name', name);
		if (attr) {
			const regex = new RegExp(
				`([^\\s/](?:(?!\0\\d+~\x7F)[^\\s/=])*)` // 属性名
				+ '(?:'
				+ '((?:\\s|\0\\d+c\x7F)*' // `=`前的空白字符
				+ '(?:=|\0\\d+~\x7F)' // `=`
				+ '(?:\\s|\0\\d+c\x7F)*)' // `=`后的空白字符
				+ `(?:(["'])(.*?)(\\3|$)|(\\S*))` // 属性值
				+ ')?',
				'gsu',
			);
			let out = '',
				mt = regex.exec(attr) as RegExpExecArray & {1: string} | null,
				lastIndex = 0;
			const insertDirty = /** 插入无效属性 */ (): void => {
				if (out) {
					super.insertAt(new AtomToken(
						out,
						`${type.slice(0, -1)}-dirty` as 'ext-attr-dirty' | 'html-attr-dirty' | 'table-attr-dirty',
						config,
						accum,
						{[`Stage-${stages[type]}`]: ':'},
					));
					out = '';
				}
			};
			while (mt) {
				const {
					index, 0: full, 1: key, 2: equal, 3: quoteStart, 4: quoted, 5: quoteEnd, 6: unquoted,
				} = mt;
				out += attr.slice(lastIndex, index);
				if (/^(?:[\w:]|\0\d+[t!~{}+-]\x7F)(?:[\w:.-]|\0\d+[t!~{}+-]\x7F)*$/u.test(removeComment(key).trim())) {
					const value = quoted ?? unquoted,
						quotes = [quoteStart, quoteEnd],
						// @ts-expect-error abstract class
						token: AttributeToken = new AttributeToken(
							type.slice(0, -1) as 'ext-attr' | 'html-attr' | 'table-attr',
							name,
							key,
							equal,
							value,
							quotes,
							config,
							accum,
						);
					insertDirty();
					super.insertAt(token);
				} else {
					out += full;
				}
				({lastIndex} = regex);
				mt = regex.exec(attr) as RegExpExecArray & {1: string} | null;
			}
			out += attr.slice(lastIndex);
			insertDirty();
		}
	}

	/** @private */
	protected override afterBuild(): void {
		if (this.type === 'table-attrs') {
			const {parentNode} = this as this & {parentNode?: import('./table/trBase') | import('./table/td')};
			this.setAttribute(
				'name',
				parentNode?.type === 'td' && parentNode.subtype === 'caption' ? 'caption' : parentNode?.type,
			);
		}
	}

	/**
	 * 所有指定属性名的AttributeToken
	 * @browser
	 * @param key 属性名
	 */
	getAttrTokens(key: string): AttributeToken[] {
		return typeof key === 'string'
			? this.childNodes.filter(
				child => child instanceof AttributeToken && child.name === key.toLowerCase().trim(),
			) as AttributeToken[]
			: this.typeError('getAttrTokens', 'String');
	}

	/**
	 * 指定属性名的最后一个AttributeToken
	 * @browser
	 * @param key 属性名
	 */
	getAttrToken(key: string): AttributeToken | undefined {
		const tokens = this.getAttrTokens(key);
		return tokens.at(-1);
	}

	/**
	 * 获取标签属性
	 * @browser
	 * @param key 属性键
	 */
	getAttr(key: string): string | true | undefined {
		return this.getAttrToken(key)?.getValue();
	}

	/**
	 * @override
	 * @browser
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const errors = super.lint(start),
			{parentNode, length, childNodes} = this,
			attrs: Record<string, AttributeToken[]> = {},
			duplicated = new Set<string>();
		let rect: BoundingRect | undefined;
		if (parentNode?.type === 'html' && parentNode.closing && this.text().trim()) {
			rect = {start, ...this.getRootNode().posFromIndex(start)};
			errors.push(generateForSelf(this, rect, 'attributes of a closing tag'));
		}
		for (let i = 0; i < length; i++) {
			const attr = childNodes[i]!;
			if (attr instanceof AtomToken && attr.text().trim()) {
				rect ??= {start, ...this.getRootNode().posFromIndex(start)};
				errors.push({
					...generateForChild(attr, rect, 'containing invalid attribute'),
					excerpt: childNodes.slice(i).map(String).join('').slice(0, 50),
				});
			} else if (attr instanceof AttributeToken) {
				const {name} = attr;
				if (Object.hasOwn(attrs, name)) {
					duplicated.add(name);
					attrs[name]!.push(attr);
				} else if (name !== 'class') {
					attrs[name] = [attr];
				}
			}
		}
		if (duplicated.size > 0) {
			rect ??= {start, ...this.getRootNode().posFromIndex(start)};
			for (const key of duplicated) {
				errors.push(...attrs[key]!.map(
					attr => generateForChild(attr, rect!, Parser.msg('duplicated $1 attribute', key)),
				));
			}
		}
		return errors;
	}

	/**
	 * @override
	 * @browser
	 */
	override print(): string {
		return String(this)
			? `<span class="wpb-${this.type}">${this.childNodes.map(child => child.print(
				child instanceof AtomToken && child.text().trim() ? {class: 'hidden'} : undefined,
			)).join('')}</span>`
			: '';
	}

	/** 清理标签属性 */
	sanitize(): void {
		let dirty = false;
		for (let i = this.length - 1; i >= 0; i--) {
			const child = this.childNodes[i];
			if (child instanceof AtomToken && child.text().trim()) {
				dirty = true;
				this.removeAt(i);
			}
		}
		if (!Parser.running && dirty) {
			Parser.warn(`${this.constructor.name}.sanitize 方法将清理无效属性！`);
		}
	}

	/** @override */
	override cloneNode(): this {
		const cloned = this.cloneChildNodes();
		return Parser.run(() => {
			// @ts-expect-error abstract class
			const token: this = new AttributesToken(undefined, this.type, this.name, this.getAttribute('config'));
			token.append(...cloned);
			return token;
		});
	}

	/** 所有无效属性 */
	getDirtyAttrs(): AtomToken[] {
		return this.childNodes.filter(child => child instanceof AtomToken && child.text().trim()) as AtomToken[];
	}

	/**
	 * @override
	 * @param token 待插入的子节点
	 * @param i 插入位置
	 * @throws `RangeError` 不是AttributeToken或标签不匹配
	 */
	override insertAt<T extends AttributeToken>(token: T, i = this.length): T {
		if (!(token instanceof AttributeToken)) {
			throw new RangeError(`${this.constructor.name}只能插入AttributeToken！`);
		} else if (token.type !== this.type.slice(0, -1) || token.tag !== this.name) {
			throw new RangeError(`待插入的AttributeToken只可用于${token.tag}标签！`);
		} else if (i === this.length) {
			const {lastChild} = this;
			if (lastChild instanceof AttributeToken) {
				lastChild.close();
			}
		} else {
			token.close();
		}
		if (this.closest('parameter')) {
			token.escape();
		}
		super.insertAt(token, i);
		const {previousVisibleSibling, nextVisibleSibling} = token,
			type = `${this.type.slice(0, -1)}-dirty` as 'ext-attr-dirty' | 'html-attr-dirty' | 'table-attr-dirty',
			config = this.getAttribute('config'),
			acceptable = {[`Stage-${stages[this.type]}`]: ':'};
		if (nextVisibleSibling && !/^\s/u.test(String(nextVisibleSibling))) {
			super.insertAt(Parser.run(() => new AtomToken(' ', type, config, [], acceptable)), i + 1);
		}
		if (previousVisibleSibling && !/\s$/u.test(String(previousVisibleSibling))) {
			super.insertAt(Parser.run(() => new AtomToken(' ', type, config, [], acceptable)), i);
		}
		return token;
	}

	/**
	 * 设置标签属性
	 * @param key 属性键
	 * @param value 属性值
	 * @throws `RangeError` 扩展标签属性不能包含">"
	 * @throws `RangeError` 无效的属性名
	 */
	setAttr(key: string, value: string | boolean): void {
		if (typeof key !== 'string' || typeof value !== 'string' && typeof value !== 'boolean') {
			this.typeError('setAttr', 'String', 'Boolean');
		} else if (this.type === 'ext-attrs' && typeof value === 'string' && value.includes('>')) {
			throw new RangeError('扩展标签属性不能包含 ">"！');
		}
		const k = key.toLowerCase().trim(),
			attr = this.getAttrToken(k);
		if (attr) {
			attr.setValue(value);
			return;
		} else if (value === false) {
			return;
		}
		const config = this.getAttribute('config'),
			include = this.getAttribute('include'),
			parsedKey = this.type === 'ext-attrs'
				? k
				: Parser.run(() => String(new Token(k, config).parseOnce(0, include).parseOnce()));
		if (!/^(?:[\w:]|\0\d+[t!~{}+-]\x7F)(?:[\w:.-]|\0\d+[t!~{}+-]\x7F)*$/u.test(parsedKey)) {
			throw new RangeError(`无效的属性名：${k}！`);
		}
		// @ts-expect-error abstract class
		const newAttr = Parser.run(() => new AttributeToken(
			this.type.slice(0, -1) as 'ext-attr' | 'html-attr' | 'table-attr',
			this.name,
			k,
			value === true ? '' : '=',
			value === true ? '' : value,
			['"', '"'],
			config,
		) as AttributeToken);
		this.insertAt(newAttr);
	}

	/** @private */
	protected override matchesAttr(key: string, equal?: string, val = '', i?: string): boolean {
		if (!equal) {
			return this.hasAttr(key);
		} else if (!this.hasAttr(key)) {
			return equal === '!=';
		}
		const v = toCase(val, i),
			attr = this.getAttr(key)!,
			thisVal = toCase(attr === true ? '' : attr, i);
		switch (equal) {
			case '~=':
				return attr !== true && thisVal.split(/\s/u).includes(v);
			case '|=': // 允许`val === ''`
				return thisVal === v || thisVal.startsWith(`${v}-`);
			case '^=':
				return attr !== true && thisVal.startsWith(v);
			case '$=':
				return attr !== true && thisVal.endsWith(v);
			case '*=':
				return attr !== true && thisVal.includes(v);
			case '!=':
				return thisVal !== v;
			default: // `=`
				return thisVal === v;
		}
	}

	/**
	 * 标签是否具有某属性
	 * @param key 属性键
	 */
	hasAttr(key: string): boolean {
		return typeof key === 'string'
			? this.getAttrTokens(key).length > 0
			: this.typeError('hasAttr', 'String');
	}

	/** 获取全部的标签属性名 */
	getAttrNames(): Set<string> {
		return new Set(this.childNodes.filter(child => child instanceof AttributeToken).map(({name}) => name!));
	}

	/** 标签是否具有任意属性 */
	hasAttrs(): boolean {
		return this.getAttrNames().size > 0;
	}

	/** 获取全部标签属性 */
	getAttrs(): Record<string, string | true> {
		const attrs = this.childNodes.filter(child => child instanceof AttributeToken) as AttributeToken[];
		return Object.fromEntries(attrs.map(({name, value}) => [name, value]));
	}

	/**
	 * 移除标签属性
	 * @param key 属性键
	 */
	removeAttr(key: string): void {
		for (const attr of this.getAttrTokens(key)) {
			attr.remove();
		}
	}

	/**
	 * 开关标签属性
	 * @param key 属性键
	 * @param force 强制开启或关闭
	 * @throws `RangeError` 不为Boolean类型的属性值
	 */
	toggleAttr(key: string, force?: boolean): void {
		if (typeof key !== 'string') {
			this.typeError('toggleAttr', 'String');
		}
		const k = key.toLowerCase().trim(),
			attr = this.getAttrToken(k);
		if (attr && attr.getValue() !== true) {
			throw new RangeError(`${k} 属性的值不为 Boolean！`);
		} else if (attr) {
			attr.setValue(force === true);
		} else if (force !== false) {
			this.setAttr(k, true);
		}
	}

	/**
	 * 生成引导空格
	 * @param str 属性字符串
	 */
	#leadingSpace(str: string): string {
		const {type} = this,
			leadingRegex = {'ext-attrs': /^\s/u, 'html-attrs': /^[/\s]/u};
		return str && type !== 'table-attrs' && !leadingRegex[type].test(str) ? ' ' : '';
	}

	/** @override */
	override toString(selector?: string): string {
		if (this.type === 'table-attrs') {
			normalizeSpace(this);
		}
		const str = super.toString(selector);
		return `${this.#leadingSpace(str)}${str}`;
	}

	/** @private */
	protected override getPadding(): number {
		return this.#leadingSpace(super.toString()).length;
	}

	/** @override */
	override text(): string {
		if (this.type === 'table-attrs') {
			normalizeSpace(this);
		}
		const str = text(this.childNodes.filter(child => child instanceof AttributeToken), ' ');
		return `${this.#leadingSpace(str)}${str}`;
	}
}

Parser.classes['AttributesToken'] = __filename;
export = AttributesToken;
