'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsClient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/CoreClient/js/Settings.js')
;

/**
* @constructor
*/
function CDbAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	/* Editable fields */
	this.dbLogin = ko.observable(Settings.DbLogin);
	this.dbPassword = ko.observable('xxxxxxxxxx');
	this.dbName = ko.observable(Settings.DbName);
	this.dbHost = ko.observable(Settings.DbHost);
	/*-- Editable fields */
}

_.extendOwn(CDbAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CDbAdminSettingsView.prototype.ViewTemplate = 'CoreClient_DbAdminSettingsView';

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
	this.dbPassword('xxxxxxxxxx');
	this.dbName(Settings.DbName);
	this.dbHost(Settings.DbHost);
};

CDbAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'DbLogin': this.dbLogin(),
		'DbPassword': this.dbPassword(),
		'DbName': this.dbName(),
		'DbHost': this.dbHost()
	};
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CDbAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
//	Settings.updateDb(oParameters.DbLogin, oParameters.DbPassword, oParameters.DbName, oParameters.DbHost);
};

CDbAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

module.exports = new CDbAdminSettingsView();
