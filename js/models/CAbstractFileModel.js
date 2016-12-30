'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	FilesUtils = require('%PathToCoreWebclientModule%/js/utils/Files.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	Browser = require('%PathToCoreWebclientModule%/js/Browser.js'),
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
 * @param {string} sModuleName
 */
function CAbstractFileModel(sModuleName)
{
	this.isPopupItem = ko.observable(false);
	
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
	
	this.accountId = ko.observable(App.defaultAccountId ? App.defaultAccountId() : 0);
	this.hash = ko.observable('');
	this.thumb = ko.observable(false);
	this.iframedView = ko.observable(false);

	this.downloadLink = ko.computed(function () {
		return FilesUtils.getDownloadLink(sModuleName, this.hash(), this.sPublicHash);
	}, this);

	this.viewLink = ko.computed(function () {
		var sUrl = FilesUtils.getViewLink(sModuleName, this.hash());
		return this.iframedView() ? FilesUtils.getIframeWrappwer(this.accountId(), sUrl) : sUrl;
	}, this);

	this.thumbnailSrc = ko.observable('');
	this.thumbnailLoaded = ko.observable(false);
	this.thumbnailSessionUid = ko.observable('');

	this.thumbnailLink = ko.computed(function () {
		return sModuleName !== 'Files' ? FilesUtils.getThumbnailLink(sModuleName, this.hash()) : '';
	}, this);

	this.type = ko.observable('');
	this.uploadUid = ko.observable('');
	this.uploaded = ko.observable(false);
	this.uploadError = ko.observable(false);
	this.isViewMimeType = ko.computed(function () {
		return (-1 !== $.inArray(this.type(), aViewMimeTypes)) || this.iframedView();
	}, this);
	this.isMessageType = ko.observable(false);
	this.hasHtmlEmbed = ko.observable(false);

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
	this.allowDownload = ko.observable(true);
	
	this.headerText = ko.observable('');

	this.iconAction = ko.observable('download');
	this.iconTooltip = ko.computed(function () {
		var sTitle = '';
		
		if (this.iconAction() === 'download')
		{
			sTitle = TextUtils.i18n('%MODULENAME%/INFO_CLICK_TO_DOWNLOAD_FILE', {
				'FILENAME': this.fileName(),
				'SIZE': this.friendlySize()
			});
			
			if (this.friendlySize() === '')
			{
				sTitle = sTitle.replace(' ()', '');
			}
		}
		
		return sTitle;
	}, this);
	
	this.cssClasses = ko.computed(function () {
		return this.getCommonClasses().join(' ');
	}, this);
	
	this.leftAction = ko.observable('');
	this.hasLeftAction = ko.computed(function () {
		return this.leftAction() !== '';
	}, this);
	this.leftActionText = ko.observable('');
	
	this.rightAction = ko.observable('download');
	this.hasRightAction = ko.computed(function () {
		return this.rightAction() !== '';
	}, this);
	this.rightActionText = ko.observable(TextUtils.i18n('%MODULENAME%/ACTION_DOWNLOAD_FILE'));
	
	this.actionsSetter = ko.computed(function () {
		this.setCommonActions();
	}, this);
}

/**
 * Can be overridden.
 */
CAbstractFileModel.prototype.dataObjectName = '';

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

CAbstractFileModel.prototype.setCommonActions = function ()
{
	if (this.isVisibleViewLink())
	{
		this.leftAction('view');
		this.leftActionText(TextUtils.i18n('COREWEBCLIENT/ACTION_VIEW_FILE'));
	}
	
	if (Browser.iosDevice)
	{
		this.leftAction('download');
		this.leftActionText(TextUtils.i18n('COREWEBCLIENT/ACTION_VIEW_FILE'));
		this.rightAction('');
		this.rightActionText('');
	}
};

CAbstractFileModel.prototype.doLeftAction = function ()
{
	if (this.leftAction() === 'view')
	{
		this.viewFile();
	}
};

CAbstractFileModel.prototype.doRightAction = function ()
{
	this.doCommonRightAction();
};

CAbstractFileModel.prototype.doCommonRightAction = function ()
{
	switch (this.rightAction())
	{
		case 'download':
			this.downloadFile();
			break;
	}
};

CAbstractFileModel.prototype.doIconAction = function ()
{
	switch (this.iconAction())
	{
		case 'download':
			this.downloadFile();
			break;
	}
};

/**
 * Can be overridden.
 * 
 * @returns {boolean}
 */
CAbstractFileModel.prototype.isVisibleViewLink = function ()
{
	return this.uploaded() && !this.uploadError() && this.isViewMimeType();
};

/**
 * Parses attachment data from server.
 *
 * @param {AjaxAttachmenResponse} oData
 * @param {number} iAccountId
 */
CAbstractFileModel.prototype.parse = function (oData, iAccountId)
{
	if (oData['@Object'] === this.dataObjectName)
	{
		this.fileName(Types.pString(oData.FileName));
		this.tempName(Types.pString(oData.TempName));
		if (this.tempName() === '')
		{
			this.tempName(this.fileName());
		}

		this.type(Types.pString(oData.MimeType));
		this.size(oData.EstimatedSize ? Types.pInt(oData.EstimatedSize) : Types.pInt(oData.SizeInBytes));

		this.thumb(!!oData.Thumb);

		this.hash(Types.pString(oData.Hash));
		this.accountId(iAccountId);
		
		this.iframedView(!!oData.Iframed);

		this.uploadUid(this.hash());
		this.uploaded(true);
		
		if ($.isFunction(this.additionalParse))
		{
			this.additionalParse(oData);
		}
	}
};

CAbstractFileModel.prototype.getInThumbQueue = function (sThumbSessionUid)
{
	this.thumbnailSessionUid(sThumbSessionUid);
	if(this.thumb() && (!this.linked || this.linked && !this.linked()))
	{
		FilesUtils.thumbQueue(this.thumbnailSessionUid(), this.thumbnailLink(), this.thumbnailSrc);
	}
};

/**
 * Starts downloading attachment on click.
 */
CAbstractFileModel.prototype.downloadFile = function ()
{
	//todo: UrlUtils.downloadByUrl in nessesary context in new window
	
	if (this.allowDownload() && this.downloadLink().length > 0 && this.downloadLink() !== '#')
	{
		UrlUtils.downloadByUrl(this.downloadLink());
	}
};

/**
 * Can be overridden.
 * 
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
	var oWin = null;
	
	if (!Types.isNonEmptyString(sUrl))
	{
		sUrl = UrlUtils.getAppPath() + this.viewLink();
	}

	if (this.isVisibleViewLink() && this.viewLink().length > 0 && this.viewLink() !== '#')
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
	var sLink = this.downloadLink();
	if ('http' !== sLink.substr(0, 4))
	{
		sLink = UrlUtils.getAppPath() + sLink;
	}

	return this.type() + ':' + this.fileName() + ':' + sLink;
};

/**
 * Fills attachment data for upload.
 *
 * @param {string} sFileUid
 * @param {Object} oFileData
 */
CAbstractFileModel.prototype.onUploadSelect = function (sFileUid, oFileData)
{
	this.fileName(Types.pString(oFileData['FileName']));
	this.type(Types.pString(oFileData['Type']));
	this.size(Types.pInt(oFileData['Size']));

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
	if(this.thumb() && !this.thumbnailLoaded())
	{
		this.thumbnailLoaded(true);
		FilesUtils.thumbQueue(this.thumbnailSessionUid());
	}
};

module.exports = CAbstractFileModel;
