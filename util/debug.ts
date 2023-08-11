import { Parser } from "../index";
import { Token } from "../src";
import { AstEvent, AstEventData } from "../lib/node";

/**
 * 定制TypeError消息
 * @param Constructor 类
 * @param Constructor.name 类名
 * @param args 可接受的参数类型
 * @throws `TypeError`
 */
export function typeError(
	{ name }: Function,
	method: string,
	...args: string[]
) {
	throw new TypeError(
		`${name}.${method} 方法仅接受 ${args.join("、")} 作为输入参数！`
	);
}

/**
 * 不是被构造器或原型方法调用
 * @param name 方法名称
 */
export function externalUse(name: string) {
	if (Parser.running) {
		return false;
	}
	const regex = new RegExp(
		`^new \\w*Token$|^(?:Ast\\w*|\\w*Token)\\.(?!${name}$)`,
		"u"
	);
	try {
		throw new Error();
	} catch (e) {
		if (e instanceof Error) {
			const mt = e.stack?.match(/(?<=^\s+at )(?:new )?[\w.]+(?= \(\/)/gmu);
			return !mt?.slice(2).some((func) => regex.test(func));
		}
	}
	return false;
}

/**
 * 撤销最近一次Mutation
 * @param e 事件
 * @param data 事件数据
 * @throws `RangeError` 无法撤销的事件类型
 */
export function undo(e: AstEvent, data: AstEventData) {
	const { target, type } = e;
	switch (type) {
		case "remove": {
			const childNodes = [...target.childNodes];
			childNodes.splice(data.position!, 0, data.removed!);
			data.removed!.setAttribute("parentNode", target as Token);
			target.setAttribute("childNodes", childNodes);
			break;
		}
		case "insert": {
			const childNodes = [...target.childNodes];
			childNodes.splice(data.position!, 1);
			target.setAttribute("childNodes", childNodes);
			break;
		}
		case "replace": {
			const { parentNode } = target,
				childNodes = [...parentNode!.childNodes];
			childNodes.splice(data.position!, 1, data.oldToken!);
			data.oldToken!.setAttribute("parentNode", parentNode);
			parentNode!.setAttribute("childNodes", childNodes);
			break;
		}
		case "text":
			if (target.type === "text") {
				target.replaceData(data.oldText);
			}
			break;
		default:
			throw new RangeError(`无法撤销未知类型的事件：${type}`);
	}
}
