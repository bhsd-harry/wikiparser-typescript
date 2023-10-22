import lint_1 = require('../util/lint');
const {generateForChild} = lint_1;
import type {BoundingRect} from '../util/lint';
import Parser = require('../index');
import Token = require('.');
import ExtToken = require('./tagPair/ext');
import NoincludeToken = require('./nowiki/noinclude');
import CommentToken = require('./nowiki/comment');
import AttributesToken = require('./attributes');
import type {Inserted, InsertionReturn} from '../lib/node';

declare type NestedInner = ExtToken | NoincludeToken | CommentToken;

/**
 * 嵌套式的扩展标签
 * @classdesc `{childNodes: ...ExtToken|NoincludeToken|CommentToken}`
 */
abstract class NestedToken extends Token {
	/** @browser */
	override readonly type = 'ext-inner';
	declare childNodes: NestedInner[];
	abstract override get children(): NestedInner[];
	abstract override get firstChild(): NestedInner | undefined;
	abstract override get firstElementChild(): NestedInner | undefined;
	abstract override get lastChild(): NestedInner | undefined;
	abstract override get lastElementChild(): NestedInner | undefined;
	abstract override get nextSibling(): undefined;
	abstract override get nextElementSibling(): undefined;
	abstract override get previousSibling(): AttributesToken;
	abstract override get previousElementSibling(): AttributesToken;
	abstract override get parentNode(): ExtToken | undefined;
	abstract override get parentElement(): ExtToken | undefined;

	#tags: (string | undefined)[];

	/**
	 * @browser
	 * @param regex 内层正则
	 * @param tags 内层标签名
	 */
	constructor(
		wikitext: string | undefined,
		regex: RegExp,
		tags: string[],
		config = Parser.getConfig(),
		accum: Token[] = [],
	) {
		const text = wikitext?.replace(
			regex,
			(comment, name?: string, attr?: string, inner?: string, closing?: string) => {
				const str = `\0${accum.length + 1}${name ? 'e' : 'c'}\x7F`;
				if (name) {
					// @ts-expect-error abstract class
					new ExtToken(name, attr, inner, closing, config, accum);
				} else {
					const closed = comment.endsWith('-->');
					// @ts-expect-error abstract class
					new CommentToken(comment.slice(4, closed ? -3 : undefined), closed, config, accum);
				}
				return str;
			},
		)?.replace(
			/(?<=^|\0\d+[ce]\x7F)[^\0]+(?=$|\0\d+[ce]\x7F)/gu,
			substr => {
				// @ts-expect-error abstract class
				new NoincludeToken(substr, config, accum);
				return `\0${accum.length}c\x7F`;
			},
		);
		super(text, config, true, accum, {
			NoincludeToken: ':', ExtToken: ':',
		});
		this.#tags = tags;
	}

	/**
	 * @override
	 * @browser
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		let rect: BoundingRect | undefined;
		return [
			...super.lint(start),
			...this.childNodes.filter(child => {
				if (child.type === 'ext' || child.type === 'comment') {
					return false;
				}
				const str = String(child).trim();
				return str && !/^<!--.*-->$/su.test(str);
			}).map(child => {
				rect ??= {start, ...this.getRootNode().posFromIndex(start)};
				return generateForChild(child, rect, Parser.msg('invalid content in <$1>', this.name));
			}),
		];
	}

	/**
	 * @override
	 * @param token 待插入的子节点
	 * @param i 插入位置
	 */
	override insertAt<T extends Inserted>(token: T, i = this.length): InsertionReturn<T> {
		return typeof token !== 'string' && token.type === 'ext' && !this.#tags.includes(token.name)
			? this.typeError(`${this.constructor.name}只能以${this.#tags.join('或')}标签作为子节点！`)
			: super.insertAt(token, i);
	}

	/** @override */
	override cloneNode(this: this & {constructor: new (...args: unknown[]) => unknown}): this {
		const cloned = this.cloneChildNodes(),
			config = this.getAttribute('config');
		return Parser.run(() => {
			const token = new this.constructor(undefined, config) as this;
			token.append(...cloned);
			return token;
		});
	}
}

Parser.classes['NestedToken'] = __filename;
export = NestedToken;