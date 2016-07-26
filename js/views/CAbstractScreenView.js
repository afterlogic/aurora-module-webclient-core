'use strict';

var
	ko = require('knockout'),
	
	App = require('modules/CoreClient/js/App.js')
;

function CAbstractScreenView()
{
	this.shown = ko.observable(false);
	this.$viewDom = null;
	this.browserTitle = ko.observable('');
}

CAbstractScreenView.prototype.ViewTemplate = '';
CAbstractScreenView.prototype.ViewName = '';

CAbstractScreenView.prototype.showView = function ()
{
	if (!this.shown())
	{
		this.$viewDom.show();
		this.shown(true);
		this.onShow();

		if (this.ViewName !== '')
		{
			App.broadcastEvent('%ModuleName%::ShowView::after', {'Name': this.ViewName, 'View': this});
		}
	}
};

CAbstractScreenView.prototype.hideView = function ()
{
	if (this.shown())
	{
		this.$viewDom.hide();
		this.shown(false);
		this.onHide();
	}
};

CAbstractScreenView.prototype.onBind = function ()
{
};

CAbstractScreenView.prototype.onShow = function ()
{
};

CAbstractScreenView.prototype.onHide = function ()
{
};

CAbstractScreenView.prototype.onRoute = function (aParams)
{
};

module.exports = CAbstractScreenView;