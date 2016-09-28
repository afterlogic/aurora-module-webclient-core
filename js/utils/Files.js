'use strict';

var
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	
	FilesUtils = {}
;

/**
 * Gets link for download by hash.
 *
 * @param {string} sModuleName Name of module that owns the file.
 * @param {string} sHash Hash of the file.
 * @param {string} sPublicHash Hash of shared folder if the file is displayed by public link.
 * 
 * @return {string}
 */
FilesUtils.getDownloadLink = function (sModuleName, sHash, sPublicHash)
{
	return sHash.length > 0 ? '?/Download/' + sModuleName + '/DownloadFile/' + sHash + '/' + (sPublicHash ? '0/' + sPublicHash : '') : '';
};

/**
 * Gets link for download by hash.
 *
 * @param {string} sModuleName Name of module that owns the file.
 * @param {string} sHash Hash of the file.
 * @param {string} sPublicHash Hash of shared folder if the file is displayed by public link.
 * 
 * @return {string}
 */
FilesUtils.getViewLink = function (sModuleName, sHash, sPublicHash)
{
	return sHash.length > 0 ? '?/Download/' + sModuleName + '/ViewFile/' + sHash + '/' + (sPublicHash ? '0/' + sPublicHash : '') : '';
};

/**
 * Gets link for view by hash in iframe.
 *
 * @param {number} iAccountId
 * @param {string} sUrl
 *
 * @return {string}
 */
FilesUtils.getIframeWrappwer = function (iAccountId, sUrl)
{
	return '?/Raw/Iframe/' + iAccountId + '/' + window.encodeURIComponent(sUrl) + '/';
};

/**
 * Gets link for thumbnail by hash.
 *
 * @param {string} sModuleName Name of module that owns the file.
 * @param {string} sHash Hash of the file.
 * @param {string} sPublicHash Hash of shared folder if the file is displayed by public link.
 *
 * @return {string}
 */
FilesUtils.getThumbnailLink = function (sModuleName, sHash, sPublicHash)
{
	return sHash.length > 0 ? '?/Download/' + sModuleName + '/GetFileThumbnail/' + sHash + '/' + (sPublicHash ? '0/' + sPublicHash : '') : '';
};

FilesUtils.thumbQueue = (function () {

	var
		oImages = {},
		oImagesIncrements = {},
		iNumberOfImages = 2
	;

	return function (sSessionUid, sImageSrc, fImageSrcObserver)
	{
		if(sImageSrc && fImageSrcObserver)
		{
			if(!(sSessionUid in oImagesIncrements) || oImagesIncrements[sSessionUid] > 0) //load first images
			{
				if(!(sSessionUid in oImagesIncrements)) //on first image
				{
					oImagesIncrements[sSessionUid] = iNumberOfImages;
					oImages[sSessionUid] = [];
				}
				oImagesIncrements[sSessionUid]--;

				fImageSrcObserver(sImageSrc); //load image
			}
			else //create queue
			{
				oImages[sSessionUid].push({
					imageSrc: sImageSrc,
					imageSrcObserver: fImageSrcObserver,
					messageUid: sSessionUid
				});
			}
		}
		else //load images from queue (fires load event)
		{
			if(oImages[sSessionUid] && oImages[sSessionUid].length)
			{
				oImages[sSessionUid][0].imageSrcObserver(oImages[sSessionUid][0].imageSrc);
				oImages[sSessionUid].shift();
			}
		}
	};
}());

FilesUtils.thumbBase64Queue = (function () {

	var
		Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
		aFiles = [],
		oThumbs = {},
		fGetFileKey = function (oFile) {
			return ['Type', oFile.type(), 'Name', oFile.fileName(), 'Path', oFile.path()].join('-');
		},
		fLoadBase64Thumb = function (oFile) {
			Ajax.send('Files', 'GetFileThumbnail', { Type: oFile.type(), Name: oFile.fileName(), Path: oFile.path() }, function (oResponse) {
				if (oResponse.Result)
				{
					var sThumb = 'data:' + oFile.contentType() + ';base64,' + oResponse.Result;
					oThumbs[fGetFileKey(oFile)] = sThumb;
					oFile.thumbnailSrc(sThumb);
				}
			});
		}
	;
	
	Ajax.registerOnAllRequestsClosedHandler(function () {
		if (aFiles.length > 0)
		{
			var oShiftedFile = aFiles.shift();
			fLoadBase64Thumb(oShiftedFile);
		}
	});

	return function (oFile)
	{
		if (oFile)
		{
			var sThumb = oThumbs[fGetFileKey(oFile)];
			if (sThumb)
			{
				oFile.thumbnailSrc(sThumb);
			}
			else if (Ajax.hasOpenedRequests())
			{
				aFiles.push(oFile);
			}
			else
			{
				fLoadBase64Thumb(oFile);
			}
		}
	};
}());

/**
 * @param {string} sFileName
 * @param {number} iSize
 * @returns {Boolean}
 */
FilesUtils.showErrorIfAttachmentSizeLimit = function (sFileName, iSize)
{
	var
		sWarning = TextUtils.i18n('%MODULENAME%/ERROR_UPLOAD_SIZE_DETAILED', {
			'FILENAME': sFileName,
			'MAXSIZE': TextUtils.getFriendlySize(UserSettings.AttachmentSizeLimit)
		})
	;
	
	if (UserSettings.AttachmentSizeLimit > 0 && iSize > UserSettings.AttachmentSizeLimit)
	{
		Popups.showPopup(AlertPopup, [sWarning]);
		return true;
	}
	
	return false;
};

module.exports = FilesUtils;
