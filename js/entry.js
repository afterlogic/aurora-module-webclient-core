'use strict';

var $ = require('jquery');

$('body').ready(function () {
	var
		oAvaliableModules = {
			'CoreClient': require('modules/CoreClient/js/manager.js'),
			'AdminPanelWebclient': require('modules/AdminPanelWebclient/js/manager.js'),
			'StandardLoginFormWebclient': require('modules/StandardLoginFormWebclient/js/manager.js'),
			'StandardAuthWebclient': require('modules/StandardAuthWebclient/js/manager.js'),
			'MailWebclient': require('modules/MailWebclient/js/manager.js'),
			'ContactsWebclient': require('modules/ContactsWebclient/js/manager.js'),
			'CalendarWebclient': require('modules/CalendarWebclient/js/manager.js'),
			'FilesWebclient': require('modules/FilesWebclient/js/manager.js'),
			'HelpDeskWebclient': require('modules/HelpDeskWebclient/js/manager.js'),
			'PhoneWebclient': require('modules/PhoneWebclient/js/manager.js'),
			'SettingsWebclient': require('modules/SettingsWebclient/js/manager.js'),
			'SimpleChatWebclient': require('modules/SimpleChatWebclient/js/manager.js'),
			'SimpleChatEmojiWebclientPlugin': require('modules/SimpleChatEmojiWebclientPlugin/js/manager.js'),
			
			'OpenPgpWebclient': require('modules/OpenPgpWebclient/js/manager.js'),
			'MailSensitivityWebclientPlugin': require('modules/MailSensitivityWebclientPlugin/js/manager.js'),
			'SessionTimeoutWeblient': require('modules/SessionTimeoutWeblient/js/manager.js'),
			'ChangePasswordWebclient': require('modules/ChangePasswordWebclient/js/manager.js'),
			'MobileSyncWebclient': require('modules/MobileSyncWebclient/js/manager.js'),
			'OutlookSyncWebclient': require('modules/OutlookSyncWebclient/js/manager.js'),
			'ExternalServices':  require('modules/ExternalServices/js/manager.js'),
			'FacebookAuth':  require('modules/FacebookAuth/js/manager.js'),
			'GoogleAuth':  require('modules/GoogleAuth/js/manager.js'),
			'DropBoxAuth':  require('modules/DropBoxAuth/js/manager.js')
		},
		ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
		App = require('modules/CoreClient/js/App.js'),
		bSwitchingToMobile = App.checkMobile()
	;
	
	if (!bSwitchingToMobile)
	{
		ModulesManager.init(oAvaliableModules, App.getUserRole(), App.isPublic());
		App.init();
	}
});
