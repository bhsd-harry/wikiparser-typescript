import { Token } from "../src";
import AstText from "../lib/text";

export interface CollectionCallback<T, S> extends Function {
	call: (thisArg: AstText | Token, i: number, ele: S) => T;
}
