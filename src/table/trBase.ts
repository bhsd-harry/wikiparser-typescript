import lint_1 = require('../../util/lint');
const {generateForChild} = lint_1;
import * as Parser from '../../index';
import Token = require('..');
import TableBaseToken = require('./base');
import TdToken = require('./td');
import SyntaxToken = require('../syntax');
import ArgToken = require('../arg');
import TranscludeToken = require('../transclude');
import type {AstNodeTypes} from '../../lib/node';

declare interface TableCoords {
	row: number;
	column: number;
	x?: undefined;
	y?: undefined;
	start?: boolean;
}
declare interface TableRenderedCoords {
	row?: undefined;
	column?: undefined;
	x: number;
	y: number;
}

/** 表格行或表格 */
abstract class TrBaseToken extends TableBaseToken {
	declare type: 'table' | 'tr';

	/**
	 * @override
	 * @browser
	 */
	override lint(start = this.getAbsoluteIndex()): Parser.LintError[] {
		const errors = super.lint(start),
			inter = this.childNodes.find(({type}) => type === 'table-inter');
		if (!inter) {
			return errors;
		}
		const first = (inter.childNodes as AstNodeTypes[]).find(child => child.text().trim()),
			tdPattern = /^\s*(?:!|\{\{\s*![!-]?\s*\}\})/u;
		if (!first || tdPattern.test(String(first))
			|| first.type === 'arg' && tdPattern.test((first as ArgToken).default || '')
		) {
			return errors;
		} else if (first.type === 'magic-word') {
			try {
				const possibleValues = (first as TranscludeToken).getPossibleValues();
				if (possibleValues.every(token => tdPattern.test(token.text()))) {
					return errors;
				}
			} catch {}
		}
		const error = generateForChild(inter, {start}, 'content to be moved out from the table');
		errors.push({
			...error,
			startIndex: error.startIndex + 1,
			startLine: error.startLine + 1,
			startCol: 0,
			excerpt: error.excerpt.slice(1),
		});
		return errors;
	}

	/**
	 * @override
	 * @browser
	 */
	override text(): string {
		this.#correct();
		const str = super.text();
		return this.type === 'tr' && !str.trim().includes('\n') ? '' : str;
	}

	/** 修复简单的表格语法错误 */
	#correct(): void {
		const {childNodes: [,, child]} = this;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (child?.constructor === Token) {
			const {firstChild} = child;
			if (firstChild?.type !== 'text') {
				child.prepend('\n');
			} else if (!firstChild.data.startsWith('\n')) {
				firstChild.insertData(0, '\n');
			}
		}
	}

	/** @override */
	override toString(selector?: string): string {
		this.#correct();
		return super.toString(selector);
	}

	/**
	 * @override
	 * @param i 移除位置
	 */
	override removeAt(i: number): AstNodeTypes {
		const child = this.childNodes.at(i);
		if (child instanceof TdToken && child.isIndependent()) {
			const {nextSibling} = child;
			if (nextSibling?.type === 'td') {
				nextSibling.independence();
			}
		}
		return super.removeAt(i);
	}

	/**
	 * @override
	 * @param token 待插入的子节点
	 * @param i 插入位置
	 */
	override insertAt<T extends Token>(token: T, i = this.length): T {
		if (!Parser.running && !(token instanceof TrBaseToken)) {
			this.typeError('insertAt', 'TrToken');
		}
		const child = this.childNodes.at(i);
		if (token instanceof TdToken && token.isIndependent() && child instanceof TdToken) {
			child.independence();
		}
		return super.insertAt(token, i) as T;
	}

	/** 获取行数 */
	getRowCount(): number {
		return Number(this.childNodes.some(
			child => child instanceof TdToken && child.isIndependent() && !child.firstChild.text().endsWith('+'),
		));
	}

	/** 获取列数 */
	getColCount(): number {
		let count = 0,
			last = 0;
		for (const child of this.childNodes) {
			if (child instanceof TdToken) {
				last = child.isIndependent() ? Number(child.subtype !== 'caption') : last;
				count += last;
			}
		}
		return count;
	}

	/**
	 * 获取第n列
	 * @param n 列号
	 * @param insert 是否用于判断插入新列的位置
	 * @throws `RangeError` 不存在对应单元格
	 */
	getNthCol(n: number, insert?: false): TdToken | undefined;
	/** @ignore */
	getNthCol(n: number, insert: true): TdToken | import('./tr') | SyntaxToken | undefined;
	/** @ignore */
	getNthCol(n: number, insert = false): TdToken | import('./tr') | SyntaxToken | undefined {
		if (!Number.isInteger(n)) {
			this.typeError('getNthCol', 'Number');
		}
		const nCols = this.getColCount();
		let m = n < 0 ? n + nCols : n;
		if (m < 0 || m > nCols || m === nCols && !insert) {
			throw new RangeError(`不存在第 ${m} 个单元格！`);
		}
		let last = 0;
		for (const child of this.childNodes.slice(2)) {
			if (child instanceof TdToken) {
				if (child.isIndependent()) {
					last = Number(child.subtype !== 'caption');
				}
				m -= last;
				if (m < 0) {
					return child;
				}
			} else if (child.type === 'tr' || child.type === 'table-syntax') {
				return child as import('./tr') | SyntaxToken;
			}
		}
		return undefined;
	}

	/**
	 * 插入新的单元格
	 * @param inner 单元格内部wikitext
	 * @param {TableCoords} coord 单元格坐标
	 * @param subtype 单元格类型
	 * @param attr 单元格属性
	 */
	insertTableCell(
		inner: string | Token,
		{column}: TableCoords,
		subtype: 'td' | 'th' | 'caption' = 'td',
		attr: TdToken.TdAttrs = {},
	): TdToken {
		const token = TdToken.create(inner, subtype, attr, this.getAttribute('include'), this.getAttribute('config'));
		return this.insertBefore(token, this.getNthCol(column, true));
	}
}

declare namespace TrBaseToken {
	export type {
		TableCoords,
		TableRenderedCoords,
	};
}

Parser.classes['TrBaseToken'] = __filename;
export = TrBaseToken;
