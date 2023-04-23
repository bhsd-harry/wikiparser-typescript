import {generateForChild} from '../../util/lint';
import Parser = require('../..');
import Token = require('..');
import AttributeToken = require('.');
import AtomToken = require('../atom');

const typeAttrs = new Set(['type']),
	empty: Set<string> = new Set(),
	extAttrs: Record<string, Set<string>> = {
		nowiki: empty,
		indicator: new Set(['name']),
		langconvert: new Set(['from', 'to']),
		ref: new Set(['group', 'name', 'extends', 'follow', 'dir']),
		references: new Set(['group', 'responsive']),
		charinsert: new Set(['label']),
		choose: new Set(['uncached', 'before', 'after']),
		option: new Set(['weight']),
		imagemap: empty,
		inputbox: empty,
		templatestyles: new Set(['src', 'wrapper']),
		dynamicpagelist: empty,
		poll: new Set(['id', 'show-results-before-voting']),
		sm2: typeAttrs,
		flashmp3: typeAttrs,
		score: new Set([
			'line_width_inches',
			'lang',
			'override_midi',
			'raw',
			'note-language',
			'override_audio',
			'override_ogg',
			'sound',
			'vorbis',
		]),
		seo: new Set([
			'title',
			'title_mode',
			'title_separator',
			'keywords',
			'description',
			'robots',
			'google_bot',
			'image',
			'image_width',
			'image_height',
			'image_alt',
			'type',
			'site_name',
			'locale',
			'section',
			'author',
			'published_time',
			'twitter_site',
		]),
		tab: new Set([
			'nested',
			'name',
			'index',
			'class',
			'block',
			'inline',
			'openname',
			'closename',
			'collapsed',
			'dropdown',
			'style',
			'bgcolor',
			'container',
			'id',
			'title',
		]),
		tabs: new Set(['plain', 'class', 'container', 'id', 'title', 'style']),
		combobox: new Set(['placeholder', 'value', 'id', 'class', 'text', 'dropdown', 'style']),
	};

/**
 * 扩展和HTML标签属性
 * @classdesc `{childNodes: [AtomToken, Token]}`
 */
class ExtAttributeToken extends AttributeToken {
	override readonly type = 'ext-attr';
	// @ts-expect-error declare accessor
	declare parentNode: import('../attributes');
	// @ts-expect-error declare accessor
	declare parentElement: import('../attributes');
	// @ts-expect-error declare accessor
	declare nextSibling: AtomToken | ExtAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare nextElementSibling: AtomToken | ExtAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare previousSibling: AtomToken | ExtAttributeToken | undefined;
	// @ts-expect-error declare accessor
	declare previousElementSibling: AtomToken | ExtAttributeToken | undefined;

	/** @override */
	// @ts-expect-error declare constructor
	declare constructor(
		type: 'ext-attr',
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
		if (extAttrs[tagName] && !extAttrs[tagName]!.has(name)
			|| tagName in htmlAttrs && !htmlAttrs[tagName]!.has(name)
			&& !/^(?:xmlns:[\w:.-]+|data-[^:]*)$/u.test(name) && !commonHtmlAttrs.has(name)
		) {
			errors.push(generateForChild(firstChild, {start}, 'illegal attribute name'));
		}
		return errors;
	}
}

Parser.classes['ExtAttributeToken'] = __filename;
export = ExtAttributeToken;
