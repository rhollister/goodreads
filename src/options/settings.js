window.addEvent("domready", function() {
	new FancySettings.initWithManifest(function(settings) {
		// check for a valid url
		if (settings.manifest.libraryurl.element.value.indexOf('lib.overdrive.com') < 0) {
			settings.manifest.librarydomains.element.value = "Error: Invalid Overdrive URL."
			settings.manifest.librarydomains.element.style.color = "red"
			settings.manifest.libraryurl.label.style.color = "red"
		}
		settings.manifest.librarydomains.element.disabled = true
		settings.manifest.librarydomains.element.style.color = "gray"

		// add listener to check for valid url
		settings.manifest.libraryurl.addEvent('action', function() {
			libraryDomains = []
			libraryStr = settings.manifest.libraryurl.element.value;
			libraries = libraryStr.replace(/^\s+|\s+$/g, '').split(" ")
			invalid = false
			for (i = 0; i < libraries.length; i++) {
				library = libraries[i]
				if (library.length > 0) {
					library = library.replace(/^https?:\/\//, '').replace(/overdrive.com.*/, 'overdrive.com')

					if (library.indexOf('lib.overdrive.com') < 0) {
						invalid = true
						if (libraries.length == 1) {
							libraryIndexStr = ""
						} else {
							libraryIndexStr = "#" + (+i + +1) + " "
						}
						settings.manifest.librarydomains.element.value = "Error: Library URL " + libraryIndexStr + "is invalid."
						settings.manifest.librarydomains.element.style.color = "red"
						settings.manifest.libraryurl.label.style.color = "red"
						break
					} else {
						libraryDomains.push(library)
					}
				}
			}
			if (!invalid) {
				settings.manifest.libraryurl.label.style.color = "black"
				settings.manifest.librarydomains.element.style.color = "gray"
				new Store("settings").set("librarydomains", libraryDomains)
				settings.manifest.librarydomains.element.value = libraryDomains.join(", ")
			}

		});
	});

});