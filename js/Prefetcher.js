'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	moment = require('moment-timezone'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
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
			oNowMoment = moment(),
			sBrowserTimezone = moment.tz.guess()
		;
		
		Ajax.send('Core', 'DoServerInitializations', {Timezone: sBrowserTimezone}, function (oResponse) {
			var sServerTimezone = oResponse.Result && oResponse.Result.Timezone;
			
			if (Types.isString(sServerTimezone))
			{
				if (sServerTimezone === '')
				{
					Ajax.send('Core', 'UpdateUserTimezone', {Timezone: sBrowserTimezone});
				}
				else
				{
					if (Storage.getData('showNewTimezone') !== sBrowserTimezone)
					{
						Screens.showReport(TextUtils.i18n('%MODULENAME%/CONFIRM_TIMEZONE_CHANGES', {
							OLDTIME: oNowMoment.clone().tz(sServerTimezone).format('HH:mm') + ' (' + sServerTimezone + ')',
							NEWTIME: oNowMoment.format('HH:mm') + ' (' + sBrowserTimezone + ')'
						}), 0);

						$('.report_panel.report a').on('click', function () {
							Storage.removeData('showNewTimezone');
							Ajax.send('Core', 'UpdateUserTimezone', {Timezone: sBrowserTimezone}, function (oUpdateResponse) {
								Screens.hideReport();
								if (oUpdateResponse.Result === true)
								{
									moment.tz.setDefault(sBrowserTimezone);
								}
								else
								{
									Screens.showError(TextUtils.i18n('%MODULENAME%/ERROR_TIMEZONE_CHANGES'));
								}
							});
						});
						Storage.setData('showNewTimezone', sBrowserTimezone);
					}
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
