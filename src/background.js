// This is run in the backgrond 

// default settings
var settings = new Store("settings", {
  "librarydomains": ['spl.lib.overdrive.com']
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.type) {
    case 'FROM_GROD_PAGE':
      // load strings for different libraries
      libraries = settings.get('librarydomains')
      for (i = 0; i < libraries.length; i++) {
        // just get the library name
        library = libraries[i].replace(/\..*/, '');
        // create a library name to display
        if (libraries.length == 1) {
          libraryStr = ""
        } else {
          libraryStr = library + ": "
        }
        // create search url
        url = "http://" + libraries[i] + "/BANGSearch.dll?Type=FullText&FullTextField=All&FullTextCriteria=" + message.title + "%20" + message.author
        $.ajax({
          url: url,
          success: parseODResults(message.id, library, libraryStr, url, sender.tab.id),
          error: function(request, status, error) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'FROM_GROD_EXTENSION' + message.id,
              error: error
            });
          }
        });
      }
      break;
    default:
      chrome.pageAction.show(sender.tab.id);
      sendResponse(settings.toObject());
  }
});

// when installed for the first time, show the options page first
chrome.runtime.onInstalled.addListener(
  function(details) {
    if (details.reason == "install") {
      chrome.tabs.create({
        url: "src/options/index.html"
      });
    }
  }
);

var Book = function(title, copies, total, waiting, isaudio, url, library) {
  this.title = title
  this.copies = copies
  this.total = total
  this.waiting = waiting
  this.isaudio = isaudio
  this.url = url
  this.library = library
}

// parse the Overdrive results page
function parseODResults(id, library, libraryStr, url, tabid) {
  return function(data, textStatus, jqXHR) {
    copies = -1
    total = -1
    waiting = -1
    isaudio = false
    books = [];
    // if no results found
    if (data.indexOf("No results were found for your search.") > 0) {

    } else { // if results found
      // iterate over each result
      $("div.img-and-info-contain", data).each(function(index, value) {
        // get the title
        title = $(this).find("span.i-hide").filter(function() {
          return $(this).text().indexOf("Options for") >= 0;
        }).text().replace(/^Options for /, "");
        // get stats on the book
        copies = $(this).attr("data-copiesavail")
        total = $(this).attr("data-copiestotal")
        waiting = $(this).attr("data-numwaiting")

        // if the icon is an audiobook, then set flag accordingly
        icon = $(this).find("span.tcc-icon-span").attr("data-iconformat")
        if (icon && icon.indexOf("Audiobook") >= 0) {
          isaudio = true
        } else {
          isaudio = false
        }
        // add this book to the list to return
        books.push(new Book(title, copies, total, waiting, isaudio, url, library));
      })
    }
    // send the book results list back to the tab
    chrome.tabs.sendMessage(tabid, {
      type: 'FROM_GROD_EXTENSION' + id,
      id: id,
      library: library,
      libraryStr: libraryStr,
      url: url,
      books: books
    });
  }
}