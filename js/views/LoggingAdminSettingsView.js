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
function CLoggingAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	/* Editable fields */
	this.enableLogging = ko.observable(Settings.EnableLogging);
	this.enableEventLogging = ko.observable(Settings.EnableEventLogging);
	this.loggingLevel = ko.observable(Settings.LoggingLevel);
	/*-- Editable fields */
}

_.extendOwn(CLoggingAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CLoggingAdminSettingsView.prototype.ViewTemplate = 'CoreClient_LoggingAdminSettingsView';

CLoggingAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.enableLogging(),
		this.enableEventLogging(),
		this.loggingLevel()
	];
};

CLoggingAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.enableLogging(Settings.EnableLogging);
	this.enableEventLogging(Settings.EnableEventLogging);
	this.loggingLevel(Settings.LoggingLevel);
};

CLoggingAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'EnableLogging': this.enableLogging(),
		'EnableEventLogging': this.enableEventLogging(),
		'LoggingLevel': this.loggingLevel()
	};
};

/**
 * @param {Object} oParameters
 */
CLoggingAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
//	Settings.updateLogging(oParameters.EnableLogging, oParameters.EnableEventLogging, oParameters.LoggingLevel);
};

CLoggingAdminSettingsView.prototype.setAccessLevel = function (sEntitiesName, iEntityId)
{
	this.visible(sEntitiesName === '');
};

module.exports = new CLoggingAdminSettingsView();
