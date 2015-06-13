// This script is run when visiting the Overdrive search libraries page

// save selected OverDrive library
function addLibrary(libraryName, libraryLink) {
	chrome.storage.sync.get("libraries", function(obj) {
		libraries = obj["libraries"]
		if (!libraries) {
			libraries = {}
			chrome.storage.sync.set({
				libraries: libraries
			});
		}

		libraries[libraryName] = libraryLink;
		libraries = chrome.storage.sync.set({
			libraries: libraries
		}, null);
	});
}

// changes text between Add/Remove if library has been added/removed
function updateLinkText() {
	libraryLinkTag = $("a.ODselect");
	if (libraryLinkTag.size() > 0) {
		chrome.storage.sync.get("libraries", function(obj) {
			libraries = obj["libraries"];
			libraryName = $("h3.library-label__title").text().replace(/^\s+|\s+$/g, '');
			if (libraries[libraryName]) {
				libraryLinkTag.text("Remove " + libraryName + " from Available Goodreads");
			} else {
				libraryLinkTag.text("Add this library to Available Goodreads");
			}
		});
	}
}

$(document).ready(function() {
	$("body").prepend("\
					<style>\
						a.ODselect { \
						background-image: url('" + chrome.extension.getURL('icons/icon48.png') + "');\
						background-size:30px;\
						background-repeat: no-repeat;\
						background-position: 10px center;\
						padding-left:35px !important;\
						display: block;\
					}\
				</style>");
	// every second check to update the text if the library has been added/removed elsewhere
	//   this is done in case the user adds/removes a library from another tab
	textUpdateCheckInterval = setInterval(function() {
		updateLinkText();
	}, 1000);

	// rather than add hooks into the map data, map pins, and onclick on map pins, 
	//   just check for the appeance of a map pin window
	mapUpdateCheckInterval = setInterval(function() {
		// check for the tag and add our place holder before it
		libraryLinkTag = $("a.library-label__save:not(.ODadded)")
			.addClass('ODadded')
			.before('<a href="#" class="ODadded library-label__save ODselect" style="background-color: #a39173;");">Add this library to Available Goodreads</a>');
		// if the tag was found
		if (libraryLinkTag.size() > 0) {
			libraryName = $("h3.library-label__title").text().replace(/^\s+|\s+$/g, '');

			chrome.storage.sync.get("libraries", function(obj) {
				libraries = obj["libraries"];
				libraryLinkTag = $("a.ODselect");
				// change text to Remove if already added
				if (libraries[libraryName]) {
					libraryLinkTag.text("Remove " + libraryName + " from Available Goodreads");
				}

				// if our link is clicked
				$("body").on('click', 'a.ODselect', function() {
					libraryLinkTag = $("a.ODselect");
					libraryName = $("h3.library-label__title").text().replace(/^\s+|\s+$/g, '');
					chrome.storage.sync.get("libraries", function(obj) {
						libraries = obj["libraries"];
						// if the library was already added, then remove it
						if (libraries[libraryName]) {
							delete libraries[libraryName];
							libraries = chrome.storage.sync.set({
								libraries: libraries
							}, null);
							libraryLinkTag.text("Add this library to Available Goodreads");
						} else { // else add the library
							// if the library link points to overdrive, then simply add it
							libraryLink = parseUri($("a.library-label__save:not(.ODselect)").attr("href"))["host"];
							if (libraryLink.indexOf('lib.overdrive.com') >= 0) {
								addLibrary(libraryName, libraryLink);
								libraryLinkTag.text("Remove " + libraryName + " from Available Goodreads");
							} else {
								// hardway, go look up the dns record for the link
								$(this).text("Looking up URL for " + libraryName + "...");
								$(this).css("background-image", "url('" + chrome.extension.getURL('icons/throbber.gif') + "')");

								// send a message for the background page to make the request
								chrome.runtime.sendMessage({
									type: "FROM_ODLIB_PAGE",
									libraryName,
									libraryLink
								});
							}
						}
					});
					return false;
				});
			});
		}
	}, 200);
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	libraryLinkTag = $("a.ODselect");
	libraryLinkTag.css("background-image", "url('" + chrome.extension.getURL('icons/icon48.png') + "')");
	if (message.libraryName == "NOTFOUND") {
		alert("Error: A \".lib.overdrive.com\" URL could not be found for this library. Please read the Available Goodreads options page on how to manually add the URL.");
		libraryLinkTag.text("Error adding this library to Available Goodreads");
	} else {
		addLibrary(message.libraryName, message.libraryLink);
		libraryLinkTag.text("Remove " + message.libraryName + " from Available Goodreads");
	}
});

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri(str) {
	var o = parseUri.options,
		m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
	q: {
		name: "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};