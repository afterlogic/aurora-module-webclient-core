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
	
	AutodetectLanguage: false,
	DateFormat: 'DD/MM/YYYY',
	DateFormatList: ['DD/MM/YYYY'],
	EUserRole: {},
	IsSystemConfigured: false,
	Language: 'English',
	LastErrorCode: 0,
	SiteName: 'Afterlogic Platform',
	SocialName: '',
	TenantName: '',
	timeFormat: ko.observable('0'), // 0 - 24, 1 - 12
	UserId: 0,
	
	AdminHasPassword: '',
	AdminLanguage: '',
	AdminLogin: '',
	DbHost: '',
	DbLogin: '',
	DbName: '',
	SaltNotEmpty: false,
	
	AllowChangeSettings: false,
	AllowClientDebug: false,
	AllowDesktopNotifications: false,
	AllowIosProfile: false,
	AllowMobile: false,
	AllowPrefetch: true,
	AttachmentSizeLimit: 0,
	AutoRefreshIntervalMinutes: 1,
	CustomLogoutUrl: '',
	EntryModule: '',
	GoogleAnalyticsAccount: '',
	HeaderModulesOrder: [],
	IsDemo: false,
	IsMobile: -1,
	LanguageList: [{name: 'English', text: 'English'}],
	LogoUrl: '',
	ShowQuotaBar: false,
	SyncIosAfterLogin: false,
	Theme: 'Default',
	ThemeList: [],
	
	IsRTL: bRtl,
	
	/**
	 * Initializes settings from AppData object sections.
	 * 
	 * @param {Object} oAppData Object contained modules settings.
	 */
	init: function (oAppData)
	{
		var
			oAppDataCoreSection = oAppData[Settings.ServerModuleName],
			oAppDataCoreWebclientSection = oAppData['%ModuleName%']
		;
		
		if (!_.isEmpty(oAppDataCoreSection))
		{
			this.AutodetectLanguage = Types.pBool(oAppDataCoreSection.AutodetectLanguage, this.AutodetectLanguage);
			this.DateFormat = Types.pString(oAppDataCoreSection.DateFormat, this.DateFormat);
			this.DateFormatList = Types.pArray(oAppDataCoreSection.DateFormatList, this.DateFormatList);
			this.EUserRole = Types.pObject(oAppDataCoreSection.EUserRole, this.EUserRole);
			this.IsSystemConfigured = Types.pBool(oAppDataCoreSection.IsSystemConfigured, this.IsSystemConfigured);
			this.Language = Types.pString(oAppDataCoreSection.Language, this.Language);
			this.LastErrorCode = Types.pInt(oAppDataCoreSection.LastErrorCode, this.LastErrorCode);
			this.SiteName = Types.pString(oAppDataCoreSection.SiteName, this.SiteName);
			this.SocialName = Types.pString(oAppDataCoreSection.SocialName, this.SocialName);
			this.TenantName = Types.pString(oAppDataCoreSection.TenantName || UrlUtils.getRequestParam('tenant'), this.TenantName);
			this.timeFormat(Types.pString(oAppDataCoreSection.TimeFormat, this.timeFormat()));
			this.UserId = Types.pInt(oAppDataCoreSection.UserId, this.UserId);
			
			//only for admin
			this.AdminHasPassword = Types.pBool(oAppDataCoreSection.AdminHasPassword, this.AdminHasPassword);
			this.AdminLanguage = Types.pString(oAppDataCoreSection.AdminLanguage, this.AdminLanguage);
			this.AdminLogin = Types.pString(oAppDataCoreSection.AdminLogin, this.AdminLogin);
			this.DbHost = Types.pString(oAppDataCoreSection.DBHost, this.DbHost);
			this.DbLogin = Types.pString(oAppDataCoreSection.DBLogin, this.DbLogin);
			this.DbName = Types.pString(oAppDataCoreSection.DBName, this.DbName);
			this.SaltNotEmpty = Types.pBool(oAppDataCoreSection.SaltNotEmpty, this.SaltNotEmpty);
		}
		
		if (!_.isEmpty(oAppDataCoreWebclientSection))
		{
			this.AllowChangeSettings = Types.pBool(oAppDataCoreWebclientSection.AllowChangeSettings, this.AllowChangeSettings);
			this.AllowClientDebug = Types.pBool(oAppDataCoreWebclientSection.AllowClientDebug, this.AllowClientDebug);
			this.AllowDesktopNotifications = Types.pBool(oAppDataCoreWebclientSection.AllowDesktopNotifications, this.AllowDesktopNotifications);
			this.AllowIosProfile = Types.pBool(oAppDataCoreWebclientSection.AllowIosProfile, this.AllowIosProfile);
			this.AllowMobile = Types.pBool(oAppDataCoreWebclientSection.AllowMobile, this.AllowMobile);
			this.AllowPrefetch = Types.pBool(oAppDataCoreWebclientSection.AllowPrefetch, this.AllowPrefetch);
			this.AttachmentSizeLimit = Types.pNonNegativeInt(oAppDataCoreWebclientSection.AttachmentSizeLimit, this.AttachmentSizeLimit);
			this.AutoRefreshIntervalMinutes = Types.pNonNegativeInt(oAppDataCoreWebclientSection.AutoRefreshIntervalMinutes, this.AutoRefreshIntervalMinutes);
			this.CustomLogoutUrl = Types.pString(oAppDataCoreWebclientSection.CustomLogoutUrl, this.CustomLogoutUrl);
			this.EntryModule = Types.pString(oAppDataCoreWebclientSection.EntryModule, this.EntryModule);
			this.GoogleAnalyticsAccount = Types.pString(oAppDataCoreWebclientSection.GoogleAnalyticsAccount, this.GoogleAnalyticsAccount);
			this.HeaderModulesOrder = Types.pArray(oAppDataCoreWebclientSection.HeaderModulesOrder, this.HeaderModulesOrder);
			this.IsDemo = Types.pBool(oAppDataCoreWebclientSection.IsDemo, this.IsDemo);
			this.IsMobile = Types.pInt(oAppDataCoreWebclientSection.IsMobile, this.IsMobile);
			this.LanguageList = Types.pArray(oAppDataCoreWebclientSection.LanguageListWithNames, this.LanguageList);
			this.LogoUrl = Types.pString(oAppDataCoreWebclientSection.LogoUrl, this.LogoUrl);
			this.ShowQuotaBar = Types.pBool(oAppDataCoreWebclientSection.ShowQuotaBar, this.ShowQuotaBar);
			this.SyncIosAfterLogin = Types.pBool(oAppDataCoreWebclientSection.SyncIosAfterLogin, this.SyncIosAfterLogin);
			this.Theme = Types.pString(oAppDataCoreWebclientSection.Theme, this.Theme);
			this.ThemeList = Types.pArray(oAppDataCoreWebclientSection.ThemeList, this.ThemeList);
		}
	},
	
	/**
	 * Updates new settings values after saving on server.
	 * 
	 * @param {number} iAutoRefreshIntervalMinutes
	 * @param {string} sDefaultTheme
	 * @param {string} sLanguage
	 * @param {string} sTimeFormat
	 * @param {boolean} bAllowDesktopNotifications
	 */
	update: function (iAutoRefreshIntervalMinutes, sDefaultTheme, sLanguage, sTimeFormat, bAllowDesktopNotifications)
	{
		this.Language = sLanguage;
		this.timeFormat(sTimeFormat);
		
		this.AllowDesktopNotifications = bAllowDesktopNotifications;
		this.AutoRefreshIntervalMinutes = iAutoRefreshIntervalMinutes;
		this.Theme = sDefaultTheme;
	},
	
	/**
	 * Updates admin login from settings tab in admin panel.
	 * 
	 * @param {string} sAdminLogin Admin login.
	 * @param {boolean} bAdminHasPassword
	 */
	updateSecurity: function (sAdminLogin, bAdminHasPassword)
	{
		this.AdminHasPassword = bAdminHasPassword;
		this.AdminLogin = sAdminLogin;
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
		this.DbLogin = sDbLogin;
		this.DbName = sDbName;
	}
};

Settings.init(AppData);

module.exports = Settings;
