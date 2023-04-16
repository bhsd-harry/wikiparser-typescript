import Parser = require('..');
import SelectorArray = require('../typings/selector');

const simplePseudos: Set<string> = new Set([
	'root',
	'first-child',
	'first-of-type',
	'last-child',
	'last-of-type',
	'only-child',
	'only-of-type',
	'empty',
	'parent',
	'header',
	'hidden',
	'visible',
	'only-whitespace',
	'local-link',
	'read-only',
	'read-write',
	'invalid',
	'required',
	'optional',
]);
const complexPseudos: string[] = [
	'is',
	'not',
	'nth-child',
	'nth-of-type',
	'nth-last-child',
	'nth-last-of-type',
	'contains',
	'has',
	'lang',
];
const specialChars: [string, string][] = [
	['[', '&lbrack;'],
	[']', '&rbrack;'],
	['(', '&lpar;'],
	[')', '&rpar;'],
	['"', '&quot;'],
	[`'`, '&apos;'],
	[':', '&colon;'],
	['\\', '&bsol;'],
	['&', '&amp;'],
];
const pseudoRegex = new RegExp(`:(${complexPseudos.join('|')})$`, 'u'),
	regularRegex = /[[(,>+~]|\s+/u,
	attributeRegex = /^\s*(\w+)\s*(?:([~|^$*!]?=)\s*("[^"]*"|'[^']*'|[^\s[\]]+)(?:\s+(i))?\s*)?\]/u,
	functionRegex = /^(\s*"[^"]*"\s*|\s*'[^']*'\s*|[^()]*)\)/u,
	grouping = new Set([',', '>', '+', '~']),
	combinator = new Set(['>', '+', '~', '']);

/**
 * 清理转义符号
 * @param selector
 */
const sanitize = (selector: string) => {
	for (const [c, escaped] of specialChars) {
		selector = selector.replaceAll(`\\${c}`, escaped); // eslint-disable-line no-param-reassign
	}
	return selector;
};

/**
 * 还原转义符号
 * @param selector
 */
const desanitize = <T extends string|undefined>(selector: T) => {
	if (selector === undefined) {
		return undefined as T;
	}
	let str = selector as string;
	for (const [c, escaped] of specialChars) {
		str = str.replaceAll(escaped, c);
	}
	return str.trim() as T;
};

/**
 * 去除首尾的引号
 * @param val 属性值或伪选择器函数的参数
 */
const deQuote = <T extends string|undefined>(val: T) => {
	if (val === undefined) {
		return undefined as T;
	}
	const quotes = /^(["']).*\1$/u.exec(val)?.[1];
	return (quotes ? val.slice(1, -1) : val) as T;
};

/**
 * 解析简单伪选择器
 * @param step 当前顶部
 * @param str 不含属性和复杂伪选择器的语句
 * @throws `SyntaxError` 非法的选择器
 */
const pushSimple = (step: SelectorArray, str: string) => {
	const pieces = str.trim().split(':'),
		// eslint-disable-next-line unicorn/explicit-length-check
		i = pieces.slice(1).findIndex(pseudo => simplePseudos.has(pseudo)) + 1 || pieces.length;
	if (pieces.slice(i).some(pseudo => !simplePseudos.has(pseudo))) {
		throw new SyntaxError(`非法的选择器！\n${str}\n可能需要将':'转义为'\\:'。`);
	}
	step.push(desanitize(pieces.slice(0, i).join(':')), ...pieces.slice(i).map(piece => `:${piece}`));
};

/**
 * 解析选择器
 * @param selector
 * @throws `SyntaxError` 非法的选择器
 */
const parseSelector = (selector: string) => {
	selector = selector.trim(); // eslint-disable-line no-param-reassign
	const stack: SelectorArray[][] = [[[]]];
	let sanitized = sanitize(selector),
		regex = regularRegex,
		mt = regex.exec(sanitized),
		[condition] = stack as [SelectorArray[]],
		[step] = condition as [SelectorArray];
	while (mt) {
		let {0: syntax, index} = mt as unknown as {0: string, index: number};
		if (syntax.trim() === '') {
			index += syntax.length;
			const char = sanitized[index] as string;
			syntax = grouping.has(char) ? char : '';
		}
		if (syntax === ',') { // 情形1：并列
			pushSimple(step, sanitized.slice(0, index));
			condition = [[]];
			[step] = condition as [SelectorArray];
			stack.push(condition);
		} else if (combinator.has(syntax)) { // 情形2：关系
			pushSimple(step, sanitized.slice(0, index));
			if (!step.some(Boolean)) {
				throw new SyntaxError(`非法的选择器！\n${selector}\n可能需要通用选择器'*'。`);
			}
			step.relation = syntax;
			step = [];
			condition.push(step);
		} else if (syntax === '[') { // 情形3：属性开启
			pushSimple(step, sanitized.slice(0, index));
			regex = attributeRegex;
		} else if (syntax.endsWith(']')) { // 情形4：属性闭合
			mt[3] &&= desanitize(deQuote(mt[3]));
			step.push(mt.slice(1) as [string, string|undefined, string|undefined, string|undefined]);
			regex = regularRegex;
		} else if (syntax === '(') { // 情形5：伪选择器开启
			const pseudoExec = pseudoRegex.exec(sanitized.slice(0, index));
			if (!pseudoExec) {
				throw new SyntaxError(`非法的选择器！\n${desanitize(sanitized)}\n请检查伪选择器是否存在。`);
			}
			pushSimple(step, sanitized.slice(0, pseudoExec.index));
			step.push(pseudoExec[1] as string); // 临时存放复杂伪选择器
			regex = functionRegex;
		} else if (syntax === ')') { // 情形6：伪选择器闭合
			const pseudo = step.pop() as string;
			mt.push(pseudo);
			mt[1] &&= deQuote(mt[1]);
			step.push(mt.slice(1) as [string, string]);
			regex = regularRegex;
		}
		sanitized = sanitized.slice(index + syntax.length);
		if (grouping.has(syntax)) {
			sanitized = sanitized.trim();
		}
		mt = regex.exec(sanitized);
	}
	if (regex === regularRegex) {
		pushSimple(step, sanitized);
		return stack;
	}
	throw new SyntaxError(`非法的选择器！\n${selector}\n检测到未闭合的'${regex === attributeRegex ? '[' : '('}'`);
};

Parser.parsers['parseSelector'] = __filename;
export = parseSelector;