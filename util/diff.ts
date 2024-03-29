import child_process = require('child_process');
const {spawn} = child_process;
import type {ChildProcessWithoutNullStreams} from 'child_process';
import * as fs from 'fs/promises';

process.on('unhandledRejection', e => {
	console.error(e);
});

/**
 * 将shell命令转化为Promise对象
 * @param command shell指令
 * @param args shell输入参数
 */
const cmd = (command: string, args: string[]): Promise<string | undefined> => new Promise(resolve => {
	let timer: NodeJS.Timeout | undefined,
		shell: ChildProcessWithoutNullStreams | undefined;

	/**
	 * 清除进程并返回
	 * @param val 返回值
	 */
	const r = (val?: string): void => {
		clearTimeout(timer);
		shell?.kill('SIGINT');
		resolve(val);
	};
	try {
		shell = spawn(command, args);
		timer = setTimeout(() => {
			shell!.kill('SIGINT');
		}, 60 * 1000);
		let buf = '';
		shell.stdout.on('data', data => {
			buf += String(data);
		});
		shell.stdout.on('end', () => {
			r(buf);
		});
		shell.on('exit', () => {
			r(shell!.killed ? undefined : '');
		});
		shell.on('error', () => {
			r(undefined);
		});
	} catch {
		r(undefined);
	}
});

/**
 * 比较两个文件
 * @param oldStr 旧文本
 * @param newStr 新文本
 * @param uid 唯一标识
 */
const diff = async (oldStr: string, newStr: string, uid = -1): Promise<void> => {
	if (oldStr === newStr) {
		return;
	}
	const oldFile = `diffOld${uid}`,
		newFile = `diffNew${uid}`;
	await Promise.all([fs.writeFile(oldFile, oldStr), fs.writeFile(newFile, newStr)]);
	const stdout = await cmd('git', [
		'diff',
		'--color-words=[\xC0-\xFF][\x80-\xBF]+|<?/?\\w+/?>?|[^[:space:]]',
		'-U0',
		'--no-index',
		oldFile,
		newFile,
	]);
	await Promise.all([fs.unlink(oldFile), fs.unlink(newFile)]);
	console.log(stdout?.split('\n')?.slice(4)?.join('\n'));
};

export = diff;
