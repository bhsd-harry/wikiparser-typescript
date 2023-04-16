interface SelectorArray extends Array<
	string
	|[string, string]
	|[string, string|undefined, string|undefined, string|undefined]
> {
	relation?: string;
}

export = SelectorArray;
