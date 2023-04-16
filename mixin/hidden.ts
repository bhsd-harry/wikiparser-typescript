import Parser = require('..');
import Constructor = require('../typings/constructor');

/**
 * 解析后不可见的类
 * @param constructor 基类
 */
const hidden = <T extends Constructor>(constructor: T) => class extends constructor {
	static readonly hidden = true;

	/** 没有可见部分 */
	text() { // eslint-disable-line class-methods-use-this
		return '';
	}
};

Parser.mixins['hidden'] = __filename;
export = hidden;
