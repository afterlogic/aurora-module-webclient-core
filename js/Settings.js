'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	AppData = window.auroraAppData,
	
	bRtl = $('html').hasClass('rtl')
;

var Settings = {
	ServerModuleName: 'Core',
	HashModuleName: 'core',
	
	AllowChangeSettings: false,
	AllowClientDebug: false,
	AllowDesktopNotifications: false,
	AllowIosProfile: false,
	AllowMobile: false,
	AllowPrefetch: false,
	AttachmentSizeLimit: 0,
	AutoRefreshIntervalMinutes: 1,
	CustomLogoutUrl: '',
	DateFormat: 'DD/MM/YYYY',
	DateFormatList: ['DD/MM/YYYY'],
	EntryModule: '',
	GoogleAnalyticsAccount: '',
	IsDemo: false,
	IsMobile: -1,
	IsRTL: bRtl,
	Language: 'English',
	LanguageList: [{name: 'English', text: 'English'}],
	LastErrorCode: 0,
	LogoUrl: '',
	ShowQuotaBar: false,
	SiteName: 'Afterlogic Platform',
	SocialName: '',
	SyncIosAfterLogin: false,
	TenantName: '',
	Theme: 'Default',
	ThemeList: [],
	timeFormat: ko.observable('0'), // 0 - 24, 1 - 12
	UserId: 0,
	HeaderModulesOrder: [],
	
	init: function (oAppDataSection) {
		if (oAppDataSection)
		{
			this.AllowChangeSettings = !!oAppDataSection.AllowChangeSettings;
			this.AllowClientDebug = !!oAppDataSection.AllowClientDebug;
			this.AllowDesktopNotifications = !!oAppDataSection.AllowDesktopNotifications;
			this.AllowIosProfile = !!oAppDataSection.AllowIosProfile;
			this.AllowMobile = !!oAppDataSection.AllowMobile;
			this.AllowPrefetch = !!oAppDataSection.AllowPrefetch;
			this.AttachmentSizeLimit = Types.pInt(oAppDataSection.AttachmentSizeLimit);
			this.AutoRefreshIntervalMinutes = Types.pInt(oAppDataSection.AutoRefreshIntervalMinutes);
			this.CustomLogoutUrl = Types.pString(oAppDataSection.CustomLogoutUrl);
			this.DateFormat = Types.pString(oAppDataSection.DateFormat);
			this.DateFormatList = _.isArray(oAppDataSection.DateFormatList) ? oAppDataSection.DateFormatList : ['DD/MM/YYYY'],
			this.EntryModule = Types.pString(oAppDataSection.EntryModule);
			this.EUserRole = oAppDataSection.EUserRole;
			this.GoogleAnalyticsAccount = Types.pString(oAppDataSection.GoogleAnalyticsAccount);
			this.IsDemo = !!oAppDataSection.IsDemo;
			this.IsMobile = Types.pInt(oAppDataSection.IsMobile);
			this.Language = Types.pString(oAppDataSection.Language);
			this.LanguageList = _.isArray(oAppDataSection.LanguageListWithNames) ? oAppDataSection.LanguageListWithNames : [{name: 'English', text: 'English'}],
			this.LastErrorCode = Types.pInt(oAppDataSection.LastErrorCode);
			this.LogoUrl = Types.pString(oAppDataSection.LogoUrl);
			this.ShowQuotaBar = !!oAppDataSection.ShowQuotaBar;
			this.SiteName = Types.pString(oAppDataSection.SiteName);
			this.SocialName = Types.pString(oAppDataSection.SocialName);
			this.SyncIosAfterLogin = !!oAppDataSection.SyncIosAfterLogin;
			this.TenantName = Types.pString(oAppDataSection.TenantName || UrlUtils.getRequestParam('tenant'));
			this.Theme = Types.pString(oAppDataSection.Theme);
			this.ThemeList = _.isArray(oAppDataSection.ThemeList) ? oAppDataSection.ThemeList : [],
			this.timeFormat(Types.pString(oAppDataSection.TimeFormat));
			this.UserId = Types.pInt(oAppDataSection.UserId);
			this.HeaderModulesOrder = _.isArray(oAppDataSection.HeaderModulesOrder) ? oAppDataSection.HeaderModulesOrder : [],
			
			//only for admin
			this.LicenseKey = Types.pString(oAppDataSection.LicenseKey);
			this.DbHost = Types.pString(oAppDataSection.DBHost);
			this.DbName = Types.pString(oAppDataSection.DBName);
			this.DbLogin = Types.pString(oAppDataSection.DBLogin);
			this.AdminLogin = Types.pString(oAppDataSection.AdminLogin);
			this.AdminHasPassword = !!oAppDataSection.AdminHasPassword;
		}
	},
	
	update: function (iAutoRefreshIntervalMinutes, sDefaultTheme, sLanguage, sTimeFormat, bAllowDesktopNotifications) {
		this.AutoRefreshIntervalMinutes = iAutoRefreshIntervalMinutes;
		this.Theme = sDefaultTheme;
		this.Language = sLanguage;
		this.timeFormat(sTimeFormat);
		this.AllowDesktopNotifications = bAllowDesktopNotifications;
	},
	
	/**
	 * Updates admin login from settings tab in admin panel.
	 * 
	 * @param {string} sAdminLogin Admin login.
	 * @param {boolean} bAdminHasPassword
	 */
	updateSecurity: function (sAdminLogin, bAdminHasPassword)
	{
		this.AdminLogin = sAdminLogin;
		this.AdminHasPassword = bAdminHasPassword;
	},
	
	/**
	 * Updates settings from db settings tab in admin panel.
	 * 
	 * @param {string} sDbLogin Database login.
	 * @param {string} sDbName Database name.
	 * @param {string} sDbHost Database host.
	 */
	updateDb: function (sDbLogin, sDbName, sDbHost)
	{
		this.DbHost = sDbHost;
		this.DbName = sDbName;
		this.DbLogin = sDbLogin;
	}
};

var oAppDataSection = _.extend({}, AppData[Settings.ServerModuleName] || {}, AppData['%ModuleName%'] || {});

Settings.init(oAppDataSection);

module.exports = Settings;
