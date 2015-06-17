var libraryCheckInterval = null;
var oldLibraries = null;

// load and display newest settings
function loadLibraries() {
	chrome.storage.sync.get("libraries", function(obj) {
		libraries = obj["libraries"];
		// initialize settings
		if (!libraries) {
			libraries = {};
			chrome.storage.sync.set({
				libraries: libraries
			});
		}

		// keep track if the list of libraries has been changed
		changed = false;
		if (!oldLibraries || Object.keys(libraries).length != Object.keys(oldLibraries).length) {
			changed = true;
		}

		keys = [];
		for (var l in libraries) {
			if (!changed && libraries[l].localeCompare(oldLibraries[l]) != 0) {
				changed = true;
			}
			keys.push(l);
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
	invalid = false;
	// validate the url
	library = $("#urlText").val()
	if (library.length > 0) {
		library = library.replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com');
		if (library.indexOf('.lib.overdrive.com') < 1) {
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

$(document).ready(function() {
	loadLibraries();
	// disable all buttons
	$("button").prop('disabled', true);
	$("#errorText").hide();
	$("#successText").hide();
	// when a library is selected, populate input fields
	$("#libraryList").click(function() {
		libraryName = $("#libraryList option:selected").text().replace(/[^ -~]+/g, "");
		$("#nameText").val(libraryName);
		$("#urlText").prop('disabled', true);
		$("#urlText").val('loading value...');
		chrome.storage.sync.get("libraries", function(obj) {
			libraries = obj["libraries"];
			$("#urlText").val(libraries[libraryName]);
			$("#urlText").prop('disabled', false);
			validateInput();
		});
	});

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

	$("#saveButton").click(function() {
		libraryName = $("#nameText").val().replace(/[^ -~]+/g, "");
		chrome.storage.sync.get("libraries", function(obj) {
			libraries = obj["libraries"];
			libraryUrl = $("#urlText").val().replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com');
			libraries[libraryName] = libraryUrl;
			$("#urlText").val(libraryUrl);
			chrome.storage.sync.set({
				libraries: libraries
			}, function() {
				// when save is complete refresh the list
				loadLibraries();
			});
		});
	});

	$("#deleteButton").click(function() {
		libraryName = $("#nameText").val().replace(/[^ -~]+/g, "");
		chrome.storage.sync.get("libraries", function(obj) {
			libraries = obj["libraries"];
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
});