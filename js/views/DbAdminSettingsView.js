'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	TextUtils = require('modules/CoreClient/js/utils/Text.js'),
	
	ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
	Screens = require('modules/CoreClient/js/Screens.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsClient', 'getAbstractSettingsFormViewClass'),
	
	Ajax = require('modules/CoreClient/js/Ajax.js'),
	Settings = require('modules/CoreClient/js/Settings.js')
;

/**
* @constructor
*/
function CDbAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	this.sFakePass = 'xxxxxxxxxx';
	
	/* Editable fields */
	this.dbLogin = ko.observable(Settings.DbLogin);
	this.dbPassword = ko.observable(this.sFakePass);
	this.dbName = ko.observable(Settings.DbName);
	this.dbHost = ko.observable(Settings.DbHost);
	/*-- Editable fields */
}

_.extendOwn(CDbAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CDbAdminSettingsView.prototype.ViewTemplate = 'CoreClient_DbAdminSettingsView';

/**
 * Returns error text to show on start if the tab has empty fields.
 * 
 * @returns {String}
 */
CDbAdminSettingsView.prototype.getStartError = function ()
{
	return (Settings.DbLogin === '' || Settings.DbName === '' || Settings.DbHost === '') ? TextUtils.i18n('CORECLIENT/ERROR_DB_ACCESS') : '';
};

CDbAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.dbLogin(),
		this.dbPassword(),
		this.dbName(),
		this.dbHost()
	];
};

CDbAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.dbLogin(Settings.DbLogin);
	this.dbPassword(this.sFakePass);
	this.dbName(Settings.DbName);
	this.dbHost(Settings.DbHost);
};

CDbAdminSettingsView.prototype.getParametersForSave = function ()
{
	if (this.dbPassword() === this.sFakePass)
	{
		return {
			'DbLogin': this.dbLogin(),
			'DbName': this.dbName(),
			'DbHost': this.dbHost()
		};
	}
	return {
		'DbLogin': this.dbLogin(),
		'DbPassword': this.dbPassword(),
		'DbName': this.dbName(),
		'DbHost': this.dbHost()
	};
};

/**
 * @param {Object} oParameters
 */
CDbAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateDb(oParameters.DbLogin, oParameters.DbName, oParameters.DbHost);
};

CDbAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

CDbAdminSettingsView.prototype.testConnection = function ()
{
	Ajax.send('Core', 'TestDbConnection', this.getParametersForSave(), function (oResponse) {
		if (oResponse.Result)
		{
			Screens.showReport(TextUtils.i18n('CORECLIENT/REPORT_DB_CONNECT_SUCCESSFUL'));
		}
		else
		{
			Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_DB_CONNECT_FAILED'));
		}
	}, this);
};

CDbAdminSettingsView.prototype.createTables = function ()
{
	Ajax.send('Core', 'CreateTables', null, function (oResponse) {
		if (oResponse.Result)
		{
			Screens.showReport(TextUtils.i18n('CORECLIENT/REPORT_CREATE_TABLES_SUCCESSFUL'));
		}
		else
		{
			Screens.showError(TextUtils.i18n('CORECLIENT/ERROR_CREATE_TABLES_FAILED'));
		}
	}, this);
};

module.exports = new CDbAdminSettingsView();
