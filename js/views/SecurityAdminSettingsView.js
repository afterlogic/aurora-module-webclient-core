'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	TextUtils = require('modules/CoreClient/js/utils/Text.js'),
	
	ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
	Screens = require('modules/CoreClient/js/Screens.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsClient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/CoreClient/js/Settings.js')
;

/**
* @constructor
*/
function CSecurityAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	this.sFakePass = 'xxxxxxxxxx';
	
	/* Editable fields */
	this.login = ko.observable(Settings.AdminLogin);
	this.pass = ko.observable(this.sFakePass);
	this.newPass = ko.observable(this.sFakePass);
	this.confirmPass = ko.observable(this.sFakePass);
	/*-- Editable fields */
}

_.extendOwn(CSecurityAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CSecurityAdminSettingsView.prototype.ViewTemplate = 'CoreClient_SecurityAdminSettingsView';

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
	this.pass(this.sFakePass);
	this.newPass(this.sFakePass);
	this.confirmPass(this.sFakePass);
};

CSecurityAdminSettingsView.prototype.getParametersForSave = function ()
{
	if (this.pass() === this.sFakePass)
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
 * @param {Object} oParameters
 */
CSecurityAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
//	Settings.updateSecurity(oParameters.AdminLogin);
};

CSecurityAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

CSecurityAdminSettingsView.prototype.validateBeforeSave = function ()
{
	if (this.pass() !== this.sFakePass && this.newPass() !== this.confirmPass())
	{
		Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_PASSWORDS_DO_NOT_MATCH'));
		return false;
	}
	return true;
};

module.exports = new CSecurityAdminSettingsView();
