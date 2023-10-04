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
    case 'FROM_SETTINGS_PAGE':
      message.requestInfo.tabId = sender.tab.id;
      parseOverdriveResults(message.data, message.requestInfo);
      break;
    }
});

// when installed for the first time, show the options page first
chrome.runtime.onInstalled.addListener(
  async function(details) {
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

function createSearchUrls(library, libraryShortName, requestInfo, showFormat) {
  var searchUrls = {};

  var ebookParam = "";
  if (showFormat && showFormat.eBook) {
    ebookParam = "ebook-overdrive,ebook-media-do,ebook-overdrive-provisional";
  }
  var audiobookParam = "";
  if (showFormat && showFormat.audioBook) {
    audiobookParam = "audiobook-overdrive,audiobook-overdrive-provisional";
    if(ebookParam) {
      audiobookParam = "," + audiobookParam;
    }
  }

  searchUrls.overdriveAPI = "https://thunder.api.overdrive.com/v2/libraries/" + libraryShortName + 
    "/media?title=" + encodeURIComponent(requestInfo.title) + 
    "&creator=" + encodeURIComponent(requestInfo.author) + 
    "&format=" + ebookParam + audiobookParam + 
    "&perPage=24&page=1&x-client-id=dewey";

  searchUrls.libby = "https://libbyapp.com/search/" + libraryShortName + 
    "/search/title-" + encodeURIComponent(requestInfo.title) + 
    "/creator-" + encodeURIComponent(requestInfo.author) + "/page-1";

  searchUrls.overdrive = "https://" + libraryShortName + 
  ".overdrive.com/search?title=" + encodeURIComponent(requestInfo.title) + 
    "&creator=" + encodeURIComponent(requestInfo.author);
        
  return searchUrls;
}

function searchOverdrive(requestInfo) {
  // load strings for different libraries
  chrome.storage.sync.get(null, async function(obj) {
    var libraries = obj.libraries;
    var showFormat = obj.showFormat;

      for (var libraryIndex in libraries) {
        var library = libraries[libraryIndex];
        // just get the library short name from the domain
        var libraryShortName = library.url.replace(/\..*/, '');
        // if only checking one library, don't show the name in the results
        var libraryStr = "";
        if (Object.keys(libraries).length != 1) {
          libraryStr = "<br/>" + libraryShortName;
        }

        const searchUrls = createSearchUrls(library, libraryShortName, requestInfo, showFormat);

        const response = await fetch(searchUrls.overdriveAPI);
        const data = await response.json();
        parseOverdriveResults(data, {
            title: requestInfo.title,
            author: requestInfo.author,
            messageId: requestInfo.messageId,
            tabId: requestInfo.tabId,
            libraryShortName: libraryShortName,
            libraryStr: libraryStr,
            libraryIndex: libraryIndex,
            newDesign: library.newDesign,
            searchTitle: requestInfo.title,
            searchAuthor: requestInfo.author,
            searchUrls: searchUrls,
            hideNotFoundIfOtherResults: showFormat.hideNotFoundIfOtherResults,
            showHoldsRatio: showFormat.showHoldsRatio,
            showFormat: showFormat
          });
      }
  });
}

// parse the Libby results page
function parseOverdriveResults(data, requestInfo) {
  var books = [];

  for (const book of data.items) {
    var imgUrl = "";
    if (book.covers && Object.keys(book.covers) && Object.keys(book.covers).length > 0) {
      imgUrl = book.covers[Object.keys(book.covers)[0]].href;
    }
    if (requestInfo.showFormat && !requestInfo.showFormat.eBook && book.type.id == "ebook") {
      continue;
    }
    if (requestInfo.showFormat && !requestInfo.showFormat.audioBook && book.type.id == "audiobook") {
      continue;
    }
    books.push({
      title: book.title,
      author: book.firstCreatorName,
      availableCopies: book.availableCopies,
      totalCopies: book.ownedCopies,
      holds: book.isAvailable ? null : book.holdsCount,
      isAudio: book.type.id == "audiobook",
      alwaysAvailable: book.availabilityType == "always",
      overdriveUrl: "http://" + requestInfo.libraryShortName + ".overdrive.com/media/" + book.id,
      searchUrls: requestInfo.searchUrls,
      libbyResultUrl: "https://libbyapp.com/library/" + requestInfo.libraryShortName + "/spotlight-random/page-1/" + book.id,
      overdriveResultUrl: "https://" + requestInfo.libraryShortName + ".overdrive.com/media/" + book.id,
      estimatedWaitDays: book.estimatedWaitDays,
      imgUrl: imgUrl,
      isRecommendableToLibrary: book.isRecommendableToLibrary
    });
  }

  // send the book results list back to the tab
  chrome.tabs.sendMessage(requestInfo.tabId, {
    type: 'FROM_AG_EXTENSION' + requestInfo.messageId,
    id: requestInfo.messageId,
    libraryShortName: requestInfo.libraryShortName,
    libraryStr: requestInfo.libraryStr,
    searchTitle: requestInfo.searchTitle,
    searchAuthor: requestInfo.searchAuthor,
    searchUrls: requestInfo.searchUrls,
    books: books,
    hideNotFoundIfOtherResults: requestInfo.hideNotFoundIfOtherResults,
    showHoldsRatio: requestInfo.showHoldsRatio
  });
}
