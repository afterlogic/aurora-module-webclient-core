'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	FilesUtils = require('%PathToCoreWebclientModule%/js/utils/Files.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	WindowOpener = require('%PathToCoreWebclientModule%/js/WindowOpener.js'),
	
	aViewMimeTypes = [
		'image/jpeg', 'image/png', 'image/gif',
		'text/html', 'text/plain', 'text/css',
		'text/rfc822-headers', 'message/delivery-status',
		'application/x-httpd-php', 'application/javascript',
		'application/pdf'
	]
;

if ($('html').hasClass('pdf'))
{
	aViewMimeTypes.push('application/pdf');
	aViewMimeTypes.push('application/x-pdf');
}

/**
 * @constructor
 */
function CAbstractFileModel()
{
	this.id = ko.observable('');
	this.fileName = ko.observable('');
	this.tempName = ko.observable('');
	this.displayName = ko.observable('');
	this.extension = ko.observable('');
	
	this.fileName.subscribe(function (sFileName) {
		this.id(sFileName);
		this.displayName(sFileName);
		this.extension(Utils.getFileExtension(sFileName));
	}, this);
	
	this.size = ko.observable(0);
	this.friendlySize = ko.computed(function () {
		return this.size() > 0 ? TextUtils.getFriendlySize(this.size()) : '';
	}, this);
	
	this.hash = ko.observable('');
	this.iframedView = ko.observable(false);
	
	this.sThumbUrl = '';

	this.thumbnailSrc = ko.observable('');
	this.thumbnailLoaded = ko.observable(false);
	this.thumbnailSessionUid = ko.observable('');

	this.mimeType = ko.observable('');
	this.uploadUid = ko.observable('');
	this.uploaded = ko.observable(false);
	this.uploadError = ko.observable(false);
	this.isViewMimeType = ko.computed(function () {
		return (-1 !== $.inArray(this.mimeType(), aViewMimeTypes)) || this.iframedView();
	}, this);
	this.bHasHtmlEmbed = false;
	
	this.otherTemplates = ko.observableArray([]);

	this.statusText = ko.observable('');
	this.statusTooltip = ko.computed(function () {
		return this.uploadError() ? this.statusText() : '';
	}, this);
	this.progressPercent = ko.observable(0);
	this.visibleProgress = ko.observable(false);
	
	this.uploadStarted = ko.observable(false);
	this.uploadStarted.subscribe(function () {
		if (this.uploadStarted())
		{
			this.uploaded(false);
			this.visibleProgress(true);
			this.progressPercent(20);
		}
		else
		{
			this.progressPercent(100);
			this.visibleProgress(false);
			this.uploaded(true);
		}
	}, this);
	
	this.allowDrag = ko.observable(false);
	this.allowUpload = ko.observable(false);
	this.allowSharing = ko.observable(false);
	
	this.sHeaderText = '';

	this.oActionsData = {
		'view': {
			'Text': TextUtils.i18n('COREWEBCLIENT/ACTION_VIEW_FILE'),
			'Handler': _.bind(function () { this.viewFile(); }, this)
		},
		'download': {
			'Text': TextUtils.i18n('COREWEBCLIENT/ACTION_DOWNLOAD_FILE'),
			'Handler': _.bind(function () { this.downloadFile(); }, this),
			'Tooltip': ko.computed(function () {
				var sTitle = TextUtils.i18n('%MODULENAME%/INFO_CLICK_TO_DOWNLOAD_FILE', {
					'FILENAME': this.fileName(),
					'SIZE': this.friendlySize()
				});

				if (this.friendlySize() === '')
				{
					sTitle = sTitle.replace(' ()', '');
				}

				return sTitle;
			}, this)
		}
	};
	
	this.allowActions = ko.observable(true);
	
	this.iconAction = ko.observable('download');
	
	this.cssClasses = ko.computed(function () {
		return this.getCommonClasses().join(' ');
	}, this);
	
	this.actions = ko.observableArray([]);
	
	this.firstAction = ko.computed(function () {
		if (this.actions().length > 1)
		{
			return this.actions()[0];
		}
		return '';
	}, this);
	
	this.secondAction = ko.computed(function () {
		if (this.actions().length === 1)
		{
			return this.actions()[0];
		}
		if (this.actions().length > 1)
		{
			return this.actions()[1];
		}
		return '';
	}, this);
}

CAbstractFileModel.prototype.getMainAction = function ()
{
	return this.actions()[0];
};

CAbstractFileModel.prototype.hasAction = function (sAction)
{
	return _.indexOf(this.actions(), sAction) !== -1;
};

/**
 * Returns button text for specified action.
 * @param {string} sAction
 * @returns string
 */
CAbstractFileModel.prototype.getActionText = function (sAction)
{
	if (this.hasAction(sAction) && this.oActionsData[sAction] && typeof this.oActionsData[sAction].Text === 'string')
	{
		return this.oActionsData[sAction].Text;
	}
	return '';
};

CAbstractFileModel.prototype.getActionUrl = function (sAction)
{
	return (this.hasAction(sAction) && this.oActionsData[sAction]) ? (this.oActionsData[sAction].Url || '') : '';
};

/**
 * Executes specified action.
 * @param {string} sAction
 */
CAbstractFileModel.prototype.executeAction = function (sAction)
{
	if (this.hasAction(sAction) && this.oActionsData[sAction] && _.isFunction(this.oActionsData[sAction].Handler))
	{
		this.oActionsData[sAction].Handler();
	}
};

/**
 * Returns tooltip for specified action.
 * @param {string} sAction
 * @returns string
 */
CAbstractFileModel.prototype.getTooltip = function (sAction)
{
	var mTootip = this.hasAction(sAction) && this.oActionsData[sAction] ? this.oActionsData[sAction].Tooltip : '';
	if (typeof mTootip === 'string')
	{
		return mTootip;
	}
	if (_.isFunction(mTootip))
	{
		return mTootip();
	}
	return '';
};

/**
 * Returns list of css classes for file.
 * @returns array
 */
CAbstractFileModel.prototype.getCommonClasses = function ()
{
	var aClasses = [];

	if (this.allowUpload() && !this.uploaded())
	{
		aClasses.push('incomplete');
	}
	if (this.uploadError())
	{
		aClasses.push('fail');
	}
	else
	{
		aClasses.push('success');
	}

	return aClasses;
};

/**
 * Parses attachment data from server.
 * @param {AjaxAttachmenResponse} oData
 */
CAbstractFileModel.prototype.parse = function (oData)
{
	this.fileName(Types.pString(oData.FileName));
	this.tempName(Types.pString(oData.TempName));
	if (this.tempName() === '')
	{
		this.tempName(this.fileName());
	}

	this.mimeType(Types.pString(oData.MimeType));
	this.size(oData.EstimatedSize ? Types.pInt(oData.EstimatedSize) : Types.pInt(oData.SizeInBytes));

	this.hash(Types.pString(oData.Hash));

	this.sThumbUrl = Types.pString(oData.ThumbnailUrl);
	_.each (oData.Actions, function (oData, sAction) {
		if (!this.oActionsData[sAction])
		{
			this.oActionsData[sAction] = {};
		}
		this.oActionsData[sAction].Url = Types.pString(oData.url);
		this.actions.push(sAction);
	}, this);

	this.iframedView(!!oData.Iframed);

	this.uploadUid(this.hash());
	this.uploaded(true);

	if ($.isFunction(this.additionalParse))
	{
		this.additionalParse(oData);
	}
};

CAbstractFileModel.prototype.isViewSupported = function ()
{
	return (-1 !== $.inArray(this.mimeType(), aViewMimeTypes)) || this.iframedView();
};

CAbstractFileModel.prototype.getInThumbQueue = function (sThumbSessionUid)
{
	this.thumbnailSessionUid(sThumbSessionUid);
	if(this.sThumbUrl !== '' && (!this.linked || this.linked && !this.linked()))
	{
		FilesUtils.thumbQueue(this.thumbnailSessionUid(), this.sThumbUrl, this.thumbnailSrc);
	}
};

/**
 * Starts downloading attachment on click.
 */
CAbstractFileModel.prototype.downloadFile = function ()
{
	//todo: UrlUtils.downloadByUrl in nessesary context in new window
	var 
		sDownloadLink = this.getActionUrl('download'),
		bBreakDownload = false,
		fRegularDownloadFileCallback = function (sDownloadLink) {
			if (sDownloadLink.length > 0 && sDownloadLink !== '#')
			{
				UrlUtils.downloadByUrl(sDownloadLink);
			}
		}
	;

	bBreakDownload = App.broadcastEvent('AbstractFileModel::FileDownload::before', {oFile: this, fRegularDownloadFileCallback: fRegularDownloadFileCallback});

	if (sDownloadLink.length > 0 && sDownloadLink !== '#' && bBreakDownload === false)
	{
		UrlUtils.downloadByUrl(sDownloadLink);
	}
};

/**
 * Can be overridden.
 * Starts viewing attachment on click.
 * @param {Object} oViewModel
 * @param {Object} oEvent
 */
CAbstractFileModel.prototype.viewFile = function (oViewModel, oEvent)
{
	Utils.calmEvent(oEvent);
	this.viewCommonFile();
};

/**
 * Starts viewing attachment on click.
 * @param {string=} sUrl
 */
CAbstractFileModel.prototype.viewCommonFile = function (sUrl)
{
	var
		oWin = null,
		sViewLink = this.getActionUrl('view')
	;
	
	if (!Types.isNonEmptyString(sUrl))
	{
		sUrl = UrlUtils.getAppPath() + sViewLink;
	}

	if (sViewLink.length > 0 && sViewLink !== '#')
	{
		if (this.iframedView())
		{
			oWin = WindowOpener.openTab(sUrl);
		}
		else
		{
			oWin = WindowOpener.open(sUrl, sUrl, false);
		}

		if (oWin)
		{
			oWin.focus();
		}
	}
};

/**
 * @param {Object} oAttachment
 * @param {*} oEvent
 * @return {boolean}
 */
CAbstractFileModel.prototype.eventDragStart = function (oAttachment, oEvent)
{
	var oLocalEvent = oEvent.originalEvent || oEvent;
	if (oAttachment && oLocalEvent && oLocalEvent.dataTransfer && oLocalEvent.dataTransfer.setData)
	{
		oLocalEvent.dataTransfer.setData('DownloadURL', this.generateTransferDownloadUrl());
	}

	return true;
};

/**
 * @return {string}
 */
CAbstractFileModel.prototype.generateTransferDownloadUrl = function ()
{
	var sLink = this.getActionUrl('download');
	if ('http' !== sLink.substr(0, 4))
	{
		sLink = UrlUtils.getAppPath() + sLink;
	}

	return this.mimeType() + ':' + this.fileName() + ':' + sLink;
};

/**
 * Fills attachment data for upload.
 *
 * @param {string} sFileUid
 * @param {Object} oFileData
 * @param {bool} bOnlyUploadStatus
 */
CAbstractFileModel.prototype.onUploadSelect = function (sFileUid, oFileData, bOnlyUploadStatus)
{
	if (!bOnlyUploadStatus)
	{
		this.fileName(Types.pString(oFileData['FileName']));
		this.mimeType(Types.pString(oFileData['Type']));
		this.size(Types.pInt(oFileData['Size']));
	}
	
	this.uploadUid(sFileUid);
	this.uploaded(false);
	this.statusText('');
	this.progressPercent(0);
	this.visibleProgress(false);
};

/**
 * Starts progress.
 */
CAbstractFileModel.prototype.onUploadStart = function ()
{
	this.visibleProgress(true);
};

/**
 * Fills progress upload data.
 *
 * @param {number} iUploadedSize
 * @param {number} iTotalSize
 */
CAbstractFileModel.prototype.onUploadProgress = function (iUploadedSize, iTotalSize)
{
	if (iTotalSize > 0)
	{
		this.progressPercent(Math.ceil(iUploadedSize / iTotalSize * 100));
		this.visibleProgress(true);
	}
};

/**
 * Fills data when upload has completed.
 *
 * @param {string} sFileUid
 * @param {boolean} bResponseReceived
 * @param {Object} oResult
 */
CAbstractFileModel.prototype.onUploadComplete = function (sFileUid, bResponseReceived, oResult)
{
	var
		bError = !bResponseReceived || !oResult || !!oResult.ErrorCode || false,
		sError = (oResult && oResult.Error === 'size') ?
			TextUtils.i18n('%MODULENAME%/ERROR_UPLOAD_SIZE') :
			TextUtils.i18n('%MODULENAME%/ERROR_UPLOAD_UNKNOWN')
	;
	
	this.progressPercent(0);
	this.visibleProgress(false);
	
	this.uploaded(true);
	this.uploadError(bError);
	this.statusText(bError ? sError : TextUtils.i18n('%MODULENAME%/REPORT_UPLOAD_COMPLETE'));

	if (!bError)
	{
		this.fillDataAfterUploadComplete(oResult, sFileUid);
		
		setTimeout((function (self) {
			return function () {
				self.statusText('');
			};
		})(this), 3000);
	}
};

/**
 * Should be overriden.
 * 
 * @param {Object} oResult
 * @param {string} sFileUid
 */
CAbstractFileModel.prototype.fillDataAfterUploadComplete = function (oResult, sFileUid)
{
};

/**
 * @param {Object} oAttachmentModel
 * @param {Object} oEvent
 */
CAbstractFileModel.prototype.onImageLoad = function (oAttachmentModel, oEvent)
{
	if(this.sThumbUrl !== '' && !this.thumbnailLoaded())
	{
		this.thumbnailLoaded(true);
		FilesUtils.thumbQueue(this.thumbnailSessionUid());
	}
};

module.exports = CAbstractFileModel;
