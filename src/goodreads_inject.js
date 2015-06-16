// This script is run when visiting a Goodreads page

var libraryDivPlaceholders = "";
var tableUpdateCheckInterval = null;

// send search requests to Overdrive
function getODAvailability() {
	if (!libraryDivPlaceholders || libraryDivPlaceholders.length == 0) {
		return;
	}

	// check for tags on either a single book review page or the bookshelf page
	book = $("h1#bookTitle.bookTitle");
	bookshelves = $("h3").filter(function() {
		return $(this).text().indexOf("bookshelves") >= 0;
	});

	// if a single book page
	if (book && book.size() > 0 && $("div#AGtable").size() == 0) {
		id = "SINGLEBOOK";
		// for title and author remove parantheticals, remove [&|,], and trim whitespace
		title = book.text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ');
		author = $(".authorName").first().text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ');

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
	} else if (bookshelves && bookshelves.size() > 0) { // else if on my book list page
		// inject the table column we're going to populate
		if ($("th.overdrive").size() == 0) {
			$("th.avg_rating").after('<th class="header field overdrive">on overdrive</th>');
		}
		// iterate through every listing in the list that we haven't seen before
		$("tr.bookalike:not(:has(td.AGseen))").each(function(index, value) {
			id = $(this).attr("id");
			// for title and author remove parentheticals, remove [&|,], and trim whitespace
			title = $(this).find("td.title a").text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/: .*/, '').replace(/[ ]+/, ' ');
			author = $(this).find("td.author a").text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/ [A-Z]\.$/, '').replace(/[ ]+/, ' ');

			// set a "Loading..." message for this listing
			avg_col = $(this).find("td.avg_rating");
			avg_col.after('<td style="white-space:nowrap" class="field AGAVAIL' + id + '">' + libraryDivPlaceholders + '</td>');
			// mark the row as seen
			avg_col.addClass("AGseen");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_AG_PAGE",
				id: id,
				title: title,
				author: author
			});
		});

		// start a check ever 2 seconds if new rows are added in case infinte scrolling is on
		//   or if a book's position is manually changed
		if (tableUpdateCheckInterval == null) {
			tableUpdateCheckInterval = setInterval(function() {
				if ($("tr.bookalike:not(:has(td.AGseen))").size() > 0) {
					getODAvailability();
				}
			}, 2000);
		}
	}
}

$(document).ready(function() {
	// if document has been loaded, inject CSS rules
	$("body").prepend("<style>\
				div img.AGaudio{margin-left:5px;margin-bottom:1px}\
				span img.AGaudio{margin-left:-1px;margin-right:3px;margin-bottom:1px}\
				.AGline{display:none;}\
				font:hover hr.AGline{margin-left:5px;border:thin solid #c6c8c9;position:absolute;display:inline}\
				.AGtitle{display:none;}\
				font:hover span.AGtitle{z-index:999;background-color:white;position: absolute;margin-left:10px;margin-top:-1px;padding-left:5px;padding-right:5px;display:inline;border:thin solid #c6c8c9}\
				</style>");
	chrome.storage.sync.get("libraries", function(obj) {
		libraries = obj["libraries"];
		firstDiv = true;
		libraryDivPlaceholders = "";
		for (var l in libraries) {
			// load placeholders for different library results
			libraryDivPlaceholders += "<div class='" + libraries[l].replace(/\..*/, '');

			if (firstDiv) {
				firstDiv = false;
				libraryDivPlaceholders += "'><font color=lightgray><small><i>Loading...</i></small></font></div>"
			} else {
				libraryDivPlaceholders += "'></div>";
			}
		}
		$("tbody").change();
		getODAvailability();

	});
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	listingStr = "<font color=gray>not found<hr width=10px class=AGline><span class='AGtitle'>searched " + message.library + " for: <i>" + message.searchTerm + "</i></span></font>"

	for (var bookIndex in message.books) {
		book = message.books[bookIndex];

		// reset listingStr if starting a new row, otherwise add a line break
		if (bookIndex == 0) {
			listingStr = "";
		} else {
			listingStr += "<br>";
		}
		// if an audiobook, add a headphone icon
		if (book.isaudio) {
			audioStr = "<img class=AGaudio src='" + chrome.extension.getURL('icons/headphones.svg') + "' height=8px width=8px>";
		} else {
			audioStr = "";
		}

		copiesStr = "";
		if (book.copies > 0) { // if available copies found
			copiesStr = "color=#080>" + book.copies + " available";
		} else if (book.copies == 'always available') { // if always available copies found
			copiesStr = "color=#080>always available";
		} else if (book.copies == -1) { // if no copies found
			listingStr = "<font color=gray>not found<hr width=10px class=AGline><span class='AGtitle'>searched for: " + message.searchTerm + "</span></font>";
		} else if (book.total >= 0 && book.waiting >= 0) { // if there's a wait list
			copiesStr = "color=#C80>" + book.waiting + "/" + book.total + " holds";
		} else { // unknown error occured
			listingStr += "<font class='AGcopy' color=red>N/A<span class='AGtitle'>" + book.title + "</span></font>";
		}

		// if copies are found, append to listing string
		if (copiesStr) {
			listingStr += "<font class='AGcopy' " + copiesStr + audioStr + "<hr width=10px class=AGline><span class='AGtitle'>" + message.libraryStr + audioStr + book.title + "</span></font>";
		}
	}

	// inject listing into a cell's div based on review id and library
	$("td.AGAVAIL" + message.id + " div." + message.library).html('<a target="_blank" href="' + message.url + '">' + listingStr + '</a>');
});