'use strict';

var
	$ = require('jquery'),
	ko = require('knockout'),
	
	UrlUtils = require('modules/CoreClient/js/utils/Url.js'),
	Types = require('modules/CoreClient/js/utils/Types.js'),
	
	AppData = window.auroraAppData,
	
	bRtl = $('html').hasClass('rtl')
;

module.exports = {
	ServerModuleName: 'Core',
	HashModuleName: 'core',
	
	AllowChangeSettings: AppData.App ? !!AppData.App.AllowUsersChangeInterfaceSettings : false,
	AllowClientDebug: !!AppData.ClientDebug,
	AllowDesktopNotifications: AppData.User ? !!AppData.User.DesktopNotifications : true,
	AllowIosProfile: AppData.App ? !!AppData.App.AllowIosProfile : false, // ? IosDetectOnLogin
	AllowMobile: !!AppData.AllowMobile,
	AllowPrefetch: AppData.App ? !!AppData.App.AllowPrefetch : true,
	AttachmentSizeLimit: AppData.App ? Types.pInt(AppData.App.AttachmentSizeLimit) : 0, // Mail, Helpdesk
	AutoRefreshIntervalMinutes: AppData.User ? Types.pInt(AppData.User.AutoRefreshInterval) : 1,
	CsrfToken: Types.pString(AppData.Token),
	CustomLogoutUrl: AppData.App ? Types.pString(AppData.App.CustomLogoutUrl) : '',
	DateFormat: 'DD/MM/YYYY',
	DateFormatList: AppData.App && $.isArray(AppData.App.DateFormats) ? AppData.App.DateFormats : [],
	EntryModule: 'MailClient', // AppData.App.DefaultTab
	GoogleAnalyticsAccount: AppData.App ? Types.pString(AppData.App.GoogleAnalyticsAccount) : '',
	IsDemo: AppData.User ? !!AppData.User.IsDemo : false,
	IsMailsuite: !!AppData.IsMailsuite,
	IsMobile: !!AppData.IsMobile,
	IsRTL: bRtl,
	Language: 'English',
	LanguageList: AppData.App && $.isArray(AppData.App.Languages) ? AppData.App.Languages : [],
	LastErrorCode: Types.pString(AppData.LastErrorCode),
	LogoUrl: '',
	RedirectToHelpdesk: !!AppData.HelpdeskRedirect, // todo
	ShowQuotaBar: AppData.App ? !!AppData.App.ShowQuotaBar : true, // Files module, Mail module
	SiteName: 'Aurora Cloud',
	SocialName: AppData.User ? Types.pString(AppData.User.SocialName) : '', // Mail module
	SyncIosAfterLogin: AppData.App ? !!AppData.App.IosDetectOnLogin : false, // ? AllowIosProfile
	TenantName: Types.pString(AppData.TenantName || UrlUtils.getRequestParam('tenant')),
	Theme: AppData.User ? Types.pString(AppData.User.DefaultTheme) : (AppData.App ? Types.pString(AppData.App.DefaultTheme) : 'Default'),
	ThemeList: AppData.App && $.isArray(AppData.App.Themes) ? AppData.App.Themes : [],
	timeFormat: ko.observable('0'), // 0 - 24, 1 - 12
	UserId: AppData.User ? Types.pInt(AppData.User.IdUser) : 0,
	
	// unused, should be removed
	AllowBodySize: AppData.App ? !!AppData.App.AllowBodySize : false,
	DefaultLanguageShort: AppData.User ? Types.pString(AppData.User.DefaultLanguageShort) : (AppData.App ? Types.pString(AppData.App.DefaultLanguageShort) : 'en'),
	DemoWebMail: AppData.App ? !!AppData.App.DemoWebMail : false,
	MaxBodySize: AppData.App ? Types.pInt(AppData.App.MaxBodySize) : 0,
	MaxSubjectSize: AppData.App ? Types.pInt(AppData.App.MaxSubjectSize) : 0,
	ServerUrlRewriteBase: AppData.App ? Types.pString(AppData.App.ServerUrlRewriteBase) : '',
	ServerUseUrlRewrite: AppData.App ? Types.pString(AppData.App.ServerUseUrlRewrite) : '',
	AllowVoice: AppData.User ? !!AppData.User.AllowVoice : true,
	CanLoginWithPassword: AppData.User ? !!AppData.User.CanLoginWithPassword : true,
	EmailNotification: AppData.User ? Types.pString(AppData.User.EmailNotification) : '',
	LastLogin: AppData.User ? Types.pInt(AppData.User.LastLogin) : 0,
	LoginsCount: AppData.User ? Types.pInt(AppData.User.LoginsCount) : 0,
	SipCallerID: AppData.User ? Types.pString(AppData.User.SipCallerID) : '',
	SipEnable: AppData.User ? !!AppData.User.SipEnable : true,
	TwilioEnable: AppData.User ? !!AppData.User.TwilioEnable : true,
	TwilioNumber: AppData.User ? Types.pInt(AppData.User.TwilioNumber) : 0,
	
	init: function (oAppDataSection) {
		if (oAppDataSection)
		{
			this.DateFormat = Types.pString(oAppDataSection.DefaultDateFormat);
			this.Language = Types.pString(oAppDataSection.DefaultLanguage);
			this.LogoUrl = Types.pString(oAppDataSection.AppStyleImage);
			this.SiteName = Types.pString(oAppDataSection.SiteName);
			this.timeFormat(Types.pString(oAppDataSection.DefaultTimeFormat));
			
			//only for admin
			this.LicenseKey = Types.pString(oAppDataSection.LicenseKey);
			this.DbHost = Types.pString(oAppDataSection.DBHost);
			this.DbName = Types.pString(oAppDataSection.DBName);
			this.DbLogin = Types.pString(oAppDataSection.DBLogin);
			this.AdminLogin = Types.pString(oAppDataSection.AdminLogin);
			this.AdminHasPassword = !!oAppDataSection.AdminHasPassword;
			this.EnableLogging = !!oAppDataSection.EnableLogging;
			this.EnableEventLogging = !!oAppDataSection.EnableEventLogging;
			this.LoggingLevel = Types.pString(oAppDataSection.LoggingLevel);
		}
	},
	
	update: function (iAutoRefreshIntervalMinutes, sDefaultTheme, sLanguage, sTimeFormat, sDesktopNotifications) {
		this.AutoRefreshIntervalMinutes = iAutoRefreshIntervalMinutes;
		this.Theme = sDefaultTheme;
		this.Language = sLanguage;
		this.timeFormat(sTimeFormat);
		this.AllowDesktopNotifications = sDesktopNotifications === '1';
	},
	
	/**
	 * Updates admin login from settings tab in admin panel.
	 * 
	 * @param {string} sAdminLogin Admin login.
	 */
	updateSecurity: function (sAdminLogin)
	{
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
		this.DbName = sDbName;
		this.DbLogin = sDbLogin;
	}
};
