import Parser = require('../index');

/**
 * 解析后不可见的类
 * @param constructor 基类
 */
const hidden = <T extends abstract new (...args: any[]) => object>(constructor: T) => {
	/** 解析后不可见的类 */
	abstract class AnyHiddenToken extends constructor {
		static readonly hidden = true;

		/** @override */
		abstract override toString(selector?: string, separator?: string): string;

		/** 没有可见部分 */
		text() { // eslint-disable-line class-methods-use-this
			return '';
		}
	}
	return AnyHiddenToken;
};

Parser.mixins['hidden'] = __filename;
export = hidden;
