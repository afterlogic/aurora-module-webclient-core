'use strict';

var $ = require('jquery');

$('body').ready(function () {
	var
		oAvaliableModules = {
			'StandardLoginFormWebclient': require('modules/StandardLoginFormWebclient/js/manager.js'),
			'MailWebclient': require('modules/MailWebclient/js/manager.js'),
			'ContactsWebclient': require('modules/ContactsWebclient/js/manager.js'),
			'SessionTimeoutWeblient': require('modules/SessionTimeoutWeblient/js/manager.js')
		},
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
		App = require('%PathToCoreWebclientModule%/js/App.js')
	;
	
	App.setMobile();
	ModulesManager.init(oAvaliableModules);
	App.init();
});
