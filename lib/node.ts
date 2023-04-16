import {typeError} from '../util/debug';
import assert = require('assert/strict');
import EventEmitter = require('events');
import Parser = require('..');
import {TokenAttributeGetter, TokenAttributeSetter} from '../typings/tokenAttribute';
import {AstListener, AstEventData} from '../typings/event';
import {Inserted} from '../typings/insert';
import AstNodeTypes = require('../typings/node');

/** 类似Node */
class AstNode {
	type: string;
	readonly childNodes: AstNodeTypes[] = [];
	#parentNode: import('../src')|undefined;
	#optional: Set<string> = new Set();
	#events = new EventEmitter();

	/**
	 * 检查在某个位置增删子节点是否合法
	 * @param i 增删位置
	 * @param addition 将会插入的子节点个数
	 * @throws `RangeError` 指定位置不存在子节点
	 */
	verifyChild(i: number, addition = 0) {
		if (!Number.isInteger(i)) {
			this.typeError('verifyChild', 'Number');
		}
		const {childNodes: {length}} = this;
		if (i < -length || i >= length + addition) {
			throw new RangeError(`不存在第 ${i} 个子节点！`);
		}
	}

	/** 首位子节点 */
	get firstChild() {
		return this.childNodes[0];
	}

	/** 末位子节点 */
	get lastChild() {
		return this.childNodes.at(-1);
	}

	/** 父节点 */
	get parentNode() {
		return this.#parentNode;
	}

	/** 后一个兄弟节点 */
	get nextSibling() {
		const childNodes = this.#parentNode?.childNodes;
		return childNodes && childNodes[childNodes.indexOf(this as unknown as AstNodeTypes) + 1];
	}

	/** 前一个兄弟节点 */
	get previousSibling() {
		const childNodes = this.#parentNode?.childNodes;
		return childNodes && childNodes[childNodes.indexOf(this as unknown as AstNodeTypes) - 1];
	}

	/** 后一个非文本兄弟节点 */
	get nextElementSibling() {
		const childNodes = this.#parentNode?.childNodes,
			i = childNodes?.indexOf(this as unknown as AstNodeTypes);
		return childNodes?.slice((i as number) + 1)?.find(({type}) => type !== 'text') as import('../src')|undefined;
	}

	/** 前一个非文本兄弟节点 */
	get previousElementSibling() {
		const childNodes = this.#parentNode?.childNodes,
			i = childNodes?.indexOf(this as unknown as AstNodeTypes);
		return childNodes?.slice(0, i)?.findLast(({type}) => type !== 'text') as import('../src')|undefined;
	}

	/** 是否具有根节点 */
	get isConnected() {
		return this.getRootNode().type === 'root';
	}

	/** 不是自身的根节点 */
	get ownerDocument(): import('../src')|undefined {
		const root = this.getRootNode();
		return root.type === 'root' && root !== this ? root as import('../src') : undefined;
	}

	/** 后方是否还有其他节点（不含后代） */
	get eof(): boolean {
		if (this.type === 'root') {
			return true;
		}
		let {nextSibling} = this;
		while (nextSibling?.type === 'text' && String(nextSibling).trim() === '') {
			({nextSibling} = nextSibling);
		}
		return nextSibling === undefined && Boolean(this.parentNode?.eof);
	}

	constructor() {
		Object.defineProperty(this, 'childNodes', {writable: false});
		Object.freeze(this.childNodes);
	}

	/**
	 * 抛出`TypeError`
	 * @param method
	 * @param types 可接受的参数类型
	 */
	typeError(method: string, ...types: string[]) {
		return typeError(this.constructor, method, ...types);
	}

	/**
	 * 冻结部分属性
	 * @param props 属性键
	 * @param permanent 是否永久
	 */
	seal(props: string|string[], permanent = false) {
		const keys = Array.isArray(props) ? props : [props];
		if (!permanent) {
			for (const key of keys) {
				this.#optional.add(key);
			}
		}
		for (const key of keys) {
			Object.defineProperty(this, key, {
				// @ts-expect-error noImplicitAny
				writable: false, enumerable: !permanent && Boolean(this[key]), configurable: !permanent,
			});
		}
	}

	/**
	 * 是否是全同节点
	 * @param node 待比较的节点
	 * @throws `assert.AssertionError`
	 */
	isEqualNode(node: AstNode) {
		try {
			assert.deepStrictEqual(this, node);
		} catch (e) {
			if (e instanceof assert.AssertionError) {
				return false;
			}
			throw e;
		}
		return true;
	}

	/**
	 * 是否具有某属性
	 * @param key 属性键
	 */
	hasAttribute(key: string) {
		return typeof key === 'string' ? key in this : this.typeError('hasAttribute', 'String');
	}

	/**
	 * 获取属性值。除非用于私有属性，否则总是返回字符串。
	 * @param key 属性键
	 */
	getAttribute<T extends string>(key: T) {
		if (key === 'optional') {
			return new Set(this.#optional) as TokenAttributeGetter<T>;
		}
		return this.hasAttribute(key)
			// @ts-expect-error noImplicitAny
			? String(this[key as string]) as TokenAttributeGetter<T>
			: undefined as TokenAttributeGetter<T>;
	}

	/**
	 * 设置属性
	 * @param key 属性键
	 * @param value 属性值
	 */
	setAttribute<T extends string>(key: T, value: TokenAttributeSetter<T>) {
		if (key === 'parentNode') {
			this.#parentNode = value as TokenAttributeSetter<'parentNode'>;
		} else if (Object.hasOwn(this, key)) {
			const descriptor = Object.getOwnPropertyDescriptor(this, key) as PropertyDescriptor;
			if (this.#optional.has(key)) {
				descriptor.enumerable = Boolean(value);
			}
			// @ts-expect-error noImplicitAny
			const oldValue = this[key as string],
				frozen = oldValue !== null && typeof oldValue === 'object' && Object.isFrozen(oldValue);
			Object.defineProperty(this, key, {...descriptor, value});
			if (frozen && value !== null && typeof value === 'object') {
				Object.freeze(value);
			}
		} else {
			// @ts-expect-error noImplicitAny
			this[key as string] = value;
		}
		return this;
	}

	/**
	 * 在当前节点前后插入兄弟节点
	 * @param nodes 插入节点
	 * @param offset 插入的相对位置
	 * @throws `Error` 不存在父节点
	 */
	#insertAdjacent(nodes: Inserted[], offset: number) {
		const {parentNode} = this;
		if (!parentNode) {
			throw new Error('不存在父节点！');
		}
		const i = parentNode.childNodes.indexOf(this as unknown as AstNodeTypes) + offset;
		for (let j = 0; j < nodes.length; j++) {
			parentNode.insertAt(nodes[j] as Inserted, i + j);
		}
	}

	/**
	 * 在后方批量插入兄弟节点
	 * @param nodes 插入节点
	 */
	after(...nodes: Inserted[]) {
		this.#insertAdjacent(nodes, 1);
	}

	/**
	 * 在前方批量插入兄弟节点
	 * @param nodes 插入节点
	 */
	before(...nodes: Inserted[]) {
		this.#insertAdjacent(nodes, 0);
	}

	/**
	 * 移除当前节点
	 * @throws `Error` 不存在父节点
	 */
	remove() {
		const {parentNode} = this;
		if (!parentNode) {
			throw new Error('不存在父节点！');
		}
		parentNode.removeChild(this as unknown as AstNodeTypes);
	}

	/**
	 * 将当前节点批量替换为新的节点
	 * @param nodes 插入节点
	 */
	replaceWith(...nodes: Inserted[]) {
		this.after(...nodes);
		this.remove();
	}

	/**
	 * 是自身或后代节点
	 * @param node 待检测节点
	 */
	contains(node: AstNode): boolean {
		return node instanceof AstNode
			? node === this || this.childNodes.some(child => child.contains(node))
			: this.typeError('contains', 'AstNode');
	}

	/**
	 * 添加事件监听
	 * @param types 事件类型
	 * @param listener 监听函数
	 * @param options 选项
	 * @param options.once 仅执行一次
	 */
	addEventListener(types: string|string[], listener: AstListener, options: {once?: boolean}|undefined = undefined) {
		if (Array.isArray(types)) {
			for (const type of types) {
				this.addEventListener(type, listener, options);
			}
		} else if (typeof types === 'string' && typeof listener === 'function') {
			this.#events[options?.once ? 'once' : 'on'](types, listener);
		} else {
			this.typeError('addEventListener', 'String', 'Function');
		}
	}

	/**
	 * 移除事件监听
	 * @param types 事件类型
	 * @param listener 监听函数
	 */
	removeEventListener(types: string|string[], listener: AstListener) {
		if (Array.isArray(types)) {
			for (const type of types) {
				this.removeEventListener(type, listener);
			}
		} else if (typeof types === 'string' && typeof listener === 'function') {
			this.#events.off(types, listener);
		} else {
			this.typeError('removeEventListener', 'String', 'Function');
		}
	}

	/**
	 * 移除事件的所有监听
	 * @param types 事件类型
	 */
	removeAllEventListeners(types: string|string[]) {
		if (Array.isArray(types)) {
			for (const type of types) {
				this.removeAllEventListeners(type);
			}
		} else if (types === undefined || typeof types === 'string') {
			this.#events.removeAllListeners(types);
		} else {
			this.typeError('removeAllEventListeners', 'String');
		}
	}

	/**
	 * 列举事件监听
	 * @param type 事件类型
	 */
	listEventListeners(type: string) {
		return typeof type === 'string' ? this.#events.listeners(type) : this.typeError('listEventListeners', 'String');
	}

	/**
	 * 触发事件
	 * @param e 事件对象
	 * @param data 事件数据
	 */
	dispatchEvent(e: Event, data: AstEventData) {
		if (!(e instanceof Event)) {
			this.typeError('dispatchEvent', 'Event');
		} else if (!e.target) { // 初始化
			Object.defineProperty(e, 'target', {value: this, enumerable: true});

			/** 终止冒泡 */
			e.stopPropagation = function() {
				Object.defineProperty(this, 'bubbles', {value: false});
			};
		}
		Object.defineProperties(e, { // 每次bubble更新
			prevTarget: {value: e.currentTarget, enumerable: true, configurable: true},
			currentTarget: {value: this, enumerable: true, configurable: true},
		});
		this.#events.emit(e.type, e, data);
		if (e.bubbles && this.parentNode) {
			this.parentNode.dispatchEvent(e, data);
		}
	}

	/** 获取所有祖先节点 */
	getAncestors() {
		const ancestors: import('../src')[] = [];
		let {parentNode} = this;
		while (parentNode) {
			ancestors.push(parentNode);
			({parentNode} = parentNode);
		}
		return ancestors;
	}

	/**
	 * 比较和另一个节点的相对位置
	 * @param other 待比较的节点
	 * @throws `Error` 不在同一个语法树
	 */
	compareDocumentPosition(this: AstNodeTypes, other: AstNodeTypes) {
		if (!(other instanceof AstNode)) {
			this.typeError('compareDocumentPosition', 'AstNode');
		} else if (this === other) {
			return 0;
		} else if (this.contains(other)) {
			return -1;
		} else if (other.contains(this)) {
			return 1;
		} else if (this.getRootNode() !== other.getRootNode()) {
			throw new Error('不在同一个语法树！');
		}
		const aAncestors = [...this.getAncestors().reverse(), this as AstNodeTypes],
			bAncestors = [...other.getAncestors().reverse(), other],
			depth = aAncestors.findIndex((ancestor, i) => bAncestors[i] !== ancestor),
			commonAncestor = aAncestors[depth - 1] as AstNodeTypes,
			{childNodes} = commonAncestor;
		return childNodes.indexOf(aAncestors[depth] as AstNodeTypes)
			- childNodes.indexOf(bAncestors[depth] as AstNodeTypes);
	}

	/** 合并相邻的文本子节点 */
	normalize() {
		const childNodes = [...this.childNodes];
		for (let i = childNodes.length - 1; i >= 0; i--) {
			const cur = childNodes[i] as AstNodeTypes,
				prev = childNodes[i - 1];
			if (cur.type !== 'text' || this.getGaps(i - 1)) {
				//
			} else if (cur.data === '') {
				childNodes.splice(i, 1);
			} else if (prev?.type === 'text') {
				prev.setAttribute('data', prev.data + cur.data);
				childNodes.splice(i, 1);
			}
		}
		this.setAttribute('childNodes', childNodes);
	}

	/** 获取根节点 */
	getRootNode(): import('../src')|this {
		let {parentNode} = this;
		while (parentNode?.parentNode) {
			({parentNode} = parentNode);
		}
		return parentNode ?? this;
	}

	/**
	 * 将字符位置转换为行列号
	 * @param index 字符位置
	 */
	posFromIndex(index: number) {
		if (!Number.isInteger(index)) {
			this.typeError('posFromIndex', 'Number');
		}
		const str = String(this);
		if (index >= -str.length && index <= str.length) {
			const lines = str.slice(0, index).split('\n');
			return {top: lines.length - 1, left: (lines.at(-1) as string).length};
		}
		return undefined;
	}

	/**
	 * 将行列号转换为字符位置
	 * @param top 行号
	 * @param left 列号
	 */
	indexFromPos(top: number, left: number) {
		if (!Number.isInteger(top) || !Number.isInteger(left)) {
			this.typeError('indexFromPos', 'Number');
		}
		const lines = String(this).split('\n');
		return top >= 0 && left >= 0 && lines.length >= top + 1 && (lines[top] as string).length >= left
			? lines.slice(0, top).reduce((acc, curLine) => acc + curLine.length + 1, 0) + left
			: undefined;
	}

	/** 获取行数和最后一行的列数 */
	#getDimension() {
		const lines = String(this).split('\n');
		return {height: lines.length, width: (lines.at(-1) as string).length};
	}

	/** 第一个子节点前的间距 */
	getPadding() {
		return 0;
	}

	/**
	 * 子节点间距
	 * @param i 子节点序号
	 */
	getGaps(i = 0) { // eslint-disable-line @typescript-eslint/no-unused-vars
		return 0;
	}

	/**
	 * 获取当前节点的相对字符位置，或其第`j`个子节点的相对字符位置
	 * @param j 子节点序号
	 */
	getRelativeIndex(j: number|undefined = undefined): number {
		let childNodes: AstNodeTypes[];

		/**
		 * 获取子节点相对于父节点的字符位置，使用前需要先给`childNodes`赋值
		 * @param end 子节点序号
		 * @param parent 父节点
		 */
		const getIndex = (end: number, parent: AstNode) => childNodes.slice(0, end).reduce(
			(acc, cur, i) => acc + String(cur).length + parent.getGaps(i),
			0,
		) + parent.getPadding();
		if (j === undefined) {
			const {parentNode} = this;
			if (parentNode) {
				({childNodes} = parentNode);
				return getIndex(childNodes.indexOf(this as unknown as AstNodeTypes), parentNode);
			}
			return 0;
		}
		this.verifyChild(j, 1);
		({childNodes} = this);
		return getIndex(j, this);
	}

	/** 获取当前节点的绝对位置 */
	getAbsoluteIndex(): number {
		const {parentNode} = this;
		return parentNode ? parentNode.getAbsoluteIndex() + this.getRelativeIndex() : 0;
	}

	/**
	 * 获取当前节点的相对位置，或其第`j`个子节点的相对位置
	 * @param j 子节点序号
	 */
	#getPosition(j: number|undefined = undefined) {
		return j === undefined
			? this.parentNode?.posFromIndex(this.getRelativeIndex()) ?? {top: 0, left: 0}
			: this.posFromIndex(this.getRelativeIndex(j));
	}

	/** 获取当前节点的行列位置和大小 */
	getBoundingClientRect() {
		return {...this.#getDimension(), ...this.getRootNode().posFromIndex(this.getAbsoluteIndex())};
	}

	/** 行数 */
	get offsetHeight() {
		return this.#getDimension().height;
	}

	/** 最后一行的列数 */
	get offsetWidth() {
		return this.#getDimension().width;
	}

	/** 相对于父容器的行号 */
	get offsetTop() {
		return this.#getPosition()?.top;
	}

	/** 相对于父容器的列号 */
	get offsetLeft() {
		return this.#getPosition()?.left;
	}

	/** 位置、大小和padding */
	get style() {
		return {...this.#getPosition(), ...this.#getDimension(), padding: this.getPadding()};
	}
}

Parser.classes['AstNode'] = __filename;
export = AstNode;