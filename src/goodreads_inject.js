// This script is run when visiting a Goodreads page

var libraryDivPlaceholders = "";
var tableUpdateCheckInterval = null;
var showOnPages = {};
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
			for (l in libraryClassNames) {
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

// send search requests to Overdrive
function getODAvailability() {
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
		// for title and author remove parantheticals, remove [&|,], and trim whitespace
		var title = book.text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ');
		var author = $(".authorName").first().text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ');

		// inject the table we're going to populate
		$("div#description").after("<div id='AGtable'><table><tr>\
	<td valign=top><b>Availability on Overdrive:</b></td>\
	<td style='padding-left:10px' valign=top class='AGAVAIL" + id + "'>" + libraryDivPlaceholders + "\
	</td></tr></table></div>");
		// send a message for the background page to make the request
		chrome.runtime.sendMessage({
			type: "FROM_AG_PAGE",
			id: id,
			title: title,
			author: author
		});
	} else if (showOnPages["listPage"] && booklist && bookList.length > 0) { // else if on a book list page
		booklist.each(function(index, value) {
			$(this).closest("tr").addClass("AGloading");
			var id = $(this).parent().parent().find("td.number").text();
			// for title and author remove parentheticals, remove [&|,], and trim whitespace
			var title = $(this).text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/: .*/, '').replace(/[ ]+/, ' ');
			var author = $(this).parent().find(".authorName").text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/ [A-Z]\.$/, '').replace(/[ ]+/, ' ');
			// set a "Loading..." message for this listing
			$(this).parent().find(".authorName").parent().after("<div id='AGtable'><table><tr>\
	<td valign=top><b>Availability on Overdrive:</b></td>\
	<td style='padding-left:10px' valign=top class='AGAVAIL" + id + "'>" + libraryDivPlaceholders + "\
	</td></tr></table></div>");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: title,
				author: author
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
			// for title and author remove parentheticals, remove [&|,], and trim whitespace
			var title = $(this).find("td.title a").text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/: .*/, '').replace(/[ ]+/, ' ');
			var author = $(this).find("td.author a").text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/ [A-Z]\.$/, '').replace(/[ ]+/, ' ');

			// set a "Loading..." message for this listing
			var avg_col = $(this).find("td.avg_rating");
			avg_col.after('<td style="white-space:nowrap" class="field AGcol AGAVAIL' + id + '">' + libraryDivPlaceholders + '</td>');
			// mark the row as seen
			avg_col.addClass("AGseen");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: title,
				author: author
			});

			$(this).addClass(libraryClassNames.join(" "));
			waitingOnAvailability = true;
		});

		// start a check every 2 seconds if new rows are added in case infinte scrolling is on
		//   or if a book's position is manually changed
		if (tableUpdateCheckInterval == null) {
			tableUpdateCheckInterval = setInterval(function() {
				if ($("tr.bookalike:not(:has(td.AGseen))").size() > 0) {
					getODAvailability();
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
	chrome.storage.sync.get("showOnPages", function(obj) {
		showOnPages = obj["showOnPages"];
		chrome.storage.sync.get("libraries", function(obj) {
			var libraries = obj["libraries"];
			var firstDiv = true;
			libraryDivPlaceholders = "";
			for (var l in libraries) {
				var libraryName = libraries[l].replace(/\..*/, '');
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
			getODAvailability();
		});
	});
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	var listingStr = "<font color=gray>not found<hr width=10px class=AGline><span class='AGtitle'>searched " + message.library + " for: <i>" + message.searchTerm + "</i></span></font>"
	var sortScore = 9999;

	for (var bookIndex in message.books) {
		var book = message.books[bookIndex];
		var audioStr = "";
		var audioClass = "";
		var newScore = 0;

		// reset listingStr if starting a new row, otherwise add a line break
		if (bookIndex == 0) {
			listingStr = "";
		} else {
			listingStr += "<br>";
		}
		// if an audiobook, add a headphone icon
		if (book.isaudio) {
			audioStr = "<img class=AGaudio src='" + chrome.extension.getURL('icons/headphones.svg') + "' height=8px width=8px>";
			audioClass = "Audio";
			newScore = 90;
		} else {
			audioStr = "";
			audioClass = "";
		}

		var copiesStr = "";
		if (book.copies > 0) { // if available copies found
			copiesStr = "color=#080><span class=status>" + book.copies + " available</span>";
			newScore += -1;
		} else if (book.copies == 'always available') { // if always available copies found
			copiesStr = "color=#080><span class=status>always available</span>";
			newScore += -1;
		} else if (book.copies == -1) { // if no copies found
			listingStr = "<font color=gray><span class=status>not found</span><hr width=10px class=AGline><span class='AGtitle'>searched for: " + message.searchTerm + "</span></font>";
			newScore += 9999;
		} else if (book.total >= 0 && book.waiting >= 0) { // if there's a wait list
			copiesStr = "color=#C80><span class=status>" + book.waiting + "/" + book.total + " holds</span>";
			newScore += 1000 + book.waiting / book.total;
		} else { // unknown error occured
			listingStr += "<font class='AGcopy' color=red><span class=status>N/A</span><span class='AGtitle'>" + book.title + "</span></font>";
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

	// inject listing into a cell's div based on review id and library
	$("td.AGAVAIL" + message.id + " div." + message.library).html('<a target="_blank" href="' + message.url + '">' + listingStr + '</a>');
	row = $("tr#" + message.id);
	oldScore = $(row).attr("AGsortScore");
	if (!oldScore ||  sortScore < oldScore) {
		$(row).attr("AGsortScore", sortScore);
	}

	$("tr#" + message.id).removeClass("AGloading" + message.library);
});