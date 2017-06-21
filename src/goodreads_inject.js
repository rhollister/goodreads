// This script is run when visiting a Goodreads page

var libraryDivPlaceholders = "";
var tableUpdateCheckInterval = null;
var showOnPages = {};
var showFormat = {};
var libraryClassNames = [];
var waitingOnAvailability = false;

function sortRowsByStatus() {
	var sortAsc = true;
	if ($("#AGsort").hasClass("AGasc")) {
		sortAsc = true;
	} else if ($("#AGsort").hasClass("AGdesc")) {
		sortAsc = false;
	} else {
		return;
	}

	// initialize the map
	var bookList = [];

	waitingOnAvailability = false;

	$("tr.bookalike").each(function(index, value) {
		bookList.push($(this));
		if (!waitingOnAvailability) {
			for (var l in libraryClassNames) {
				if ($(this).hasClass(libraryClassNames[l])) {
					waitingOnAvailability = true;
					break;
				}
			}
		}
	});

	// sort books into lists by their current status
	bookList.sort(function(a, b) {
		x = parseFloat($(a).attr("AGsortScore"));
		y = parseFloat($(b).attr("AGsortScore"));
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
	for (var b in bookList) {
		row = bookList[b];
		row.detach();
		if (!prevRow) {
			row.prependTo($("tbody#booksBody"));
		} else {
			row.insertAfter(prevRow);
		}
		prevRow = row;
	}
}

// for title and author remove parentheticals, remove [&|,], and trim whitespace
function cleanTitleForSearch(title) {
	return title.replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/: .*/, '').replace(/[ ]+/, ' ');
}
function cleanAuthorForSearch(author) {
	return author.replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/(?:^|\W)(?:[A-Z]\.)+/g, ' ').replace(/[ ]+/, ' ');
}

// send search requests to Overdrive
function getOverdriveAvailability() {
	if (!libraryDivPlaceholders || libraryDivPlaceholders.length == 0) {
		return;
	}

	// check for tags on either a single book review page or the bookshelf page
	var book = $("h1#bookTitle.bookTitle");
	var booklist = $("a.bookTitle");
	var bookshelves = $("h3").filter(function() {
		return $(this).text().indexOf("bookshelves") >= 0;
	});

	// if a single book page
	if (showOnPages["descriptionPage"] && book && book.size() > 0 && $("div#AGtable").size() == 0) {
		var id = "SINGLEBOOK";

		// inject the table we're going to populate
		$("div#description").after("<div id='AGtable'><table><tr>\
	<td valign=top><b>Availability on Overdrive:</b></td>\
	<td style='padding-left:10px' valign=top class='AGAVAIL" + id + "'>" + libraryDivPlaceholders + "\
	</td></tr></table></div>");
		// send a message for the background page to make the request
		chrome.runtime.sendMessage({
			type: "FROM_AG_PAGE",
			id: id,
			title: cleanTitleForSearch(book.text()),
			author: cleanAuthorForSearch($(".authorName").first().text())
		});
	} else if (showOnPages["listPage"] && booklist && booklist.length > 0) { // else if on a book list page
		booklist.each(function(index, value) {
			$(this).closest("tr").addClass("AGloading");
			var id = $(this).attr("href").replace(/[^a-zA-Z0-9]/g,'');

			// set a "Loading..." message for this listing
			$(this).parent().find(".authorName").parent().after("<div id='AGtable'><table><tr>\
	<td valign=top><b>Availability on Overdrive:</b></td>\
	<td style='padding-left:10px' valign=top class='AGAVAIL" + id + "'>" + libraryDivPlaceholders + "\
	</td></tr></table></div>");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: cleanTitleForSearch($(this).text()),
				author: cleanAuthorForSearch($(this).parent().find(".authorName").text())
			});
		});
	} else if (showOnPages["shelfPage"] && bookshelves && bookshelves.size() > 0) { // else if on my book shelf page
		// inject the table column we're going to populate
		if ($("th.overdrive").size() == 0) {
			$("th.avg_rating").after('<th class="header field overdrive"><a href="#" id=AGsort>on overdrive</a></th>');

			// if the header is clicked to sort the column
			$("#AGsort").click(function() {
				var arrow = $("th img");
				arrow.detach();
				arrow.insertAfter($(this));
				if ($(this).hasClass('AGdesc')) {
					$(this).removeClass('AGdesc');
					$(this).addClass('AGasc');
					if (arrow.attr("alt").indexOf("Up") >= 0) {
						arrow.addClass("flip-vertical");
					} else {
						arrow.removeClass("flip-vertical");
					}
				} else {
					$(this).removeClass('AGasc');
					$(this).addClass('AGdesc');
					if (arrow.attr("alt").indexOf("Down") >= 0) {
						arrow.addClass("flip-vertical");
					} else {
						arrow.removeClass("flip-vertical");
					}
				}

				sortRowsByStatus();
				return false;
			});
		};

		// iterate through every listing in the list that we haven't seen before
		$("tr.bookalike:not(:has(td.AGseen))").each(function(index, value) {
			var id = $(this).attr("id");

			// set a "Loading..." message for this listing
			var avg_col = $(this).find("td.avg_rating");
			avg_col.after('<td style="white-space:nowrap" class="field AGcol AGAVAIL' + id + '">' + libraryDivPlaceholders + '</td>');
			// mark the row as seen
			avg_col.addClass("AGseen");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: cleanTitleForSearch($(this).find("td.title a").text()),
				author: cleanAuthorForSearch($(this).find("td.author a").text())
			});

			$(this).addClass(libraryClassNames.join(" "));
			waitingOnAvailability = true;
		});

		// start a check every 2 seconds if new rows are added in case infinte scrolling is on
		//   or if a book's position is manually changed
		if (tableUpdateCheckInterval == null) {
			tableUpdateCheckInterval = setInterval(function() {
				if ($("tr.bookalike:not(:has(td.AGseen))").size() > 0) {
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

$(document).ready(function() {
	// if document has been loaded, inject CSS styles
	$("body").prepend("<style>\
				div img.AGaudio{margin-left:5px;margin-bottom:1px}\
				span img.AGaudio{margin-left:-1px;margin-right:3px;margin-bottom:1px}\
				.AGline{display:none;}\
				font:hover hr.AGline{margin-left:5px;border:thin solid #c6c8c9;position:absolute;display:inline}\
				.AGtitle{display:none;}\
				font:hover span.AGtitle{z-index:999;background-color:white;position: absolute;margin-left:10px;margin-top:-1px;padding-left:5px;padding-right:5px;display:inline;border:thin solid #c6c8c9}\
				.flip-vertical {-moz-transform: scaleY(-1);-webkit-transform: scaleY(-1);-o-transform: scaleY(-1);transform: scaleY(-1);-ms-filter: flipv; /*IE*/filter: flipv;}\
				</style>");
	$("#usernav").prepend("<li><a target='_blank' href='" + chrome.extension.getURL("src/options/index.html") + "'><img id='AGimg' src='" + chrome.extension.getURL('icons/icon25.png') + "' style='width:16px;height:16px' title='Available Goodreads settings'></a></li>");
	$("#AGimg").mouseover(function() {
            $(this).attr("src", chrome.extension.getURL('icons/icon25-hover.png'));
        })
        .mouseout(function() {
            $(this).attr("src", chrome.extension.getURL('icons/icon25.png'));
        });

	chrome.storage.sync.get("showOnPages", function(obj) {
		showOnPages = obj["showOnPages"];
		chrome.storage.sync.get("showFormat",function(obj) {
			showFormat = obj["showFormat"];
			chrome.storage.sync.get("libraries", function(obj) {
				var libraries = obj["libraries"];
				var firstDiv = true;
				libraryDivPlaceholders = "";
				for (var l in libraries) {
					if(!libraries[l].url) {
						libraries[l].url = libraries[l];
					}
					var libraryName = libraries[l].url.replace(/\..*/, '');
					// load placeholders for different library results
					libraryDivPlaceholders += "<div class='" + libraryName;

					if (libraries.length == 1) {
						libraryDivPlaceholders += "'><font color=lightgray><small><i><span class=status>Loading...</i></span></small></font></div>"
					} else {
						libraryDivPlaceholders += "'><font color=lightgray><small><i><span class=status>Loading " + libraryName + "...</i></span></small></font></div>"
					}

					libraryClassNames.push("AGloading" + libraryName);
				}
				$("tbody").change();
				getOverdriveAvailability();
			});
		});
	});
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	var listingStr = "<font color=gray>not found<hr width=10px class=AGline><span class='AGtitle'>searched " + message.libraryShortName + " for: <i>" + message.searchTerm + "</i></span></font>";
	var sortScore = 9999;
	var onlyRecommendations = true;

	for (var bookIndex in message.books) {
		var book = message.books[bookIndex];
		var audioStr = "";
		var audioClass = "";
		var newScore = 0;

		// reset listingStr if starting a new row, otherwise add a line break
		if (bookIndex == 0) {
			listingStr = "";
		} else if (listingStr.length > 0 && book.totalCopies) {
			listingStr += "<br>";
		}

		// continue if none were found
		if (!book.totalCopies) { continue; }
		// continue if we found and audio book and don't want that format
		if (!showFormat['audioBook'] && book.isAudio) { continue; }
		// continue if we found an ebook and don't want that format
		if (!showFormat['eBook'] && !book.isAudio) { continue; }

		onlyRecommendations = false;

		// if an audiobook, add a headphone icon
		if (book.isAudio) {
			audioStr = "<img class=AGaudio src='" + chrome.extension.getURL('icons/headphones.svg') + "' height=8px width=8px>";
			audioClass = "Audio";
			newScore = 90;
		} else {
			audioStr = "";
			audioClass = "";
		}

		var copiesStr = "";
		if (book.alwaysAvailable) { // if always available
			copiesStr = "color=#080><span class=status>always available</span>";
			newScore += -1;
		} else if (book.holds != null && book.holds >= 0) { // if there's a wait list with count
			copiesStr = "color=#C80><span class=status>" + book.holds + "/" + book.totalCopies + " holds</span>";
			newScore += 1000 + book.holds / book.totalCopies;
		} else if (book.holds && isNaN(book.holds)) { // if there's a wait list with no count
			copiesStr = "color=#C80><span class=status>place hold</span>";
			newScore += 1000;
		} else if (book.totalCopies > 0) { // if available copies found with count
			copiesStr = "color=#080><span class=status>" + book.totalCopies + " available</span>";
			newScore += -1;
		} else if (book.totalCopies) { // if available copies found with no count
			copiesStr = "color=#080><span class=status>available</span>";
			newScore += -1;
		} else if (!book.totalCopies) { // if no copies found
			listingStr = "<font color=gray><span class=status>not found</span><hr width=10px class=AGline><span class='AGtitle'>searched for: " + message.searchTerm + "</span></font>";
			newScore += 9999;
		} else { // unknown error occured
			console.error("Available Goodreads error:", copiesStr, book, message);
			listingStr += "<font class='AGcopy' color=red><span class=status>unknown</span><span class='AGtitle'>" + book.title + "</span></font>";
			newScore += 99999;
		}

		if (newScore < sortScore) {
			sortScore = newScore;
		}

		// if copies are found, append to listing string
		if (copiesStr) {
			listingStr += "<font class='AGcopy' " + copiesStr + audioStr + "<hr width=10px class=AGline><span class='AGtitle'>" + message.libraryStr + audioStr + book.title + "</span></font>";
		}
	}
	if (onlyRecommendations && message.books && message.books.length > 0) {
		sortScore = 9998;
		listingStr = "<font color=#C60>request<hr width=10px class=AGline><span class='AGtitle'>Recommend " + message.libraryShortName + " add this to their collection</span></font>"
	}

	// inject listing into a cell's div based on review id and library
	$("td.AGAVAIL" + message.id + " div." + message.libraryShortName).html('<a target="_blank" href="' + message.url + '">' + listingStr + '</a>');
	row = $("tr#" + message.id);
	oldScore = $(row).attr("AGsortScore");
	if (!oldScore || sortScore < oldScore) {
		$(row).attr("AGsortScore", sortScore);
	}

	$("tr#" + message.id).removeClass("AGloading" + message.libraryShortName);
});
