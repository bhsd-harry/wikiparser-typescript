import Parser = require('../index');
import {Inserted, InsertionReturn} from '../lib/node';

/**
 * 不可增删子节点的类
 * @param constructor 基类
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixed = <S extends new (...args: any[]) => {length: number}>(constructor: S) => class extends constructor {
	static readonly fixed = true;

	/** @override */
	// @ts-expect-error declare method
	declare toString(selector?: string, separator?: string): string;

	/**
	 * @override
	 * @throws `Error`
	 */
	removeAt() {
		throw new Error(`${this.constructor.name} 不可删除元素！`);
	}

	/**
	 * @override
	 * @param token 待插入的子节点
	 * @param i 插入位置
	 * @throws `Error`
	 */
	insertAt<T extends Inserted>(token: T, i = this.length): InsertionReturn<T> {
		if (Parser.running) {
			// @ts-expect-error method not existing
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
			return super.insertAt(token, i);
		}
		throw new Error(`${this.constructor.name} 不可插入元素！`);
	}
};

Parser.mixins['fixed'] = __filename;
export = fixed;
