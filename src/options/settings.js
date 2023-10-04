var libraryCheckInterval = null;
var oldLibraries = null;

// load and display newest settings
function loadLibraries() {
	chrome.storage.sync.get("libraries", function(obj) {
		var libraries = {};
		// initialize settings
		if (!obj || !obj["libraries"]) {
			chrome.storage.sync.set({
				libraries: libraries
			});
		} else {
			libraries = obj["libraries"];
		}

		// keep track if the list of libraries has been changed
		var changed = false;
		if (!oldLibraries || Object.keys(libraries).length != Object.keys(oldLibraries).length) {
			changed = true;
		}

		var keys = [];
		var updated = false;
		// convert library data to objects rather than strings
		for (var libraryName in libraries) {
			if (typeof libraries[libraryName] === "string") {
				var libraryUrl = libraries[libraryName];
				$("#urlText").val(libraryUrl);
				libraries[libraryName] = {
					url: libraryUrl,
					newDesign: true
				};
				updated = true;
			}

			if (!changed && libraries[libraryName].url.localeCompare(oldLibraries[libraryName].url) != 0) {
				changed = true;
			}
			keys.push(libraryName);
		}
		if (updated) {
			chrome.storage.sync.set({ libraries: libraries });
		}
		// don't clear and repopulate the listbox if the setting hasn't been changed
		if (changed) {
			oldLibraries = libraries;

			keys.sort();
			$("#libraryList").empty();
			// get the keys and sort the libraries alphabetically
			for (var key in keys) {
				$("#libraryList").append("<option value='" + keys[key] + "'>" + keys[key] + "</option>");
			}

			// if the list selection was lost, disable the delete button
			if ($("#libraryList :selected").length > 0) {
				$("#deleteButton").prop('disabled', false);
			} else {
				$("#deleteButton").prop('disabled', true);
			}
			// if there are libraries in the list, show the success message
			if (Object.keys(libraries).length > 0) {
				$("#libraryLabel").css("color", "black");
				$("#successText").show();
			}
		}
	});
}

function validateInput() {
	var invalid = false;
	// validate the url
	var library = $("#urlText").val()
	if (library.length > 0) {
		library = library.replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com').replace(/libraryreserve.com.*/, 'libraryreserve.com');
		var newDesign = !$("#newDesign").prop("checked");
		if (!newDesign && library.indexOf('.overdrive.com') < 1) {
			$("#errorText").css('display', 'inline');
			$("#urlLabel").css("color", "#d00");
			invalid = true;
		} else {
			$("#urlLabel").css("color", "black");
			$("#errorText").hide();
		}
	} else {
		$("#urlLabel").css("color", "#d00");
		invalid = true;
	}
	// validate the name
	if ($("#nameText").val().length == 0) {
		$("#nameLabel").css("color", "#d00");
		invalid = true;
	} else {
		$("#nameLabel").css("color", "black");
	}

	if (invalid) {
		$("#saveButton").prop('disabled', true);
	} else {
		$("label").css("color", "black");
		$("#saveButton").prop('disabled', false);
	}
}

function updateHeaderText(showFormat) {
	var headerText = "Libby";
	if (showFormat.linkToOverdriveResults) {
		headerText = "Overdrive";
	}
	document.querySelector("#headerText1").textContent = headerText;
	document.querySelector("#headerText2").textContent = headerText.toLowerCase();
}

function updateShowOnPagesOptions() {
	chrome.storage.sync.get("showOnPages", function(obj) {
		var showOnPages = obj["showOnPages"];
		if (!showOnPages) {
			showOnPages = {
				descriptionPage: true,
				shelfPage: true,
				listPage: false
			};
			chrome.storage.sync.set({
				showOnPages: showOnPages
			}, null);
		}
		$("input.showRadio").each(function(index, value) {
			if (showOnPages[$(this).val()]) {
				$(this).prop('checked', true);
			} else {
				$(this).prop('checked', false);
			}
		});
	});
}

function updateShowFormatOptions() {
	chrome.storage.sync.get("showFormat", function(obj) {
		showFormat = obj["showFormat"];
		if (!showFormat || Object.keys(showFormat).length === 0) {
			showFormat = {
				limitResultCount: 5,
				linkToOverdriveResults: false,
				audioBook: true,
				eBook: true,
				optionalBookTitle: false,
				hideNotFoundIfOtherResults: false,
				oneLine: false,
				hideLibrary: false,
				hideTitleAndAuthor: false
			};
			chrome.storage.sync.set({
				showFormat: showFormat
			}, null);
		}
		$("input.showFormat").each(function(index, value) {
			if (showFormat[$(this).val()]) {
				$(this).prop('checked', true);
			} else {
				$(this).prop('checked', false);
			}
		});

		document.getElementById("limitResultCount").value = showFormat.limitResultCount;

		updateHeaderText(showFormat);
	});
}

// refresh the settings every second for an update,
//   this is done since the primary way of adding libraries is through another tab
if (!libraryCheckInterval) {
	var libraryCheckInterval = setInterval(function() {
		loadLibraries();
	}, 1000);
}

$("#urlText").on('input', function() {
	validateInput();
});
$("#nameText").on('input', function() {
	validateInput();
});

// when the list selection is changed
$("#libraryList").change(function() {
	if ($("#libraryList :selected").length > 0) {
		$("#deleteButton").prop('disabled', false);
	} else {
		$("#deleteButton").prop('disabled', true);

	}
});

// when the show settings are changed
$("input.showRadio").change(function() {
	var showOnPages = {};
	$("input.showRadio").each(function(index, value) {
		showOnPages[$(this).val()] = $(this).is(':checked');
	});
	$("input.showRadio").prop('disabled', true);
	chrome.storage.sync.set({
		showOnPages: showOnPages
	}, function() {
		$("input.showRadio").prop('disabled', false);
	});
});

function setShowFormatOptions() {
	$("input.showFormat").each(function(index, value) {
		if($(this).attr("type") == "checkbox") {
			showFormat[$(this).val()] = $(this).is(':checked');
		} else if ($(this).attr("type") == "text") {
			showFormat.limitResultCount = $(this).val();
		}
	});
	chrome.storage.sync.set({
		showFormat: showFormat
	}, updateSampleFormats);
	updateHeaderText(showFormat);
}

// when the format settings are changed
$("input.showFormat").change(setShowFormatOptions);

$("#saveButton").click(function() {
	var libraryName = $("#nameText").val().replace(/[^ -~]+/g, "");
	chrome.storage.sync.get("libraries", function(obj) {
		var libraries = obj["libraries"];
		libraryUrl = $("#urlText").val().replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com').replace(/libraryreserve.com.*/, 'libraryreserve.com');
		newDesign = !$("#newDesign").prop("checked");
		libraries[libraryName] = {
			url: libraryUrl,
			newDesign: newDesign
		};
		$("#urlText").val(libraryUrl);
		chrome.storage.sync.set({
			libraries: libraries
		}, function() {
			// when save is complete, refresh the list
			loadLibraries();
		});
	});
});

$("#deleteButton").click(function() {
	var libraryName = $("#nameText").val().replace(/[^ -~]+/g, "");
	chrome.storage.sync.get("libraries", function(obj) {
		var libraries = obj["libraries"];
		delete libraries[libraryName];
		if (Object.keys(libraries).length < 1) {
			$("#libraryLabel").css("color", "#d00");
			$("#successText").hide();
		}
		chrome.storage.sync.set({
			libraries: libraries
		}, function() {
			// when delete is complete refresh the list
			loadLibraries();
		});
	});
});

const fileSelect = document.getElementById("importButton");
const fileElem = document.getElementById("fileInput");

fileSelect.addEventListener(
  "click",
  (e) => {
    if (fileElem) {
      fileElem.click();
    }
  },
  false,
);

fileElem.addEventListener(
	"change",
	(e) => {
	const file = e.target.files[0];

	if (file) {
		const reader = new FileReader();
		reader.onload = function (e) {
			const importedSettings = JSON.parse(e.target.result);
			chrome.storage.sync.set(importedSettings, function() {
				loadLibraries();
				updateShowOnPagesOptions();
				updateShowFormatOptions();
			});
			fileElem.value = "";
		};
		reader.readAsText(file);
	}
});
$("#exportButton").click(function() {
	chrome.storage.sync.get(null, function(obj) {
		const blob = new Blob([JSON.stringify(obj)], {
			type: "application/json",
		});

		const anchor = document.createElement("a");
		anchor.href = window.URL.createObjectURL(blob);
		anchor.download = "availableReadsExport.json";
		anchor.click();
	});
});

// Restricts input for the given textbox to the given inputFilter function.
function setInputFilter(textbox, inputFilter, errMsg) {
	[ "input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop", "focusout" ].forEach(function(event) {
	  textbox.addEventListener(event, function(e) {
		if (inputFilter(this.value)) {
		  // Accepted value.
		  if ([ "keydown", "mousedown", "focusout" ].indexOf(e.type) >= 0){
			this.classList.remove("input-error");
			this.setCustomValidity("");
		  }
  
		  if (this.value != this.oldValue) {
			document.getElementById("sampleSinglePage").innerHTML = createSingleBookPageTable(document.querySelector("#headerText1").textContent, "singleBookPageTable");
			setShowFormatOptions();
		  }

		  this.oldValue = this.value;
		  this.oldSelectionStart = this.selectionStart;
		  this.oldSelectionEnd = this.selectionEnd;
		}
		else if (this.hasOwnProperty("oldValue")) {
		  // Rejected value: restore the previous one.
		  this.classList.add("input-error");
		  this.setCustomValidity(errMsg);
		  this.reportValidity();
		  this.value = this.oldValue;
		  this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
		}
		else {
		  // Rejected value: nothing to restore.
		  this.value = "";
		}
	  });
	});
}

loadLibraries();
// disable all buttons
$("button").prop('disabled', true);
$("#importButton").prop('disabled', false);
$("#exportButton").prop('disabled', false);
$("#errorText").hide();
$("#successText").hide();
// when a library is selected, populate input fields
$("#libraryList").click(function() {
	var libraryName = $("#libraryList option:selected").text().replace(/[^ -~]+/g, "");
	$("#nameText").val(libraryName);
	$("#newDesign").prop('checked', false);
	chrome.storage.sync.get("libraries", function(obj) {
		var libraries = obj["libraries"];
		$("#urlText").val(libraries[libraryName].url);
		$("#newDesign").prop('checked', !libraries[libraryName].newDesign);
		validateInput();
	});
});
updateShowOnPagesOptions();
updateShowFormatOptions();
updateSampleFormats();

setInputFilter(document.getElementById("limitResultCount"), function(value) {
	return /^\d*$/.test(value); 
  }, "Only digits are allowed");


function updateSampleFormats() {
	chrome.storage.sync.get("showFormat", function(obj) {
		var headerText = "Libby";
		var showFormat = obj["showFormat"];

		if (showFormat.linkToOverdriveResults) {
			headerText = "Overdrive";
		}

		document.getElementById("sampleSinglePage").innerHTML = createSingleBookPageTable(headerText, "singleBookPageTable");
		document.getElementById("ARshowMoresingleBookPageTable").style.background = "#d3d3b3";
		const showMoreLink = document.getElementById("ARshowMore" + "singleBookPageTable");
		showMoreLink.addEventListener("click", onClickShowMore("singleBookPageTable"));
		chrome.runtime.sendMessage({
			type: "FROM_SETTINGS_PAGE",
			data: {
				"items": [
					{
						"isAvailable": false,
						"isRecommendableToLibrary": true,
						"isOwned": true,
						"isHoldable": true,
						"type": {
							"name": "eBook",
							"id": "ebook"
						},
						"covers": {
							"cover150Wide": {
								"href": "greatexpectations.jpg"
							}
						},
						"availableCopies": 0,
						"ownedCopies": 3,
						"holdsCount": 7,
						"holdsRatio": 9,
						"estimatedWaitDays": 6,
						"firstCreatorName": "Charles Dickens",
						"title": "Great Expectations",
					},{
						"isAvailable": true,
						"isRecommendableToLibrary": true,
						"isOwned": true,
						"isHoldable": true,
						"type": {
							"name": "eBook",
							"id": "ebook"
						},
						"covers": {
							"cover150Wide": {
								"href": "greatexpectations.jpg"
							}
						},
						"availableCopies": 2,
						"ownedCopies": 3,
						"estimatedWaitDays": 0,
						"firstCreatorName": "Charles Dickens",
						"title": "Great Expectations",
					}
				]
			},
			requestInfo: {
				title: "Great Expectations",
				author: "Charles Dickens",
				messageId: "singleBookPageTable",
				tabId: 0,
				libraryShortName: "nypl",
				libraryStr: "nypl",
				libraryIndex: 0,
				newDesign: true,
				searchTitle: "Great Expectations",
				searchAuthor: "Charles Dickens",
				searchUrls: {overdrive:"#", libby:"#"},
				hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
				showHoldsRatio: showFormat.showHoldsRatio,
				showFormat: showFormat
			}
		});

		chrome.runtime.sendMessage({
			type: "FROM_SETTINGS_PAGE",
			data: {
				"items": [
					{
						"isAvailable": false,
						"isRecommendableToLibrary": true,
						"isOwned": true,
						"isHoldable": true,
						"type": {
							"name": "eBook",
							"id": "ebook"
						},
						"covers": {
							"cover150Wide": {
								"href": "greatexpectations.jpg"
							}
						},
						"availableCopies": 0,
						"ownedCopies": 3,
						"holdsCount": 3,
						"holdsRatio": 9,
						"estimatedWaitDays": 8,
						"firstCreatorName": "Charles Dickens",
						"title": "Great Expectations",
					},{
						"isAvailable": false,
						"isRecommendableToLibrary": true,
						"isOwned": true,
						"isHoldable": true,
						"type": {
							"name": "audiobook",
							"id": "audiobook"
						},
						"covers": {
							"cover150Wide": {
								"href": "greatexpectations.jpg"
							}
						},
						"availableCopies": 0,
						"ownedCopies": 3,
						"holdsCount": 18,
						"holdsRatio": 9,
						"estimatedWaitDays": 14,
						"firstCreatorName": "Charles Dickens",
						"title": "Great Expectations",
					}
				]
			},
			requestInfo: {
				title: "Great Expectations",
				author: "Charles Dickens",
				messageId: "singleBookPageTable",
				tabId: 0,
				libraryShortName: "brooklyn",
				libraryStr: "brooklyn",
				libraryIndex: 0,
				newDesign: true,
				searchTitle: "Great Expectations",
				searchAuthor: "Charles Dickens",
				searchUrls: {overdrive:"#", libby:"#"},
				hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
				showHoldsRatio: showFormat.showHoldsRatio,
				showFormat: showFormat
			}
		});
		
		chrome.runtime.sendMessage({
			type: "FROM_SETTINGS_PAGE",
			data: {
				"items": [
					
				]
			},
			requestInfo: {
				title: "Great Expectations",
				author: "Charles Dickens",
				messageId: "singleBookPageTable",
				tabId: 0,
				libraryShortName: "lapl",
				libraryStr: "lapl",
				libraryIndex: 0,
				newDesign: true,
				searchTitle: "Great Expectations",
				searchAuthor: "Charles Dickens",
				searchUrls: {overdrive:"#", libby:"#"},
				hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
				showHoldsRatio: showFormat.showHoldsRatio,
				showFormat: showFormat
			}
		});
					
		chrome.runtime.sendMessage({
			type: "FROM_SETTINGS_PAGE",
			data: {
				"items": [
					
				]
			},
			requestInfo: {
				title: "Great Expectations",
				author: "Charles Dickens",
				messageId: "singleBookPageTable",
				tabId: 4,
				libraryShortName: "lacounty",
				libraryStr: "lacounty",
				libraryIndex: 0,
				newDesign: true,
				searchTitle: "Great Expectations",
				searchAuthor: "Charles Dickens",
				searchUrls: {overdrive:"#", libby:"#"},
				hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
				showHoldsRatio: showFormat.showHoldsRatio,
				showFormat: showFormat
			}
		});

		chrome.runtime.sendMessage({
			type: "FROM_SETTINGS_PAGE",
			data: {
				"items": [
					
				]
			},
			requestInfo: {
				title: "Great Expectations",
				author: "Charles Dickens",
				messageId: "singleBookPageTable",
				tabId: 4,
				libraryShortName: "chicago",
				libraryStr: "chicago",
				libraryIndex: 0,
				newDesign: true,
				searchTitle: "Great Expectations",
				searchAuthor: "Charles Dickens",
				searchUrls: {overdrive:"#", libby:"#"},
				hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
				showHoldsRatio: showFormat.showHoldsRatio,
				showFormat: showFormat
			}
		});
	});
}