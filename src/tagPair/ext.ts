import lint_1 = require('../../util/lint');
const {generateForSelf} = lint_1;
import base_1 = require('../../util/base');
const {del} = base_1;
import attributesParent = require('../../mixin/attributesParent');
import Parser = require('../../index');
import Token = require('..');
import TagPairToken = require('.');
import AttributesToken = require('../attributes');

/**
 * 扩展标签
 * @classdesc `{childNodes: [AttributesToken, Token]}`
 */
abstract class ExtToken extends attributesParent(TagPairToken) {
	override readonly type = 'ext';
	declare childNodes: [AttributesToken, Token];
	abstract override get children(): [AttributesToken, Token];
	abstract override get firstChild(): AttributesToken;
	abstract override get firstElementChild(): AttributesToken;
	abstract override get lastChild(): Token;

	/** @override */
	override get closed(): boolean { // eslint-disable-line class-methods-use-this
		return true;
	}

	/**
	 * @browser
	 * @param name 标签名
	 * @param attr 标签属性
	 * @param inner 内部wikitext
	 * @param closed 是否封闭
	 */
	constructor(
		name: string,
		attr = '',
		inner = '',
		closed: string | undefined = undefined,
		config = Parser.getConfig(),
		accum: Token[] = [],
	) {
		const lcName = name.toLowerCase(),
			// @ts-expect-error abstract class
			attrToken: AttributesToken = new AttributesToken(
				!attr || attr.trimStart() !== attr ? attr : ` ${attr}`, 'ext-attrs', lcName, config, accum,
			),
			newConfig: Parser.Config = {...config, ext: del(config.ext, lcName), excludes: [...config.excludes ?? []]};
		let innerToken: Token;
		switch (lcName) {
			case 'tab':
				newConfig.ext = del(newConfig.ext, 'tabs');
				// fall through
			case 'indicator':
			case 'poem':
			case 'ref':
			case 'option':
			case 'combooption':
			case 'tabs':
			case 'poll':
			case 'seo':
				if (lcName === 'poem') {
					newConfig.excludes!.push('heading');
				}
				innerToken = new Token(inner, newConfig, true, accum);
				break;
			// 更多定制扩展的代码示例：
			// ```
			// case 'extensionName': {
			//	const ExtensionToken: typeof import('../extension') = require('../extension');
			//	innerToken = new ExtensionToken(inner, newConfig, accum);
			//	break;
			// }
			// ```
			default: {
				const NowikiToken: typeof import('../nowiki') = require('../nowiki');
				// @ts-expect-error abstract class
				innerToken = new NowikiToken(inner, config);
			}
		}
		innerToken.setAttribute('name', lcName).type = 'ext-inner';
		super(name, attrToken, innerToken, closed, config, accum);
	}

	/**
	 * @override
	 * @browser
	 * @param start 起始位置
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const errors = super.lint(start);
		if (this.name !== 'nowiki' && this.closest('html-attrs, table-attrs')) {
			const root = this.getRootNode(),
				excerpt = String(root).slice(Math.max(0, start - 25), start + 25),
				rect = {start, ...root.posFromIndex(start)};
			errors.push({...generateForSelf(this, rect, 'extension tag in HTML tag attributes'), excerpt});
		}
		return errors;
	}

	/** @override */
	override cloneNode(): this {
		const inner = this.lastChild.cloneNode(),
			tags = this.getAttribute('tags'),
			config = this.getAttribute('config'),
			attr = String(this.firstChild);
		return Parser.run(() => {
			// @ts-expect-error abstract class
			const token: this = new ExtToken(tags[0], attr, '', this.selfClosing ? undefined : tags[1], config);
			token.lastChild.safeReplaceWith(inner);
			return token;
		});
	}
}

Parser.classes['ExtToken'] = __filename;
export = ExtToken;