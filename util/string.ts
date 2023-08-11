import { AstText } from "../lib/text";
import { printOpt } from "../lib/element";
import { Token } from "../src";

export const extUrlCharFirst =
	'(?:\\[[\\da-f:.]+\\]|[^[\\]<>"\\0-\\x1F\\x7F\\p{Zs}\\uFFFD])',
	extUrlChar = '(?:[^[\\]<>"\\0-\\x1F\\x7F\\p{Zs}\\uFFFD]|\\0\\d+c\\x7F)*';

/**
 * remove half-parsed comment-like tokens
 * @param str 原字符串
 */
export function removeComment(str: string) {
	return str.replace(/\0\d+c\x7F/gu, "");
}

/**
 * 以HTML格式打印
 * @param childNodes 子节点
 * @param opt 选项
 */
export function print(childNodes: (AstText | Token)[], opt: printOpt = {}) {
	const { pre = "", post = "", sep = "" } = opt,
		entities = { "&": "amp", "<": "lt", ">": "gt" };
	return `${pre}${childNodes
		.map((child: { type: string; print: () => any }) =>
			child.type === "text"
				? String(child).replace(
					/[&<>]/gu,
					(p) => `&${entities[p as "&" | "<" | ">"]};`
				)
				: child.print()
		)
		.join(sep)}${post}`;
}

/**
 * escape special chars for RegExp constructor
 * @param str RegExp source
 */
export function escapeRegExp(str: string) {
	return str.replace(/[\\{}()|.?*+^$[\]]/gu, "\\$&");
}

/**
 * a more sophisticated string-explode function
 * @param start start syntax of a nested AST node
 * @param end end syntax of a nested AST node
 * @param separator syntax for explosion
 * @param str string to be exploded
 */
export function explode(
	start: string,
	end: string,
	separator: string,
	str?: string
) {
	if (!str) {
		return [];
	}
	const regex = new RegExp(
		`${[start, end, separator].map(escapeRegExp).join("|")}`,
		"gu"
	),
    /** @type {string[]} */ exploded = [];
	let mt = regex.exec(str),
		depth = 0,
		lastIndex = 0;
	while (mt) {
		const { 0: match, index } = mt;
		if (match !== separator) {
			depth += match === start ? 1 : -1;
		} else if (depth === 0) {
			exploded.push(str.slice(lastIndex, index));
			({ lastIndex } = regex);
		}
		mt = regex.exec(str);
	}
	exploded.push(str.slice(lastIndex));
	return exploded;
}

/**
 * extract effective wikitext
 * @param {(string|AstText|Token)[]} childNodes a Token's contents
 * @param separator delimiter between nodes
 */
export function text(childNodes: any[], separator = "") {
	return childNodes
		.map((child: { text: () => any }) =>
			typeof child === "string" ? child : child.text()
		)
		.join(separator);
}

/**
 * decode HTML entities
 * @param str 原字符串
 */
export function decodeHtml(str: string) {
	return str?.replace(
		/&#(\d+|x[\da-f]+);/giu,
		/** @param code */
		(_: any, code: string[]) =>
			String.fromCodePoint(
				Number(`${code[0]?.toLowerCase() === "x" ? "0" : ""}${code}`)
			)
	);
}

/**
 * optionally convert to lower cases
 * @param val 属性值
 * @param i 是否对大小写不敏感
 */
export function toCase(val: string, i: boolean) {
	return i ? val.toLowerCase() : val;
}

/**
 * escape newlines
 * @param str 原字符串
 */
export function noWrap(str: string) {
	return str.replaceAll("\n", "\\n");
}

/**
 * convert newline in text nodes to single whitespace
 * @param token 父节点
 */
export function normalizeSpace(token?: Token) {
	if (!token) {
		return;
	}
	for (const child of token.childNodes) {
		if (child.type === "text") {
			child.replaceData(child.data.replaceAll("\n", " "));
		}
	}
}
