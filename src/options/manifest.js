this.manifest = {
    "name": "GoodReads Availability",
    "icon": "icon.png",
    "settings": [{
            "group": "Library settings",
            "tab": i18n.get("information"),
            "name": "libraryurl",
            "type": "text",
            "label": i18n.get("libraryurl"),
            "default": "http://spl.lib.overdrive.com/"
        }, {
            "group": "Library settings",
            "tab": i18n.get("information"),
            "name": "librarydomains",
            "type": "text",
            "label": i18n.get("librarydomains"),
            "default": "spl.lib.overdrive.com"
        }, {
            "group": i18n.get("description"),
            "tab": i18n.get("information"),
            "name": "description",
            "type": "description",
            "text": i18n.get("description_text")
        }
    ],
    "alignment": [
        [
            "libraryurl", "librarydomains"
        ]

    ]
};