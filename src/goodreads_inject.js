// This script is run when visiting a Goodreads page

var libraryDivPlaceholders = "";
var tableUpdateCheckInterval = null;
var showOnPages = {};
var showFormat = {};
var libraryClassNames = [];
var waitingOnAvailability = false;
var loaded = false;

function sortRowsByStatus() {
	var sortAsc = true;
	if (document.querySelector("#AGsort").classList.contains("AGasc")) {
		sortAsc = true;
	} else if (document.querySelector("#AGsort").classList.contains("AGdesc")) {
		sortAsc = false;
	} else {
		return;
	}

	// initialize the map
	var bookList = [];

	waitingOnAvailability = false;

	var books = document.querySelectorAll("tr.bookalike");
	if (!books || books.length == 0) {
		return;
	}
	document.querySelectorAll("tr.bookalike").forEach((element) => {
		bookList.push(element);
		if (!waitingOnAvailability) {
			for (var l in libraryClassNames) {
				if (element.classList.contains(libraryClassNames[l])) {
					waitingOnAvailability = true;
					break;
				}
			}
		}
	});

	// sort books into lists by their current status
	bookList.sort(function(a, b) {
		x = parseFloat(a.querySelector("div.ARtable").getAttribute("ARsortScore"));
		y = parseFloat(b.querySelector("div.ARtable").getAttribute("ARsortScore"));
		if (x < y) {
			return -1;
		}
		if (x > y) {
			return 1;
		}
		return 0;
	});

	if (sortAsc) {
		bookList.reverse();
	}

	// move the rows in sorted order
	var prevRow = null;
	var table = books[0].parentElement;

	for (var row of bookList) {
		table.removeChild(row);
		table.appendChild(row);

/*		if (!prevRow) {
		} else {
			row.after(prevRow);
		}
		prevRow = row;*/
	}
}

// for title and author remove parentheticals, remove [&|,], and trim whitespace
function cleanTitleForSearch(title) {
	return title.replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/: .*/, '').replace(/[ ]+/, ' ');
}
function cleanAuthorForSearch(author) {
	return author.replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/(?:^|\W)(?:[A-Z]\.)+/g, ' ').replace(/[ ]+/, ' ');
}

function onClickShowMore(id) {
	return function (event) {
		event.preventDefault();

		const table = document.getElementById("AGAVAIL" + id);
		table.classList.remove("ARfade");

		const hiddenRows = table.children;
		for (var row of hiddenRows) {
			row.classList.remove("ARhidden");
			row.classList.add("ARrow");
		};

		const showMoreLink = document.getElementById("ARshowMore" + id);
		showMoreLink.classList.add("ARclicked");
	}
}

function createSingleBookPageTable(headerText, id) {
	return `<div id='AGtable' style='position:relative'>
<div class='ARcontainer'>
<b>Availability on ${headerText}:</b>\
<div class='ARtable' id='AGAVAIL${id}'>
</div>
<a href='#' id='ARshowMore${id}' class='ARshowMoreInSinglePage ARhidden button Button--small '>show more
<button type="button" class="Button Button--inline Button--small"><span class="Button__labelItem"><i class="Icon ChevronIcon"><svg viewBox="0 0 24 24"><path d="M8.70710678,9.27397892 C8.31658249,8.90867369 7.68341751,8.90867369 7.29289322,9.27397892 C6.90236893,9.63928415 6.90236893,10.2315609 7.29289322,10.5968662 L12,15 L16.7071068,10.5968662 C17.0976311,10.2315609 17.0976311,9.63928415 16.7071068,9.27397892 C16.3165825,8.90867369 15.6834175,8.90867369 15.2928932,9.27397892 L12,12.3542255 L8.70710678,9.27397892 Z" transform="rotate(0 12 12)"></path></svg></i></span></button>
</a></div></div>`
};
function createListopiaBookListTable(headerText, id) {
	return `<div id='AGtable'>
	<b>Availability on ${headerText}:</b>
	<div class='ARcontainer'>
	<div class="ARtable" id='AGAVAIL${id}'></div>
<a href='#' id='ARshowMore${id}' class='ARshowMoreInList ARhidden button Button--small '>show more
<button type="button" class="Button Button--inline Button--small"><span class="Button__labelItem"><i class="Icon ChevronIcon">
<svg viewBox="0 0 24 24"><path d="M8.70710678,9.27397892 C8.31658249,8.90867369 7.68341751,8.90867369 7.29289322,9.27397892 C6.90236893,9.63928415 6.90236893,10.2315609 7.29289322,10.5968662 L12,15 L16.7071068,10.5968662 C17.0976311,10.2315609 17.0976311,9.63928415 16.7071068,9.27397892 C16.3165825,8.90867369 15.6834175,8.90867369 15.2928932,9.27397892 L12,12.3542255 L8.70710678,9.27397892 Z" transform="rotate(0 12 12)"></path></svg></i></span></button>
</a></div></div>`;
}

function createBookshelfTable(id, oneLine) {
	return `<td class="field AGcol ${oneLine}"><div style="max-width: 300px;" class="ARtable" id="AGAVAIL${id}"></div>
<span class='ARsmaller'><a href='#' id='ARshowMore${id}' class='ARshowMoreInShelf'>show more</a></span>
</td>`; 
}

// send search requests to Overdrive
function getOverdriveAvailability() {
	/*if (!libraryDivPlaceholders || libraryDivPlaceholders.length == 0) {
		return;
	}*/

	// check for tags on either a single book review page or the bookshelf page
	var book = document.querySelector("h1.Text__title1");
	var booklist = document.querySelectorAll('.responsiveBook');
	var booklist2 = document.querySelectorAll('table.tableList tr');
	var bookshelves = document.querySelectorAll('div#shelvesSection');

	var headerText = "Libby";
	if (showFormat.linkToOverdriveResults) {
		headerText = "Overdrive";
	}
	
	// if a single book page
	if (showOnPages["descriptionPage"] && book && !document.querySelector("div#AGtable")) {
		const id = "SINGLEBOOK";

		// inject the table we're going to populate
		document.querySelector('.BookPageMetadataSection__description')
			.insertAdjacentHTML("afterend", createSingleBookPageTable(headerText, id));

		const showMoreLink = document.getElementById("ARshowMore" + id);
		showMoreLink.addEventListener("click", onClickShowMore(id));

		if (showFormat.oneLine) {
			const div = document.getElementById("AGAVAIL" + id);
			div.classList.add("ARSingleoneLine");
		}

		// send a message for the background page to make the request
		chrome.runtime.sendMessage({
			type: "FROM_AG_PAGE",
			id: id,
			title: cleanTitleForSearch(book.textContent),
			author: cleanAuthorForSearch(document.querySelector(".ContributorLink__name").textContent)
		});
	} else if (showOnPages["listPage"] && booklist && booklist.length > 0) { // else if on a book list page
		booklist.forEach((element) =>  {
			//element.querySelector(".objectLockupContent__secondary").classList.add("AGloading");
			const id = element.querySelector('a').getAttribute("href").replace(/[^a-zA-Z0-9]/g,'');
			const title = element.querySelector('a.gr-h3').textContent;
			const author = element.querySelector('[itemprop=author]').textContent;

			// set a "Loading..." message for this listing
			element.querySelector(".communityRating")
				.parentElement.insertAdjacentHTML("afterend", createListopiaBookListTable(headerText, id));
			
			const showMoreLink = document.getElementById("ARshowMore" + id);
			showMoreLink.addEventListener("click", onClickShowMore(id));

			if (showFormat.oneLine) {
				const td = document.getElementById("AGAVAIL" + id);
				td.classList.add("ARListoneLine");
			}
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: cleanTitleForSearch(title),
				author: cleanAuthorForSearch(author)
			});
		});	
	} else if (showOnPages["listPage"] && booklist2 && booklist2.length > 0) { // else if on a book list page
		booklist2.forEach((element) =>  {
			//element.querySelector("div a.gr-button").classList.add("AGloading");
			const id = element.querySelector('a.bookTitle').getAttribute("href").replace(/[^a-zA-Z0-9]/g,'');
			const title = element.querySelector('a.bookTitle').textContent;
			const author = element.querySelector('a.authorName').textContent;

			// set a "Loading..." message for this listing
			element.querySelector(".minirating").parentElement.insertAdjacentHTML("afterend", createListopiaBookListTable(headerText, id));
			
			const showMoreLink = document.getElementById("ARshowMore" + id);
			showMoreLink.addEventListener("click", onClickShowMore(id));

			if (showFormat.oneLine) {
				const td = document.getElementById("AGAVAIL" + id);
				td.classList.add("ARListoneLine");
			}

			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: cleanTitleForSearch(title),
				author: cleanAuthorForSearch(author)
			});
		});
	} else if (showOnPages["shelfPage"] && bookshelves && bookshelves.length > 0) { // else if on my book shelf page
		// inject the table column we're going to populate
		if (!document.querySelector("th.overdrive")) {
			document.querySelector("th.avg_rating").insertAdjacentHTML("afterend", 
			'<th class="header field overdrive"><a href="#" id=AGsort>on ' + headerText.toLowerCase() + '</a></th>');

			// if the header is clicked to sort the column
			document.querySelector("#AGsort").addEventListener("click", function(e) {
				var element = document.querySelector("#AGsort");
				var arrow = document.querySelector("th img");
				arrow.parentElement.removeChild(arrow);
				element.parentElement.appendChild(arrow);
				if (element.classList.contains('AGdesc')) {
					element.classList.remove('AGdesc');
					element.classList.add('AGasc');
					if (arrow.getAttribute("alt").indexOf("Up") >= 0) {
						arrow.classList.add("flip-vertical");
					} else {
						arrow.classList.remove("flip-vertical");
					}
				} else {
					element.classList.remove('AGasc');
					element.classList.add('AGdesc');
					if (arrow.getAttribute("alt").indexOf("Down") >= 0) {
						arrow.classList.add("flip-vertical");
					} else {
						arrow.classList.remove("flip-vertical");
					}
				}

				sortRowsByStatus();
				return false;
			});
		};

		// iterate through every listing in the list that we haven't seen before
		document.querySelectorAll("tr.bookalike:not(.AGseen)").forEach((element) => {
			const id = element.getAttribute("id");

			var oneLine = "";
			if (showFormat.oneLine) {
				oneLine = "ARShelfoneLine";
			}
			// set a "Loading..." message for this listing
			var avg_col = element.querySelector("td.avg_rating");
			avg_col.insertAdjacentHTML("afterend", createBookshelfTable(id, oneLine));
			// mark the row as seen
			element.classList.add("AGseen");

			const showMoreLink = document.getElementById("ARshowMore" + id);
			showMoreLink.addEventListener("click", onClickShowMore(id));

			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: cleanTitleForSearch(element.querySelector("td.title a").textContent),
				author: cleanAuthorForSearch(element.querySelector("td.author a").textContent)
			});

			libraryClassNames.forEach(function(className) {
				element.classList.add(className);
			})
			waitingOnAvailability = true;
		});

		// start a check every 2 seconds if new rows are added in case infinte scrolling is on
		//   or if a book's position is manually changed
		if (tableUpdateCheckInterval == null) {
			tableUpdateCheckInterval = setInterval(function() {
				if (document.querySelectorAll("tr.bookalike:not(.AGseen)").length > 0) {
					getOverdriveAvailability();
				}
				// sort rows by availability if necessary
				if (waitingOnAvailability) {
					sortRowsByStatus();
				}
			}, 2000);
		}
	}
}

function injectAvailableReads() {
	if (!loaded) {
		loaded = true;
			// if document has been loaded, inject CSS styles
			document.getElementsByTagName('body')[0].insertAdjacentHTML("beforebegin", `<style>
					#AGtable a{text-decoration:none;}
					.ARcontainer {position:relative}
					.AGcol { position:relative}
					.ARSingleoneLine { max-width: 700px; white-space: nowrap; overflow:hidden }
					.ARListoneLine { max-width: 400px; white-space: nowrap; overflow:hidden }
					.ARShelfoneLine { max-width: 300px; white-space: nowrap; overflow:hidden }
					div img.AGaudio{margin-left:5px;margin-bottom:1px}
					span img.AGaudio{margin-left:-1px;margin-right:3px;margin-bottom:1px}
					.AGline{display:none;}
					font:hover hr.AGline{margin-left:5px;border:thin solid #c6c8c9;position:absolute;display:inline}
					.AGtitle{display:none;}
					.ARtable td.ARimg{text-wrap:nowrap;padding:0px;display:block}
					font:hover span.AGtitle{z-index:999;background-color:white;position: absolute;margin-left:10px;margin-top:-1px;padding-left:5px;padding-right:5px;display:inline;border:thin solid #c6c8c9}
					.flip-vertical {-moz-transform: scaleY(-1);-webkit-transform: scaleY(-1);-o-transform: scaleY(-1);transform: scaleY(-1);-ms-filter: flipv; /*IE*/filter: flipv;}
					.ARshowMoreInSinglePage { position:absolute; right: 15px; bottom: 8px; height:auto; background:white; padding-right: 0px} 
					.ARshowMoreInList { padding:3px; position:absolute; right: 15px; bottom: 8px; height:auto; background:white;} 
					.ARshowMoreInShelf { height:auto; } 
					.ARhidden { display:none }
					.ARclicked { display:none }
					.ARresultstatus {white-space: nowrap}
					.ARfade {
						-webkit-mask-image: linear-gradient(to bottom, black calc(100% - 30px), transparent 100%);
						mask-image: linear-gradient(to bottom, black calc(100% - 30px), transparent 100%);
					  }
					.ARsmaller { font-size: 80% }
					.ARdesc { text-align: left; padding-left: 1px; }
					.ARrow { display: flex; }
					</style>`);
		chrome.storage.sync.get(null, function(obj) {
			showOnPages = obj["showOnPages"];
			showFormat = obj["showFormat"];

			getOverdriveAvailability();
		});
	}
};

function limitResultsShown(id) {
	const table = document.getElementById("AGAVAIL" + id);
	const showMore = document.getElementById("ARshowMore" + id);
   
	if (table.children && !showMore.classList.contains("ARclicked")) {
		for (var i = 0, row; row = table.children[i]; i++) {
			if (i >= showFormat.limitResultCount) {
				row.classList.add("ARhidden");
				row.classList.remove("ARrow");
				showMore.classList.remove("ARhidden");
			} else {
				row.classList.remove("ARhidden");
				row.classList.add("ARrow");
			}
		}
		const delta = table.children.length - showFormat.limitResultCount;
		if (delta > 0) {
			showMore.textContent = "show " + delta + " more";
			showMore.classList.remove("ARhidden")
			table.classList.add("ARfade")
		} else {
			showMore.classList.add("ARhidden")
		}
	}
}

// wait for the document to load before injecting code
window.addEventListener("load", (event) => injectAvailableReads);
// if in Firefox we missed the load event, add after a delay
setTimeout(injectAvailableReads, 3000);

function insertRow(id, imgCol, descCol, sortScore, hideNotFoundIfOtherResults, notFoundOrder) {
	const table = document.getElementById("AGAVAIL" + id);
   
	if (table.children) {
		var i = 0, row = null;
		for (i = 0; row = table.children[i]; i++) {
			var rowSortScore = row.getAttribute("ARsortScore");
			if (sortScore < rowSortScore) {
				break;
			}
		}
		if (i == 0) {
			table.setAttribute("ARsortScore", sortScore);
		}
	}

	const rowDiv = document.createElement("div");
	rowDiv.classList.add("ARrow");
	table.insertBefore(rowDiv, row);

	const imgCell = document.createElement("div");
	imgCell.classList.add("ARimg");
	rowDiv.appendChild(imgCell);

	const descCell = document.createElement("div");
	descCell.classList.add("ARdesc");
	rowDiv.appendChild(descCell);

	rowDiv.setAttribute("ARsortScore", sortScore);
	imgCell.innerHTML = imgCol;
	descCell.innerHTML = descCol;

	if (hideNotFoundIfOtherResults) {
		if (table.children) {
			for (var i = 0, row; row = table.children[i]; i++) {
				var rowSortScore = row.getAttribute("ARsortScore");
				if (rowSortScore == notFoundOrder) {
					table.removeChild(row);
					break;
				}
			}
		}
	}

	if (showFormat.limitResultCount > 0) {
		limitResultsShown(id);
	}
}

function addOrUpdateNotFoundRow(message, resultsUrl, notFoundOrder, hideNotFoundIfOtherResults) {
	const table = document.getElementById("AGAVAIL" + message.id);
	if (table.children) {
		for (var i = 0, row; row = table.children[i]; i++) {
			var rowSortScore = row.getAttribute("ARsortScore");
			if (rowSortScore == notFoundOrder) {
				if (!showFormat.hideLibrary) {
					row.innerHTML = row.innerHTML.replace("\"> at ", "\"> at <a href='" + resultsUrl + "'>" + message.libraryShortName + "</a>, ");
				}
				return;
			} else if (hideNotFoundIfOtherResults) {
				return;
			}
		}
	}

	const statusColor = "gray";
	const statusText = "not found";
	const sortScore = notFoundOrder;

	var library = "";
	if (!showFormat.hideLibrary) {
		library = " at " + message.libraryShortName;
	}

	const descCol = "<div class=ARdesc><span><font color=" + statusColor + ">" + statusText + "</font><a href='"+ resultsUrl + "'>" + library + "</a></span>" +
		"<br/>&nbsp;&nbsp;<span class='ARsmaller'>Searched for: <a href='"+ resultsUrl + "'><i>" + message.searchTitle + "</i> by <i>" + message.searchAuthor + "</i></a></span></div>";

	insertRow(message.id, "<img>", descCol, sortScore, false, notFoundOrder);
}

function parseResultsMessage(message, sender, sendResponse) {
	const endOfList     = 99999999;
	const requestOrder  = endOfList;
	const notFoundOrder = endOfList * 10;
	const errorOrder    = endOfList * 100;
	const hideNotFoundIfOtherResults = message.hideNotFoundIfOtherResults;

	if (!message || !message.searchUrls || message.searchUrls === undefined) {
		console.log(message);
	}
	var resultsUrl = message.searchUrls.libby;
	if (showFormat.linkToOverdriveResults) {
		resultsUrl = message.searchUrls.overdrive;
	}

	for (const book of message.books) {		
		var statusColor = "red";
		var statusText = "error searching";
		var sortScore = errorOrder;

		resultsUrl = book.libbyResultUrl;
		if (showFormat.linkToOverdriveResults) {
			resultsUrl = book.searchUrls.overdrive;
		}
		
		// if an audiobook, add a headphone icon
		if (book.isAudio) {
			audioStr = "<span class=ARaudiobadge>🎧</span>";
		} else {
			audioStr = "";
		}

		if (book.alwaysAvailable) { // if always available
			statusText = "always available";
			statusColor = "#080";
			sortScore = endOfList * -1;

		} else if (book.totalCopies && book.holds != null && book.holds >= 0) { // if there's a wait list with count
			var holdsRatio = ", " + book.holds + "/" + book.totalCopies + " holds";

			var estimateStr = book.estimatedWaitDays;
			if (!estimateStr) {
				estimateStr = "no estimate" + holdsRatio;
				holdsRatio = "";
				sortScore = book.holds * 14 + 10;
			} else {
				if (estimateStr == 1) {
					estimateStr += " day"
				} else {
					estimateStr += " days"
				}
				sortScore = book.estimatedWaitDays + 10;
			}

			if (!message.showHoldsRatio) {
				holdsRatio = "";
			}

			statusColor = "#C80";
			statusText = estimateStr + holdsRatio;
		
		} else if (book.holds && isNaN(book.holds)) { // if there's a wait list with no count
			statusColor = "#C80";
			statusText = "place hold";
			sortScore = requestOrder;
			if (book.estimatedWaitDays >= 0) {
				sortScore = book.estimatedWaitDays + 10;
			}

		} else if ((!book.availableCopies && book.isRecommendableToLibrary) || (!book.totalCopies == 0 && book.request)) { // if no copies but request is an option
			statusColor = "#C60";
			statusText = "request";
			sortScore = requestOrder;

		} else if (book.availableCopies > 0) { // if available copies found with count
			statusColor = "#080";
			statusText = book.availableCopies + " available";
			sortScore = book.availableCopies * -1;

		} else if (!book.totalCopies) { // if no copies found
			addOrUpdateNotFoundRow(message, resultsUrl, notFoundOrder, hideNotFoundIfOtherResults);
			continue;
		}

		var imgCol = "";
		if (book.imgUrl) {
			var imgHeight = 40;
			if (showFormat.oneLine) {
				imgHeight = 20;
			} 

			imgCol = "<a href='" + resultsUrl + "'><img style='max-width:none' src='" + book.imgUrl + "' height=" + imgHeight + "px></a>";
		}

		var titleAndAuthor = "<br/>";
		var prependAudioStr = "";
		if (showFormat.oneLine) {
			titleAndAuthor = " - "
		}
		if (showFormat.hideTitleAndAuthor) {
			titleAndAuthor = "";
			prependAudioStr = audioStr;
		} else {
			titleAndAuthor += "<span class='ARtitle'>" + audioStr + book.title + " by " + book.author + "</span>"
		}

		var library = "";
		if (!showFormat.hideLibrary) {
			library = " at " + message.libraryShortName;
		}

		const descCol = "<div class=ARdesc><span class=ARresultstatus><a href='" + resultsUrl + "'><font color='" + statusColor + "'>" + prependAudioStr + statusText + "</font></a>" + 
			library + "</span>" +
			titleAndAuthor + "</div>";

		insertRow(message.id, imgCol, descCol, sortScore, hideNotFoundIfOtherResults, notFoundOrder);
	}

	if (!message.books || message.books.length == 0) {
		addOrUpdateNotFoundRow(message, resultsUrl, notFoundOrder, hideNotFoundIfOtherResults);
	}
}

chrome.runtime.onMessage.addListener(parseResultsMessage);
