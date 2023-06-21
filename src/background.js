// This is run in the backgrond

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
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
      lookupOverdriveURL(message.libraryLink, message.libraryName, message.elementID, sender.tab.id);
      break;
  }
});

// when installed for the first time, show the options page first
chrome.runtime.onInstalled.addListener(
  function(details) {
    if (details.reason == "install") {
      var optionsURL = "src/options/index.html";

      chrome.tabs.create({
        url: optionsURL
      });
    }
  }
);

async function lookupOverdriveURL(libraryLink, libraryName, elementID, tabId) {
  fetch(libraryLink).then(function(response) {
    var url = response.url.replace("https://", "").replace("/", "");
    chrome.tabs.sendMessage(tabId, {
      type: 'FROM_AG_EXTENSION',
      libraryName: libraryName,
      libraryLink: url,
      elementID: elementID
    });
  })
  .catch(function() {
    chrome.tabs.sendMessage(tabId, {
      type: 'FROM_AG_EXTENSION',
      libraryName: "ERROR",
      libraryLink: "",
      elementID: elementID
    });
  });
}

function searchOverdrive(requestInfo) {
  // load strings for different libraries
  chrome.storage.sync.get("libraries", async function(obj) {
    var libraries = obj["libraries"];

    for (var libraryIndex in libraries) {
      var library = libraries[libraryIndex];
      // just get the library short name from the domain
      var libraryShortName = library.url.replace(/\..*/, '');
      // if only checking one library, don't show the name in the results
      var libraryStr = "";
      if (Object.keys(libraries).length != 1) {
        libraryStr = libraryShortName + ": ";
      }

      // create the search url
      var searchUrl = "";
      var searchTerm = requestInfo.title + " " + requestInfo.author;
      if (library.newDesign) {
         searchUrl = "http://" + library.url + "/search/title?query=" +
          encodeURIComponent(requestInfo.title) + "&creator=" +
          encodeURIComponent(requestInfo.author);
      } else {
         searchUrl = "http://" + library.url + "/BANGSearch.dll?Type=FullText&FullTextField=All&more=1&FullTextCriteria=" + encodeURIComponent(searchTerm);
      }
      const response = await fetch(searchUrl);
      const data = await response.text();
      parseOverdriveResults(data, {
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
        });
    }
  });
}

// parse the Overdrive results page
function parseOverdriveResults(data, requestInfo) {
  var books = [];
  // if not expecting the new Overdrive design but seeing it, then reparse
  if(!requestInfo.newDesign && data.indexOf("footer-desktop") > 0 && data.indexOf("footer-mobile") > 0) {
    chrome.storage.sync.get("libraries", function(obj) {
      var libraries = obj["libraries"];
      var regex = /help.overdrive.com\?Key=(.*?)&/;
      var match = regex.exec(data);
      if (match && match.length > 0) {
        var libraryLink = match[1] + ".overdrive.com";
        libraries[requestInfo.libraryIndex] = {
          url: libraryLink,
          newDesign: true
        };
        chrome.storage.sync.set({
          libraries: libraries
        }, function() {
          searchOverdrive(requestInfo);
        });

      }
    });
    requestInfo.newDesign = true;
    return;
  }

  // if new design
  if (requestInfo.newDesign) {
    var match = /\.mediaItems ?=(.*?});/.exec(data);
    if (match) {
      var bookList = JSON.parse(match[1].trim());
      for (var key in bookList) {
        var book = bookList[key];
        books.push({
          title: book.title,
          author: book.firstCreatorName,
          totalCopies: book.isAvailable ? book.availableCopies : book.ownedCopies,
          holds: book.isAvailable ? null : book.holdsCount,
          isAudio: book.type.id == "audiobook",
          alwaysAvailable: book.availabilityType == "always",
          url: "http://" + requestInfo.libraryShortName + ".overdrive.com/media/" + book.id,
          library: requestInfo.libraryShortName
        });
      }
    }
  } else {
    // if no results found
    if (data.indexOf("No results were found for your search.") < 0) {
      // iterate over each result
      $("div.img-and-info-contain", data).each(function(index, value) {
        // if only a recommendation
        if ($(this).find(".rtl-owned0").length > 0) {
          books.push({});
        } else {
          // get the title
          var title = $(this).find("span.i-hide").filter(function() {
            return $(this).text().indexOf("Options for") >= 0;
          }).text().replace(/^Options for /, "");
          // get stats on the book
          var copies = $(this).attr("data-copiesavail");
          var alwaysAvailable = false;
          if (copies === "available") {
            copies = 1;
          } else if (copies == 'always available') {
            copies = 1;
            alwaysAvailable = true;
          }

          var totalCopies = $(this).attr("data-copiestotal");
          var holds = $(this).attr("data-numwaiting");

          // if the icon is an audiobook, then set the flag accordingly
          var icon = $(this).find("span.tcc-icon-span").attr("data-iconformat");
          var isAudio = false;
          if (icon && icon.indexOf("Audiobook") >= 0) {
            isAudio = true;
          }

          books.push({
            title: title,
            copies: copies,
            totalCopies: totalCopies,
            holds: holds,
            isAudio: isAudio,
            alwaysAvailable: alwaysAvailable,
            url: requestInfo.searchUrl,
            library: requestInfo.libraryShortName
          });
        }
      });
    }
  }

  // send the book results list back to the tab
  chrome.tabs.sendMessage(requestInfo.tabId, {
    type: 'FROM_AG_EXTENSION' + requestInfo.messageId,
    id: requestInfo.messageId,
    libraryShortName: requestInfo.libraryShortName,
    libraryStr: requestInfo.libraryStr,
    searchTerm: requestInfo.searchTerm,
    url: requestInfo.searchUrl,
    books: books
  });
}
