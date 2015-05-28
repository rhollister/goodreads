window.addEvent("domready", function() {
	new FancySettings.initWithManifest(function(settings) {
		// check for a valid url
		if (settings.manifest.libraryurl.element.value.indexOf('lib.overdrive.com') < 0) {
			settings.manifest.librarydomain.element.value = "Error: Invalid Overdrive URL."
			settings.manifest.librarydomain.element.style.color = "red"
			settings.manifest.libraryurl.label.style.color = "red"
		}
		settings.manifest.librarydomain.element.disabled = true
		settings.manifest.librarydomain.element.style.color = "gray"

		// add listener to check for valid url
		settings.manifest.libraryurl.addEvent('action', function() {
			library = settings.manifest.libraryurl.element.value;
			library = library.replace(/^\s+|\s+$/g, '').replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com')
			if (library.indexOf('lib.overdrive.com') < 0) {
				settings.manifest.librarydomain.element.value = "Error: Invalid Overdrive URL."
				settings.manifest.librarydomain.element.style.color = "red"
				settings.manifest.libraryurl.label.style.color = "red"
			} else {
				settings.manifest.libraryurl.label.style.color = "black"
				settings.manifest.librarydomain.element.style.color = "gray"
				new Store("settings").set("librarydomain", library)
				settings.manifest.librarydomain.element.value = library
			}
		});
	});

});