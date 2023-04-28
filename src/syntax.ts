import Parser = require('../index');
import debug_1 = require('../util/debug');
const {undo} = debug_1;
import string_1 = require('../util/string');
const {text} = string_1;
import Token = require('.');
import {TokenAttributeGetter, Inserted} from '../lib/node';

declare type SyntaxTypes = 'plain' | 'heading-trail' | 'magic-word-name' | 'table-syntax';

/** 满足特定语法格式的plain Token */
class SyntaxToken extends Token {
	declare type: SyntaxTypes;
	#pattern;

	/**
	 * @browser
	 * @param pattern 语法正则
	 * @throws `RangeError` 含有g修饰符的语法正则
	 */
	constructor(
		wikitext: string | undefined,
		pattern: RegExp,
		type: SyntaxTypes = 'plain',
		config = Parser.getConfig(),
		accum: Token[] = [],
		acceptable?: Acceptable,
	) {
		if (pattern.global) {
			throw new RangeError(`SyntaxToken 的语法正则不能含有 g 修饰符：${String(pattern)}`);
		}
		super(wikitext, config, true, accum, acceptable);
		this.type = type;
		this.#pattern = pattern;
	}

	/** @override */
	override cloneNode() {
		const cloned = this.cloneChildNodes(),
			config = this.getAttribute('config'),
			acceptable = this.getAttribute('acceptable');
		return Parser.run(() => {
			const token = new SyntaxToken(undefined, this.#pattern, this.type, config, [], acceptable);
			token.append(...cloned);
			token.afterBuild();
			return token as this;
		});
	}

	/** @private */
	override afterBuild() {
		const /** @implements */ syntaxListener: AstListener = (e, data) => {
			const pattern = this.#pattern;
			if (!Parser.running && !pattern.test(this.text())) {
				undo(e, data);
				Parser.error(`不可修改 ${this.constructor.name} 的语法！`, pattern);
				throw new Error(`不可修改 ${this.constructor.name} 的语法！`);
			}
		};
		this.addEventListener(['remove', 'insert', 'replace', 'text'], syntaxListener);
	}

	/** @private */
	override getAttribute<T extends string>(key: T) {
		return key === 'pattern' ? this.#pattern as TokenAttributeGetter<T> : super.getAttribute(key);
	}

	/** @private */
	override hasAttribute(key: string) {
		return key === 'pattern' || super.hasAttribute(key);
	}

	/**
	 * @override
	 * @param elements 待替换的子节点
	 */
	override replaceChildren(...elements: Inserted[]) {
		if (this.#pattern.test(text(elements))) {
			Parser.run(() => {
				super.replaceChildren(...elements);
			});
		}
	}
}

Parser.classes['SyntaxToken'] = __filename;
export = SyntaxToken;
