'use strict';

var
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	AppData = window.auroraAppData
;
var ModuleErrors = {
	Errors: {},
	init: function (oAppData)
	{
		this.Errors = Types.pObject(oAppData.module_errors, {});
	},
	getErrorMessage: function (oResponse)
	{
		var
			mResult = false,
			iErrorCode = typeof oResponse.ErrorCode !== 'undefined' ? oResponse.ErrorCode : null,
			sModuleName = typeof oResponse.Module !== 'undefined' ? oResponse.Module : null
		;
		if (iErrorCode !== null && sModuleName !== null
			&& typeof this.Errors[sModuleName] !== 'undefined' 
			&& typeof this.Errors[sModuleName][iErrorCode] !== 'undefined')
		{
			mResult = this.Errors[sModuleName][iErrorCode];
		}
		return mResult;
	}
};

ModuleErrors.init(AppData);

module.exports = ModuleErrors;