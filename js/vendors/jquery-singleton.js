'use strict';

// Relative path — do not require('jquery'), that would recurse through the webpack alias.
var jqueryModule = require('../../node_modules/jquery/dist/jquery.js');
var $ = jqueryModule && typeof jqueryModule.default === 'function'
	? jqueryModule.default
	: jqueryModule;

if (typeof $ !== 'function') {
	throw new Error('jQuery singleton expected a function, got ' + typeof $);
}

// jquery-ui AMD/UMD else-branch uses the global; keep it on the same instance.
window.jQuery = $;
window.$ = $;

module.exports = $;
