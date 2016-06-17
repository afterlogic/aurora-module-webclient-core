'use strict';

var $ = require('jquery');

$('body').ready(function () {
	var
		oAvaliableModules = {
			'CoreClient': require('modules/CoreClient/js/manager.js'),
			'AdminPanelClient': require('modules/AdminPanelClient/js/manager.js'),
			'BasicAuthClient': require('modules/BasicAuthClient/js/manager.js'),
			'MailClient': require('modules/MailClient/js/manager.js'),
			'ContactsClient': require('modules/ContactsClient/js/manager.js'),
			'CalendarClient': require('modules/CalendarClient/js/manager.js'),
			'FilesClient': require('modules/FilesClient/js/manager.js'),
			'HelpDeskClient': require('modules/HelpDeskClient/js/manager.js'),
			'PhoneClient': require('modules/PhoneClient/js/manager.js'),
			'SettingsClient': require('modules/SettingsClient/js/manager.js'),
			'SimpleChatClient': require('modules/SimpleChatClient/js/manager.js'),
			'SimpleChatEmojiClientPlugin': require('modules/SimpleChatEmojiClientPlugin/js/manager.js'),
			
			'OpenPgpClient': require('modules/OpenPgpClient/js/manager.js'),
			'MailSensitivityClientPlugin': require('modules/MailSensitivityClientPlugin/js/manager.js'),
			'SessionTimeoutClient': require('modules/SessionTimeoutClient/js/manager.js'),
			'ChangePasswordClient': require('modules/ChangePasswordClient/js/manager.js'),
			'MobileSyncClient': require('modules/MobileSyncClient/js/manager.js'),
			'OutlookSyncClient': require('modules/OutlookSyncClient/js/manager.js')
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
