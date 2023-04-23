import {noWrap, extUrlChar, extUrlCharFirst} from '../util/string';
import {generateForChild} from '../util/lint';
import fixed = require('../mixin/fixed');
import Parser = require('..');
import Token = require('.');

/**
 * 模板或魔术字参数
 * @classdesc `{childNodes: [Token, Token]}`
 */
class ParameterToken extends fixed(Token) {
	/** @browser */
	override readonly type = 'parameter';
	declare childNodes: [Token, Token];
	// @ts-expect-error declare accessor
	declare children: [Token, Token];
	// @ts-expect-error declare accessor
	declare firstChild: Token;
	// @ts-expect-error declare accessor
	declare firstElementChild: Token;
	// @ts-expect-error declare accessor
	declare lastChild: Token;
	// @ts-expect-error declare accessor
	declare lastElementChild: Token;
	// @ts-expect-error declare accessor
	declare parentNode: import('./transclude');
	// @ts-expect-error declare accessor
	declare parentElement: import('./transclude');
	// @ts-expect-error declare accessor
	declare nextSibling: ParameterToken | undefined;
	// @ts-expect-error declare accessor
	declare nextElementSibling: ParameterToken | undefined;
	// @ts-expect-error declare accessor
	declare previousSibling: Token;
	// @ts-expect-error declare accessor
	declare previousElementSibling: Token;

	/**
	 * 是否是匿名参数
	 * @browser
	 */
	get anon() {
		return this.firstChild.length === 0;
	}

	/** getValue()的getter */
	get value() {
		return this.getValue();
	}

	set value(value) {
		this.setValue(value);
	}

	/** 是否是重复参数 */
	get duplicated() {
		try {
			return Boolean(this.parentNode?.getDuplicatedArgs()?.some(([key]) => key === this.name));
		} catch {
			return false;
		}
	}

	/**
	 * @browser
	 * @param key 参数名
	 * @param value 参数值
	 */
	constructor(key?: string | number, value?: string, config = Parser.getConfig(), accum: Token[] = []) {
		super(undefined, config, true, accum);
		const keyToken = new Token(typeof key === 'number' ? undefined : key, config, true, accum, {
				'Stage-11': ':', '!HeadingToken': '',
			}),
			token = new Token(value, config, true, accum);
		keyToken.type = 'parameter-key';
		token.type = 'parameter-value';
		this.append(keyToken, token.setAttribute('stage', 2));
	}

	/** @private */
	override afterBuild() {
		if (!this.anon) {
			const name = this.firstChild.toString('comment, noinclude, include')
					.replace(/^[ \t\n\0\v]+|(?<=[^ \t\n\0\v])[ \t\n\0\v]+$/gu, ''),
				{parentNode} = this;
			this.setAttribute('name', name);
			parentNode.getAttribute('keys').add(name);
			parentNode.getArgs(name, false, false).add(this);
		}
		const /** @implements */ parameterListener: AstListener = ({prevTarget}, data) => {
			if (!this.anon) { // 匿名参数不管怎么变动还是匿名
				const {firstChild, name} = this;
				if (prevTarget === firstChild) {
					const newKey = firstChild.toString('comment, noinclude, include')
						.replace(/^[ \t\n\0\v]+|(?<=[^ \t\n\0\v])[ \t\n\0\v]+$/gu, '');
					data.oldKey = name;
					data.newKey = newKey;
					this.setAttribute('name', newKey);
				}
			}
		};
		this.addEventListener(['remove', 'insert', 'replace', 'text'], parameterListener);
	}

	/**
	 * @override
	 * @browser
	 */
	override toString(selector?: string) {
		return this.anon && !(selector && this.matches(selector))
			? this.lastChild.toString(selector)
			: super.toString(selector, '=');
	}

	/**
	 * @override
	 * @browser
	 */
	override text() {
		return this.anon ? this.lastChild.text() : super.text('=');
	}

	/** @private */
	override getGaps(): number {
		return this.anon ? 0 : 1;
	}

	/**
	 * @override
	 * @browser
	 */
	override print() {
		return super.print({sep: this.anon ? '' : '='});
	}

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()) {
		const errors = super.lint(start),
			{firstChild, lastChild} = this,
			link = new RegExp(`https?://${extUrlCharFirst}${extUrlChar}$`, 'iu')
				.exec(firstChild.toString('comment, noinclude, include'))?.[0];
		if (link && new URL(link).search) {
			const e = generateForChild(firstChild, {start}, 'unescaped query string in an anonymous parameter');
			errors.push({
				...e,
				startIndex: e.endIndex,
				endIndex: e.endIndex + 1,
				startLine: e.endLine,
				startCol: e.endCol,
				endCol: e.endCol + 1,
				excerpt: `${String(firstChild).slice(-25)}=${String(lastChild).slice(0, 25)}`,
			});
		}
		return errors;
	}

	/** @override */
	override cloneNode() {
		const [key, value] = this.cloneChildNodes() as [Token, Token],
			config = this.getAttribute('config');
		return Parser.run(() => {
			const token = new ParameterToken(this.anon ? Number(this.name) : undefined, undefined, config);
			token.firstChild.safeReplaceWith(key);
			token.lastChild.safeReplaceWith(value);
			token.afterBuild();
			return token as this;
		});
	}

	/**
	 * @override
	 * @param token 待替换的节点
	 */
	override safeReplaceWith(token: this) {
		Parser.warn(`${this.constructor.name}.safeReplaceWith 方法退化到 replaceWith。`);
		return this.replaceWith(token);
	}

	/** 获取参数值 */
	getValue() {
		const value = this.lastChild.text();
		return this.anon && this.parentNode?.isTemplate() ? value : value.trim();
	}

	/**
	 * 设置参数值
	 * @param value 参数值
	 * @throws `SyntaxError` 非法的模板参数
	 */
	setValue(value: string) {
		const templateLike = this.parentNode?.isTemplate(),
			wikitext = `{{${templateLike ? ':T|' : 'lc:'}${this.anon ? '' : '1='}${value}}}`,
			root = Parser.parse(wikitext, this.getAttribute('include'), 2, this.getAttribute('config')),
			{length, firstChild: transclude} = root,
			{lastChild: parameter, type, name, length: transcludeLength} = transclude as import('./transclude') & {
				lastChild: ParameterToken,
			},
			targetType = templateLike ? 'template' : 'magic-word',
			targetName = templateLike ? 'T' : 'lc';
		if (length !== 1 || type !== targetType || name !== targetName || transcludeLength !== 2
			|| parameter.anon !== this.anon || parameter.name !== '1'
		) {
			throw new SyntaxError(`非法的模板参数：${noWrap(value)}`);
		}
		const {lastChild} = parameter;
		parameter.destroy();
		this.lastChild.safeReplaceWith(lastChild);
	}

	/**
	 * 修改参数名
	 * @param key 新参数名
	 * @param force 是否无视冲突命名
	 * @throws `Error` 仅用于模板参数
	 * @throws `SyntaxError` 非法的模板参数名
	 * @throws `RangeError` 更名造成重复参数
	 */
	rename(key: string, force = false) {
		const {parentNode} = this;
		// 必须检测是否是TranscludeToken
		if (!parentNode.isTemplate()) {
			throw new Error(`${this.constructor.name}.rename 方法仅用于模板参数！`);
		}
		const root = Parser.parse(`{{:T|${key}=}}`, this.getAttribute('include'), 2, this.getAttribute('config')),
			{length, firstChild: template} = root,
			{type, name, lastChild: parameter, length: templateLength} = template as import('./transclude') & {
				lastChild: ParameterToken,
			};
		if (length !== 1 || type !== 'template' || name !== 'T' || templateLength !== 2) {
			throw new SyntaxError(`非法的模板参数名：${key}`);
		}
		const {name: parameterName, firstChild} = parameter;
		if (this.name === parameterName) {
			Parser.warn('未改变实际参数名', parameterName);
		} else if (parentNode.hasArg(parameterName)) {
			if (force) {
				Parser.warn('参数更名造成重复参数', parameterName);
			} else {
				throw new RangeError(`参数更名造成重复参数：${parameterName}`);
			}
		}
		parameter.destroy();
		this.firstChild.safeReplaceWith(firstChild);
	}
}

Parser.classes['ParameterToken'] = __filename;
export = ParameterToken;