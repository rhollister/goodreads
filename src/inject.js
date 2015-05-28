// This script is run when visiting a Goodreads page

// send search requests to Overdrive
function getODAvailability() {

	book = $("h1#bookTitle.bookTitle")
	bookshelves = $("h3").filter(function() {
      return $(this).text().indexOf("bookshelves") >= 0;
    });
	// if a single book page
	if (book && book.size() > 0) { 
		id = "SINGLEBOOK";
		// for title and author remove parantheticals, remove [&|,], and trim whitespace
		title = book.text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ')
		author = $(".authorName").first().text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ')

		// inject the table we're going to populate
		$("div#description").after("<div><table><tr>\
			<td valign=top><b>Availability on Overdrive:</b></td>\
			<td style='padding-left:10px' valign=top class='ODAVAIL" + id + "'><font color=lightgray><small><i>Loading...</i></small></font>\
			</td></tr></table></div>");
		// send a message for the background page to make the request
		chrome.runtime.sendMessage({
			type: "FROM_GROD_PAGE",
			id,
			title,
			author
		});
		
	} else if (bookshelves && bookshelves.size() > 0) { // else if on my book list page
		// inject the table column we're going to populate
		$("th.avg_rating").after('<th class="header field">on overdrive</th>');
		// iterate through every listing in the list that we haven't seen before
		$("tr.bookalike:not(.ODfound)").each(function(index, value) {
			id = $(this).attr("id");
			// for title and author remove parentheticals, remove [&|,], and trim whitespace
			title = $(this).find("td.title a").text().replace(/\(.*\)/, "").replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ')
			author = $(this).find("td.author a").text().replace(/^\s+|\s+$/g, '').replace(/[&|,]/g, ' ').replace(/[ ]+/, ' ');

			// set a "Loading..." message for this listing
			$(this).find("td.avg_rating").after('<td style="white-space:nowrap" class="field ODAVAIL' + id + '"><font color=lightgray><small><i>Loading...</i></small></font></td>');
			// mark the row as seen
			$(this).addClass("ODfound");
			// send a message for the background page to make the request
			chrome.runtime.sendMessage({
				type: "FROM_GROD_PAGE",
				id,
				title,
				author
			});
		});
		// start a check once a second if new rows are added in case infinte scrolling is on
		var tableUpdateCheckInterval = setInterval(function() {
			size = $("table#books tr").size()
			if (previousSize != size) {
				previousSize = size
				getODAvailability()
			}
		}, 1000)
	}
}

// when the page first loads
chrome.runtime.sendMessage({}, function(response) {
	var settings = response;
	var readyStateCheckInterval = setInterval(function() {
		if (document.readyState === "complete") {
			clearInterval(readyStateCheckInterval);

			// if document has been loaded, inject CSS rules
			$("body").prepend("<style>.ODaudio{margin-left:4px;margin-bottom:1px}.ODline{display:none;}font:hover hr.ODline{margin-left:5px;border:thin solid #c6c8c9;position:absolute;display:inline}.ODtitle{display:none;}font:hover span.ODtitle{z-index:999;background-color:white;position: absolute;margin-left:15px;margin-top:-1px;padding-left:5px;padding-right:5px;display:inline;border:thin solid #c6c8c9}</style>")

			// remember how many books have searched
			previousSize = $("table#books tr").size()
			getODAvailability()
		}
	}, 10, settings);
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	listingStr = "<font color=gray>not found</font>"
	for (bookIndex in message.books) {
		book = message.books[bookIndex]

		// reset listingStr if starting a new row, otherwise add a line break
		if (bookIndex == 0) {
			listingStr = ""
		} else {
			listingStr += "<br>"
		}
		// if an audiobook, add a headphone icon
		if (book.isaudio) {
			isaudio = "<img class=ODaudio src='" + chrome.extension.getURL('icons/headphones.svg') + "' height=8px width=8px>"
		} else {
			isaudio = ""
		}

		if (book.copies > 0) { // if available copies found
			listingStr += "<font class='ODcopy' color=#080>" + book.copies + " available" + isaudio + "<hr width=10px class=ODline><span class='ODtitle'>" + book.title + "</span></font>"
		} else if (book.copies == -1) { // if no copies found
			listingStr = "<font color=gray>not found</font>"
		} else if (book.total >= 0 && book.waiting >= 0) { // if there's a wait list
			listingStr += "<font class='ODcopy' color=#C80>" + book.waiting + "/" + book.total + " holds" + isaudio + "<hr width=10px class=ODline><span class='ODtitle'>" + book.title + "</span></font>"
		} else { // unknown error occured
			listingStr += "<font class='ODcopy' color=red>N/A<span class='ODtitle'>" + book.title + "</span></font>"
		}
	}

	// inject listing into table cell based on message.id
	$("td.ODAVAIL" + message.id).html('<a target="_blank" href="' + message.url + '">' + listingStr + '</a>')

});