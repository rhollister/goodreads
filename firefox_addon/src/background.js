// This is run in the backgrond 

browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.type) {
    case 'FROM_AG_PAGE':
      searchOverdrive({
        messageId: message.id, 
        title: message.title, 
        author: message.author, 
        tabId: sender.tab.id
      });
      break;
    case 'FROM_AGODLIB_PAGE':
      lookupDNSRecord(message.libraryLink, message.libraryName, message.elementID, sender.tab.id);
      break;
  }
});

// when installed for the first time, show the options page first
browser.runtime.onInstalled.addListener(
  function(details) {
    if (details.reason == "install") {
      browser.tabs.create({
        url: "src/options/index.html"
      });
    }
  }
);

function lookupDNSRecord(libraryLink, libraryName, elementID, tabId) {
  $.ajax({
    url: "http://dnstools.fastnext.com/index.php?fDNSLookup=" + libraryLink + "&fDNSServer=&sDNSLookup=A",
    success: parseDNSResults(libraryName, elementID, tabId),
    error: function(request, status, error) {
      if (tabId) {
        browser.tabs.sendMessage(tabId, {
          type: 'FROM_AG_EXTENSION',
          libraryName: "NOTFOUND",
          libraryLink: "NOTFOUND",
          elementID: elementID
        });
      }
    }
  });
}

function searchOverdrive(requestInfo) {
  // load strings for different libraries
  browser.storage.local.get("libraries", function(obj) {
    var libraries = obj["libraries"];

    for (var libraryIndex in libraries) {
      var library = libraries[libraryIndex];
      // just get the library short name from the domain
      var libraryShortName = library.url.replace(/\..*/, '');
      // if only checking one library, don't show the name in the results
	  console.log ("searching library %s", libraryShortName)
      var libraryStr = "";
      if (Object.keys(libraries).length != 1) {
        libraryStr = libraryShortName + ": ";
      }

      // create the search url
      var searchUrl = "";
      var searchTerm = requestInfo.title + " " + requestInfo.author;
      if (library.newDesign) {
         searchUrl = "http://" + library.url + "/search?query=" + encodeURIComponent(searchTerm);
      } else {
         searchUrl = "http://" + library.url + "/BANGSearch.dll?Type=FullText&FullTextField=All&more=1&FullTextCriteria=" + encodeURIComponent(searchTerm);
      }
      $.ajax({
        url: searchUrl,
        success: parseOverdriveResults({
          title: requestInfo.title,
          author: requestInfo.author,
          messageId: requestInfo.messageId,
          tabId: requestInfo.tabId,
          libraryShortName: libraryShortName,
          libraryStr: libraryStr,
          libraryIndex: libraryIndex,
          newDesign: library.newDesign,
          searchTerm: searchTerm,
          searchUrl: searchUrl
        }),
        error: function(request, status, error) {
          if (requestInfo.tabId) {
            console.log("Available Goodreads Error!", request, status, error)
            browser.tabs.sendMessage(requestInfo.tabId, {
              type: 'FROM_AG_EXTENSION' + requestInfo.messageId,
              error: error
            });
          }
        },
        xhr: function() {
          return jQuery.ajaxSettings.xhr();
        }
      });
    }
  });
}

function Book (title, copies, total, waiting, isaudio, url, library) {
  this.title = title;
  this.copies = copies;
  this.total = total;
  this.waiting = waiting;
  this.isaudio = isaudio;
  this.url = url;
  this.library = library;
}

// parse the Overdrive results page
function parseOverdriveResults(requestInfo) {
  console.log ("Overdrive")
  return function(data, textStatus, jqXHR) {
    var books = [];
	console.log ("Analyzing data")
    // if not expecting the new Overdrive design but seeing it, then reparse
    if(!requestInfo.newDesign && data.indexOf("footer-desktop") > 0 && data.indexOf("footer-mobile") > 0) {
      browser.storage.local.get("libraries", function(obj) {
        var libraries = obj["libraries"];
        var regex = /help.overdrive.com\?Key=(.*?)&/;
        var u = regex.exec(data);
        if (u && u.length > 0) {
          var libraryLink = u[1] + ".overdrive.com";
		  console.log ("Link: %s", libraryLink)
          libraries[requestInfo.libraryIndex] = {
            url: libraryLink,
            newDesign: true
          };
          browser.storage.local.set({
            libraries: libraries
          }, function() {
            searchOverdrive(requestInfo);
          });

        }
      });
      requestInfo.newDesign = true;
      return;
    }

    if (requestInfo.newDesign) {
      // iterate over each result
	  console.log ("Obtenido dato")
      $("div.title-contents.card", data).each(function(index, value) {
          // get the title
          var title = $(this).find(".title-name").text().trim();
          var author = $(this).find(".title-author").text().trim();
          if (author) {
            if (!author.startsWith("by ")) {
              title += "by ";
            }
            title += " " + author;
          }
          var status = $(this).find(".primary-action").text();

          var copies = -1;
          var total = -1;
          var waiting = -1;
          var copiesElement = $(this).find("p.copies-available");
          if (copiesElement && copiesElement.length > 0) {
            if (copiesElement.text().indexOf("Always") > -1) {
              copies = "always available";
            } else {
              var regex = /(\d+)\s*of\s*(\d+)/;
              var u = regex.exec(copiesElement.text());
              if (u && u.length > 1) {
                total = u[2];
                copies = u[1];
              }

              var waitingElement = $(this).find("p.people-waiting");
              waiting = 0;
              var regex = /(\d+)\s*people/;
              var u = regex.exec(waitingElement.text());
              if (u && u.length > 1) {
                waiting = u[1];
              }
            }
          } else {
            if (status.indexOf("HOLD") > -1) {
              waiting = "holds";
            } else if (status.indexOf("BORROW") > -1) {
              copies = "available";
            }
          }

          // if the icon is an audiobook, then set the flag accordingly
          var icon = $(this).find(".title-format-badge").text();
          var isaudio = false;
          if (icon && icon.indexOf("Audiobook") >= 0) {
            isaudio = true;
          }

          books.push(new Book(title, copies, total, waiting, isaudio, requestInfo.searchUrl, requestInfo.libraryShortName));
      });
    } else {
      // if no results found
      if (data.indexOf("No results were found for your search.") > 0) {console.log ("No hay libro")} 
      else { // if results found
        // iterate over each result
        $("div.img-and-info-contain", data).each(function(index, value) {
          // if only a recommendation
          if ($(this).find(".rtl-owned0").size() > 0) {
            books.push(new Book(null, -999, -999, -999, false, false, null, null));
          } else {
            // get the title
            var title = $(this).find("span.i-hide").filter(function() {
              return $(this).text().indexOf("Options for") >= 0;
            }).text().replace(/^Options for /, "");
            // get stats on the book
            var copies = $(this).attr("data-copiesavail");
            var total = $(this).attr("data-copiestotal");
            var waiting = $(this).attr("data-numwaiting");

            // if the icon is an audiobook, then set the flag accordingly
            var icon = $(this).find("span.tcc-icon-span").attr("data-iconformat");
            var isaudio = false;
            if (icon && icon.indexOf("Audiobook") >= 0) {
              isaudio = true;
            }

            // add this book to the list to return
            books.push(new Book(title, copies, total, waiting, isaudio, requestInfo.searchUrl, requestInfo.libraryShortName));
          }
        });
      }
    }

    // send the book results list back to the tab
    browser.tabs.sendMessage(requestInfo.tabId, {
      type: 'FROM_AG_EXTENSION' + requestInfo.messageId,
      id: requestInfo.messageId,
      libraryShortName: requestInfo.libraryShortName,
      libraryStr: requestInfo.libraryStr,
      searchTerm: requestInfo.searchTerm,
      url: requestInfo.searchUrl,
      books: books
    });
  }
}

// parse the DNS results page
function parseDNSResults(libraryName, elementID, tabid) {
  return function(data, textStatus, jqXHR) {
    var libraryLink = "NOTFOUND";
    if (elementID) {
      var match = data.match(/>([^>]+?.lib.overdrive.com)/);
      if (match) {
        libraryLink = match[1];
      } else {
        libraryName = "NOTFOUND";
      }
      // send the dns results list back to the tab
      if (tabid) {
        browser.tabs.sendMessage(tabid, {
          type: 'FROM_AG_EXTENSION',
          libraryName: libraryName,
          libraryLink: libraryLink,
          elementID: elementID
        });
      }
     return libraryLink;
    } else {
      // TODO: handle error
    }
  }
}
