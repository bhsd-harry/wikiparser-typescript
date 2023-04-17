import hidden = require('../../mixin/hidden');
import Parser = require('../..');
import AtomToken = require('.');

/** 不可见的节点 */
class HiddenToken extends hidden(AtomToken) {
	override readonly type = 'hidden';
}

Parser.classes['HiddenToken'] = __filename;
export = HiddenToken;
