import Parser = require('..');

/**
 * 解析后不可见的类
 * @param constructor 基类
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hidden = <T extends new (...args: any[]) => object>(constructor: T) => class extends constructor {
	static readonly hidden = true;

	/** @override */
	// @ts-expect-error declare method
	declare toString(selector?: string | undefined, separator?: string): string;

	/** 没有可见部分 */
	text() { // eslint-disable-line class-methods-use-this
		return '';
	}
};

Parser.mixins['hidden'] = __filename;
export = hidden;
