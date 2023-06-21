// This script is run when visiting the Overdrive search libraries page
var textUpdateCheckInterval = null;
var mapUpdateCheckInterval = null;

// save the selected OverDrive library to Chrome settings
function addLibrary(libraryName, libraryLink) {
	chrome.storage.sync.get("libraries", function(obj) {
		var libraries = obj["libraries"]
		if (!libraries) {
			libraries = {}
			chrome.storage.sync.set({
				libraries: libraries
			});
		}

		libraries[libraryName] = {url:libraryLink, newDesign:true};
		libraries = chrome.storage.sync.set({
			libraries: libraries
		}, null);
	});
}

// set the AG link text to either Add or Remove Library
function setLinkText(libraryResultElement) {
	return function(obj) {
		var libraries = obj["libraries"];
		var libraryNameElement = libraryResultElement.parentElement.querySelector(".AGtitle");
		if (!libraryNameElement) {
			libraryNameElement = libraryResultElement.closest(".library-system").querySelector(".AGtitle");
		}
		libraryName = libraryNameElement.textContent.replace(/[^ -~]+/g, "").replace(/^\s+|\s+$/g, '');
		if (libraries[libraryName]) {
			libraryResultElement.innerHTML = "Remove <b>" + libraryName + "</b> from Available Reads<br>";
		} else if (!libraryResultElement.textContent.startsWith("Looking up URL")) {
			libraryResultElement.innerHTML = "Add this library to Available Reads";
		}
	}
}

// check each of the AG links for updating
function updateLinkText() {
	document.querySelectorAll("a.AGselect").forEach((element) => {
		var libraryResultElement = element;
		if (libraryResultElement) {
			chrome.storage.sync.get("libraries",
				setLinkText(libraryResultElement));
		}
	});
}

// find the .lib.overdrive.com URL for the library
function setOverdriveURL(libraryResultElement, libraryName, websiteSelector, scrollX, scrollY) {
	return function(obj) {
		var libraries = obj["libraries"];
		// if the library was already added, then remove it
		if (libraries[libraryName]) {
			delete libraries[libraryName];
			libraries = chrome.storage.sync.set({
				libraries: libraries
			});
			libraryResultElement.innerHTML = "Add this library to Available Reads";
		} else { // else add the library
			// if the library link points to overdrive, then simply add it
			var websiteLinkTag = libraryResultElement.parentElement.parentElement.querySelector(websiteSelector);
			var libraryLink = websiteLinkTag.getAttribute("href");
			var elementID = "AGloading" + Math.floor(Math.random() * 100000000000000000)
			libraryResultElement.classList.add(elementID);

			chrome.runtime.sendMessage({
				type: "FROM_AGODLIB_PAGE",
				libraryName: libraryName,
				libraryLink: libraryLink,
				elementID: elementID
			});
		}
		window.scrollTo(scrollX, scrollY);
	}
}

// when an AG link is clicked
function onLibraryClick(libraryResultElement, libraryName, websiteSelector) {
	return function(event) {
		event.stopPropagation();
		chrome.storage.sync.get("libraries",
			setOverdriveURL(libraryResultElement, libraryName, websiteSelector, window.scrollX, window.scrollY));
		return false;
	}
}

// add an AG link to a library result or map pin
function insertAddLink(libraryResultSelector, libraryNameSelector, websiteSelector, parentSelector) {
	// for each library result element
	document.querySelectorAll(libraryResultSelector + ":not(.AGadded)").forEach((element) => {
		var libraryResultElement = element;
		libraryResultElement.classList.add('AGadded');
		// add the place holder
		libraryResultElement.insertAdjacentHTML("afterend", '<a href="#" class="AGadded library-label__save AGselect" style="background-color: #a39173;">Add this library to Available Reads</a><br><br><br>');
		
		var libraryNameElement = libraryResultElement.closest(parentSelector).querySelector(libraryNameSelector);
		libraryNameElement.classList.add('AGtitle');

		var libraryName = libraryNameElement.textContent.replace(/[^ -~]+/g, "").replace(/^\s+|\s+$/g, '');

		// add a handler for click on the AG link
		var libraryElement = libraryResultElement.parentElement.querySelector('a.AGselect');
		libraryElement.addEventListener("click", onLibraryClick(libraryElement, libraryName, websiteSelector));

		updateLinkText();
	});
}


window.addEventListener("load", (event) => {
	// if document has been loaded, inject CSS styles
	document.getElementsByTagName('body')[0].insertAdjacentHTML("beforebegin", "\
					<style>\
						a.AGselect { \
						background-image: url('" + chrome.runtime.getURL('icons/icon48.png') + "');\
						background-size:30px;\
						background-repeat: no-repeat;\
						background-position: 10px center;\
						padding-left:40px !important;\
						display: block;\
						float:left;\
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
		// check the elements in the search result list
		insertAddLink(".library-name", ".library-system__title", ".libray-links a", ".library-system");
		// check for a map pin element
		insertAddLink("a.library-label__save", "h3.library-label__title", "a.library-label__save:not(.AGselect)", ".library-label");
	}, 200);
});

// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	var libraryResultElement = document.querySelector("." + message.elementID);
	if (libraryResultElement) {
		libraryResultElement.classList.remove(message.elementID);
		libraryResultElement.style["background-image"] = "url('" + chrome.runtime.getURL('icons/icon48.png') + "')";
		if (message.libraryName == "ERROR") {
			libraryResultElement.innerHTML = "Error adding this library to Available Reads<br>";
			alert("Error: A \".overdrive.com\" URL could not be found for this library. Please read the Available Reads options page on how to manually add the URL.");
		} else {
			addLibrary(message.libraryName, message.libraryLink);
			libraryResultElement.innerHTML = "Remove <b>" + message.libraryName + "</b> from Available Reads<br>";
		}
	}
});
