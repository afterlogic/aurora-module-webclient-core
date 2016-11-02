'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	$ = require('jquery'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	Browser = require('%PathToCoreWebclientModule%/js/Browser.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Routing = require('%PathToCoreWebclientModule%/js/Routing.js'),
	Settings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
	
	CAbstractScreenView = require('%PathToCoreWebclientModule%/js/views/CAbstractScreenView.js')
;

/**
 * @constructor
 */
function CHeaderView()
{
	CAbstractScreenView.call(this, '%ModuleName%');
	
	this.tabs = ModulesManager.getModulesTabs(false);
	ko.computed(function () {
		_.each(this.tabs, function (oTab) {
			if (oTab.isCurrent)
			{
				oTab.isCurrent(Screens.currentScreen() === oTab.sName);
				if (oTab.isCurrent() && Types.isNonEmptyString(Routing.currentHash()))
				{
					oTab.hash('#' + Routing.currentHash());
				}
			}
		});
	}, this).extend({ rateLimit: 50 });
	
	this.showLogout = App.getUserRole() !== Enums.UserRole.Anonymous && !App.isPublic();

	this.sLogoUrl = Settings.LogoUrl;
	
	this.mobileDevice = Browser.mobileDevice;
	
	App.broadcastEvent('%ModuleName%::ConstructView::after', {'Name': this.ViewConstructorName, 'View': this});
	
	if (!_.isEmpty(this.tabs) || this.showLogout) {
		$('#auroraContent > .screens').addClass('show-header');
	}
}

_.extendOwn(CHeaderView.prototype, CAbstractScreenView.prototype);

CHeaderView.prototype.ViewTemplate = App.isMobile() ? 'CoreWebclient_HeaderMobileView' : 'CoreWebclient_HeaderView';
CHeaderView.prototype.ViewConstructorName = 'CHeaderView';

CHeaderView.prototype.logout = function ()
{
	App.logout();
};

CHeaderView.prototype.switchToFullVersion = function ()
{
	Ajax.send('Core', 'SetMobile', {'Mobile': false}, function (oResponse) {
		if (oResponse.Result)
		{
			window.location.reload();
		}
	}, this);
};

module.exports = new CHeaderView();
