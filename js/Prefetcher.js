'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	moment = require('moment-timezone'),
	
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
	Storage = require('%PathToCoreWebclientModule%/js/Storage.js'),
	
	Settings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	
	ModulesPrefetchers = ModulesManager.getModulesPrefetchers(),
	Prefetcher = {},
	bServerInitializationsDone = false
;

Prefetcher.start = function ()
{
	if (App.getUserRole() !== Enums.UserRole.Anonymous && !App.isNewTab() && !Ajax.hasInternetConnectionProblem() && !Ajax.hasOpenedRequests())
	{
		Prefetcher.prefetchAll();
	}
};

Prefetcher.prefetchAll = function ()
{
	var bPrefetchStarted = this.doServerInitializations();
	
	_.each(ModulesPrefetchers, function (oModulePrefetcher) {
		if (!bPrefetchStarted)
		{
			if (Settings.AllowPrefetch && $.isFunction(oModulePrefetcher.startAll))
			{
				bPrefetchStarted = oModulePrefetcher.startAll();
			}
			else if ($.isFunction(oModulePrefetcher.startMin))
			{
				bPrefetchStarted = oModulePrefetcher.startMin();
			}
		}
	});
};

Prefetcher.doServerInitializations = function ()
{
	if (App.getUserRole() !== Enums.UserRole.Anonymous && !App.isNewTab() && !App.isPublic() && !bServerInitializationsDone)
	{
		var
			newTime = moment(),
			timezone = moment.tz.guess()
		;

		Ajax.send('Core', 'DoServerInitializations', {Timezone: timezone}, function (oResponse) {
			if (oResponse.Result !== true)
			{
				if (oResponse.Result.Timezone === '')
				{
					Ajax.send('Core', 'UpdateUserTimezone', {Timezone: timezone});
				}
				else if (oResponse.Result.Timezone && Storage.getData('showNewTimezone') !== timezone)
				{
					Screens.showReport(TextUtils.i18n('%MODULENAME%/CONFIRM_TIMEZONE_CHANGES', {
						OLDTIME: newTime.clone().tz(oResponse.Result.Timezone).format('HH:mm'),
						NEWTIME: newTime.format('HH:mm')
					}), 0);
					$('.report_panel.report a').on('click', function () {
						Storage.removeData('showNewTimezone');
						Ajax.send('Core', 'UpdateUserTimezone', {Timezone: timezone}, function (oResponse) {
							if (oResponse.Result === true)
							{
								Screens.hideReport();
							}
							else
							{
								Screens.hideReport();
								Screens.showError(TextUtils.i18n('%MODULENAME%/ERROR_TIMEZONE_CHANGES'));
							}
						});
					});
					Storage.setData('showNewTimezone', timezone);
				}
			}
		});
		bServerInitializationsDone = true;
		
		return true;
	}
	return false;
};

Ajax.registerOnAllRequestsClosedHandler(function () {
	Prefetcher.start();
});
