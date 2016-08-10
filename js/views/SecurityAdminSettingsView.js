'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('%PathToCoreWebclientModule%/js/Settings.js')
;

/**
* @constructor
*/
function CSecurityAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	/* Editable fields */
	this.login = ko.observable(Settings.AdminLogin);
	this.pass = ko.observable('');
	this.newPass = ko.observable('');
	this.confirmPass = ko.observable('');
	/*-- Editable fields */
	
	this.passFocused = ko.observable(false);
	this.newPassFocused = ko.observable(false);
}

_.extendOwn(CSecurityAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CSecurityAdminSettingsView.prototype.ViewTemplate = 'CoreWebclient_SecurityAdminSettingsView';

/**
 * Returns error text to show on start if there is no admin password.
 * 
 * @returns {String}
 */
CSecurityAdminSettingsView.prototype.getStartError = function ()
{
	return !Settings.AdminHasPassword ? TextUtils.i18n('CORECLIENT/ERROR_ADMIN_EMPTY_PASSWORD') : '';
};

CSecurityAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.login(),
		this.pass(),
		this.newPass(),
		this.confirmPass()
	];
};

CSecurityAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.login(Settings.AdminLogin);
	this.pass('');
	this.newPass('');
	this.confirmPass('');
};

CSecurityAdminSettingsView.prototype.getParametersForSave = function ()
{
	if (Settings.AdminHasPassword && this.pass() === '')
	{
		return {
			'AdminLogin': this.login()
		};
	}
	
	return {
		'AdminLogin': this.login(),
		'Password': this.pass(),
		'NewPassword': this.newPass()
	};
};

/**
 * Applies saved values to the Settings object.
 * 
 * @param {Object} oParameters Parameters which were saved on the server side.
 */
CSecurityAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateSecurity(oParameters.AdminLogin);
};

CSecurityAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

CSecurityAdminSettingsView.prototype.validateBeforeSave = function ()
{
	if (Settings.AdminHasPassword && this.pass() === '' && this.newPass() !== '')
	{
		Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_CURRENT_PASSWORD_EMPTY'));
		this.passFocused(true);
		return false;
	}
	if (this.pass() !== '' && this.newPass() === '')
	{
		Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_NEW_PASSWORD_EMPTY'));
		this.newPassFocused(true);
		return false;
	}
	if (this.pass() !== '' && this.newPass() !== this.confirmPass())
	{
		Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_PASSWORDS_DO_NOT_MATCH'));
		this.newPassFocused(true);
		return false;
	}
	return true;
};

module.exports = new CSecurityAdminSettingsView();
