// This is run in the backgrond 

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.type) {
    case 'FROM_AG_PAGE':
      searchOverdrive({
        id: message.id, 
        title: message.title, 
        author: message.author, 
        sender: sender
      });
      break;
    case 'FROM_AGODLIB_PAGE':
      lookupDNS(message.libraryLink, message.libraryName, message.elementID, sender);
      break;
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

function lookupDNS(libraryLink, libraryName, elementID, sender) {
  $.ajax({
    url: "http://dnstools.fastnext.com/index.php?fDNSLookup=" + libraryLink + "&fDNSServer=&sDNSLookup=A",
    success: parseDNSResults(libraryName, elementID, sender.tab.id),
    error: function(request, status, error) {
      if (sender) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'FROM_AG_EXTENSION',
          libraryName: "NOTFOUND",
          libraryLink: "NOTFOUND",
          elementID: elementID
        });
      }
    }
  });
}

function searchOverdrive(bookSearchTerms) {
  var id = bookSearchTerms.id;
  var title = bookSearchTerms.title;
  var author = bookSearchTerms.author;
  var sender = bookSearchTerms.sender;

  // load strings for different libraries
  chrome.storage.sync.get("libraries", function(obj) {
    var libraries = obj["libraries"];
    for (var l in libraries) {
      var library = libraries[l];
      // just get the library short name from the domain
      var libraryShortName = library.url.replace(/\..*/, '');
      // if only one library, don't show the name in the results
      var libraryStr = "";
      if (Object.keys(libraries).length != 1) {
        libraryStr = libraryShortName + ": ";
      }
      // create the search url
      var searchTerm = title + " " + author;
      var url = "";
      if (library.newDesign) {
         url = "http://" + library.url + "/search?query=" + encodeURIComponent(searchTerm);
      } else {
         url = "http://" + library.url + "/BANGSearch.dll?Type=FullText&FullTextField=All&more=1&FullTextCriteria=" + encodeURIComponent(searchTerm);
      }
      $.ajax({
        url: url,
        success: parseODResults(bookSearchTerms, l, libraryShortName, libraryStr, library.newDesign, searchTerm, url, library.url),
        error: function(request, status, error) {
          if (sender) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'FROM_AG_EXTENSION' + id,
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

var Book = function(title, copies, total, waiting, isaudio, url, library) {
  this.title = title;
  this.copies = copies;
  this.total = total;
  this.waiting = waiting;
  this.isaudio = isaudio;
  this.url = url;
  this.library = library;
}

// parse the Overdrive results page
function parseODResults(bookSearchTerms, library, libraryShortName, libraryStr, newDesign, searchTerm, searchUrl, libraryUrl) {
  return function(data, textStatus, jqXHR) {
    var copies = -1;
    var total = -1;
    var waiting = -1;
    var isaudio = false;
    var books = [];
    var id = bookSearchTerms.id;
    var title = bookSearchTerms.title;
    var author = bookSearchTerms.author;
    var sender = bookSearchTerms.sender;
    var tabId = sender.tab.id;

    if(!newDesign && $("div.footer-desktop", data).length && $("div.footer-mobile", data).length) {
      chrome.storage.sync.get("libraries", function(obj) {
        var libraries = obj["libraries"];
        var regex = /help.overdrive.com\?Key=(.*?)&/;
        var u = regex.exec(data);
        if (u && u.length > 0) {
          var libraryLink = u[1] + ".overdrive.com";
          libraries[library] = {
            url: libraryLink,
            newDesign: true
          };
          chrome.storage.sync.set({
            libraries: libraries
          }, function() {
            searchOverdrive(bookSearchTerms);
          });

        }
      });
      newDesign = true;
      return;
    }
    if (newDesign) {
      // iterate over each result
      $("div.title-contents.card", data).each(function(index, value) {
          // get the title
          var title = $(this).find(".title-name").text().trim();
          var author = $(this).find(".title-author").text().trim();
          if (author) {
            title += " by " + author;
          }
          var status = $(this).find(".primary-action").text();

          var total = -1;
          var waiting = -1;
          var copies = -1;
          var copiesElement = $(this).find("p.copies-available");
          console.log("copiesElement", copiesElement);
          if (copiesElement && copiesElement.length > 0) {
            var regex = /(\d+).*?of.*?(\d+)/;
            var u = regex.exec(copiesElement.text());
            if (u && u.length > 1) {
              total = u[2];
              copies = u[1];
            }
            waiting = 0;
            var waitingElement = $(this).find("a[data-holdscount]");
            if (waitingElement && waitingElement.length > 0) {
              console.log("found waitingElement=",waitingElement);
              waiting = waitingElement.attr("data-holdscount");
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

          books.push(new Book(title, copies, total, waiting, isaudio, searchUrl, libraryShortName));
      });
    } else {
      // if no results found
      if (data.indexOf("No results were found for your search.") > 0) {} 
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
            books.push(new Book(title, copies, total, waiting, isaudio, searchUrl, libraryShortName));
          }
        });
      }
    }
    // send the book results list back to the tab
    chrome.tabs.sendMessage(tabId, {
      type: 'FROM_AG_EXTENSION' + id,
      id: id,
      library: libraryShortName,
      libraryStr: libraryStr,
      searchTerm: searchTerm,
      url: searchUrl,
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
        chrome.tabs.sendMessage(tabid, {
          type: 'FROM_AG_EXTENSION',
          libraryName: libraryName,
          libraryLink: libraryLink,
          elementID: elementID
        });
      }
     return libraryLink;
    } else {

    }
  }
}
