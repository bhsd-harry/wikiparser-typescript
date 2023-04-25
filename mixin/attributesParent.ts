import Parser = require('../index');
import AttributesToken = require('../src/attributes');
import {AstNodeTypes} from '../lib/node';

/**
 * 子节点含有AttributesToken的类
 * @param constructor 基类
 * @param i AttributesToken子节点的位置
 */
const attributesParent = <T extends abstract new (...args: any[]) => object>(constructor: T, i = 0) => {
	/** 子节点含有AttributesToken的类 */
	abstract class AttributesParent extends constructor {
		declare childNodes: AstNodeTypes[];

		/** @override */
		abstract override toString(selector?: string, separator?: string): string;

		/** AttributesToken子节点 */
		get #attributesChild() {
			return this.childNodes.at(i) as AttributesToken;
		}

		/** getAttrs()方法的getter写法 */
		get attributes() {
			return this.#attributesChild.attributes;
		}

		/** 以字符串表示的class属性 */
		get className() {
			return this.#attributesChild.className;
		}

		set className(className) {
			this.#attributesChild.className = className;
		}

		/** 以Set表示的class属性 */
		get classList() {
			return this.#attributesChild.classList;
		}

		/** id属性 */
		get id() {
			return this.#attributesChild.id;
		}

		set id(id) {
			this.#attributesChild.id = id;
		}

		/**
		 * AttributesToken子节点是否具有某属性
		 * @param key 属性键
		 */
		hasAttr(key: string) {
			return this.#attributesChild.hasAttr(key);
		}

		/**
		 * 获取AttributesToken子节点的属性
		 * @param key 属性键
		 */
		getAttr(key: string) {
			return this.#attributesChild.getAttr(key);
		}

		/** 列举AttributesToken子节点的属性键 */
		getAttrNames() {
			return this.#attributesChild.getAttrNames();
		}

		/** AttributesToken子节点是否具有任意属性 */
		hasAttrs() {
			return this.#attributesChild.hasAttrs();
		}

		/** 获取AttributesToken子节点的全部标签属性 */
		getAttrs() {
			return this.#attributesChild.getAttrs();
		}

		/**
		 * 对AttributesToken子节点设置属性
		 * @param key 属性键
		 * @param value 属性值
		 */
		setAttr(key: string, value: string | boolean) {
			this.#attributesChild.setAttr(key, value);
		}

		/**
		 * 移除AttributesToken子节点的某属性
		 * @param key 属性键
		 */
		removeAttr(key: string) {
			this.#attributesChild.removeAttr(key);
		}

		/**
		 * 开关AttributesToken子节点的某属性
		 * @param key 属性键
		 * @param force 强制开启或关闭
		 */
		toggleAttr(key: string, force?: boolean) {
			this.#attributesChild.toggleAttr(key, force);
		}
	}
	return AttributesParent;
};

Parser.mixins['attributesParent'] = __filename;
export = attributesParent;
