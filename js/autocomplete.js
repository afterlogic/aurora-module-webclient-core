var jQuery = require('jquery');
require("jquery-ui/ui/widgets/autocomplete");

(function ($) {

/**
 * extend jQuery autocomplete
 */

	// styling results
	$.ui.autocomplete.prototype._renderItem = function (ul, item) {
		item.label = item.label.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
		var
			liClass = item.disabled ? ' class="disabled"' : '',
			keyEl = item.hasKey ? '<span class="key"></span>' : '',
			delEl = item.team || item.disabled ? '' : '<span class="del"></span>'
		;
		return $('<li' + liClass + '>')
			.append('<a>' + item.label + keyEl + delEl + '</a>')
			.appendTo(ul);
	};

	// add categories
	$.ui.autocomplete.prototype._renderMenu = function(ul, items) {
		
		var
			self = this,
			currentCategory = ''
		;

		$.each(items, function(index, item) {
			
			if (item && item.category && item.category !== currentCategory)
			{
				currentCategory = item.category;
				ul.append('<li class="ui-autocomplete-category">' + item.category + '</li>');
			}

			self._renderItemData(ul, item);
		});
	};

	// Prevent blur then you reach last/first element in list of suggestions
	$.ui.autocomplete.prototype._move = function(direction, event) {

		if ( !this.menu.element.is( ":visible" ) ) {
			this.search( null, event );
			return;
		}
		if ( this.menu.isFirstItem() && /^previous/.test( direction ))
		{
			this._value( this.term );
			this.menu._move( "first", "first", event );
		}
		else if ( this.menu.isLastItem() && /^next/.test( direction ))
		{
			this._value( this.term );
			this.menu._move( "last", "last", event );
		}

		this.menu[ direction ]( event );
	};
})(jQuery);

module.exports = {};
