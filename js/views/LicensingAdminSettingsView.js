'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('%PathToCoreWebclientModule%/js/Settings.js')
;

/**
* @constructor
*/
function CLicensingAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	/* Editable fields */
	this.licenseKey = ko.observable(Settings.LicenseKey);
	/*-- Editable fields */
	
	this.usersNumber = ko.observable(5);
	this.licenseType = ko.observable('Unlim');
}

_.extendOwn(CLicensingAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CLicensingAdminSettingsView.prototype.ViewTemplate = 'CoreClient_LicensingAdminSettingsView';

CLicensingAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.licenseKey()
	];
};

CLicensingAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.licenseKey(Settings.LicenseKey);
};

CLicensingAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'LicenseKey': this.licenseKey()
	};
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CLicensingAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
//	Settings.updateLicense(oParameters.LicenseKey);
};

CLicensingAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

module.exports = new CLicensingAdminSettingsView();
