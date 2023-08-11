/**
 * 是否是普通对象
 * @param obj 对象
 */
export function isPlainObject(obj: object) {
	return Boolean(obj) && Object.getPrototypeOf(obj).constructor === Object;
}

/**
 * 延时
 * @param time 秒数
 */
export function sleep(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time * 1000);
	});
}
