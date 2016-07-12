'use strict';

module.exports = function (oAppData, iUserRole, bPublic) {
	if (iUserRole === Enums.UserRole.SuperAdmin)
	{
		var
			_ = require('underscore'),

			TextUtils = require('modules/CoreClient/js/utils/Text.js'),

			Settings = require('modules/CoreClient/js/Settings.js'),
			oSettings = _.extend({}, oAppData[Settings.ServerModuleName] || {}, oAppData['CoreClient'] || {})
		;

		Settings.init(oSettings);

		return {
			start: function (ModulesManager) {
				ModulesManager.run('AdminPanelClient', 'registerAdminPanelTab', [
					function () { return require('modules/CoreClient/js/views/DbAdminSettingsView.js'); },
					Settings.HashModuleName + '-db',
					TextUtils.i18n('CORECLIENT/LABEL_DB_SETTINGS_TAB')
				]);
//				ModulesManager.run('AdminPanelClient', 'registerAdminPanelTab', [
//					function () { return require('modules/CoreClient/js/views/LicensingAdminSettingsView.js'); },
//					Settings.HashModuleName + '-licensing',
//					TextUtils.i18n('CORECLIENT/LABEL_LICENSING_SETTINGS_TAB')
//				]);
				ModulesManager.run('AdminPanelClient', 'registerAdminPanelTab', [
					function () { return require('modules/CoreClient/js/views/SecurityAdminSettingsView.js'); },
					Settings.HashModuleName + '-security',
					TextUtils.i18n('CORECLIENT/LABEL_SECURITY_SETTINGS_TAB')
				]);
//				ModulesManager.run('AdminPanelClient', 'registerAdminPanelTab', [
//					function () { return require('modules/CoreClient/js/views/LoggingAdminSettingsView.js'); },
//					Settings.HashModuleName + '-logging',
//					TextUtils.i18n('CORECLIENT/LABEL_LOGGING_SETTINGS_TAB')
//				]);
			}
		};
	}
	
	return null;
};
