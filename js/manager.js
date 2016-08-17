'use strict';

module.exports = function (oAppData, iUserRole, bPublic) {
	var
		_ = require('underscore'),

		TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),

		Settings = require('%PathToCoreWebclientModule%/js/Settings.js'),
		oSettings = _.extend({}, oAppData[Settings.ServerModuleName] || {}, oAppData['CoreWebclient'] || {})
	;

	Settings.init(oSettings);
	
	require('%PathToCoreWebclientModule%/js/enums.js');

	if (iUserRole === Enums.UserRole.SuperAdmin)
	{
		return {
			start: function (ModulesManager) {
				ModulesManager.run('AdminPanelWebclient', 'registerAdminPanelTab', [
					function () { return require('%PathToCoreWebclientModule%/js/views/DbAdminSettingsView.js'); },
					Settings.HashModuleName + '-db',
					TextUtils.i18n('%MODULENAME%/LABEL_DB_SETTINGS_TAB')
				]);
//				ModulesManager.run('AdminPanelWebclient', 'registerAdminPanelTab', [
//					function () { return require('%PathToCoreWebclientModule%/js/views/LicensingAdminSettingsView.js'); },
//					Settings.HashModuleName + '-licensing',
//					TextUtils.i18n('%MODULENAME%/LABEL_LICENSING_SETTINGS_TAB')
//				]);
				ModulesManager.run('AdminPanelWebclient', 'registerAdminPanelTab', [
					function () { return require('%PathToCoreWebclientModule%/js/views/SecurityAdminSettingsView.js'); },
					Settings.HashModuleName + '-security',
					TextUtils.i18n('%MODULENAME%/LABEL_SECURITY_SETTINGS_TAB')
				]);
//				ModulesManager.run('AdminPanelWebclient', 'registerAdminPanelTab', [
//					function () { return require('%PathToCoreWebclientModule%/js/views/LoggingAdminSettingsView.js'); },
//					Settings.HashModuleName + '-logging',
//					TextUtils.i18n('%MODULENAME%/LABEL_LOGGING_SETTINGS_TAB')
//				]);
			}
		};
	}
	
	return null;
};
