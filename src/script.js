// This script is injected by inject.js into the TV listing DOM and run in its context

// add a link for the listing
$("ul.tab-list").append("<a href=>Login to Overdrive");


// closure function to set movie score returned from RT search
function setMovieRTScoreListener(movie, movieid) {
  return function(event) {
    if (event.data.type && (event.data.type == "FROM_TS_EXTENSION" + movieid)) {
      if(event.data.score) {
        movie.RTUserScore = event.data.score
        if(event.data.isAudience) {
          movie.isAudienceScore = event.data.isAudience
        }
      }      
      
      if(event.data.url) {
        movie.url = event.data.url
      }
      
      if (!movie.PosterURI) {
        movie.PosterURI = event.data.posterURI;
      }
      
      // remove ourselves as a listener
      event.target.removeEventListener(event.type, arguments.callee);
      outStandingRTCalls--;
      $("div#status").text("Loaded score for "+movie.ProgramName);
    }
  }
};

function getReviews(channel) {
  // fetch each day specified
  $("tr.bookalike").each(function(index, value) {
    // get the showing listing for this day
	id = $(this).attr("id")
	title = $(this, "td.title a").text()
	author = $(this, "td.author a").text()
	console.log(id + " - " + title + " - " + author + " - ")
	//window.addEventListener('message', setPosterListener);
    //window.postMessage({ type: 'FROM_GR_PAGE', title: , year:year, cast:cast }, '*' );
      }
    });
  }
};

// lazy man throttling: once all ajax calls have finished, start up another channel's worth
$(document).ajaxStop(function() {
  if (fetchMovies) {
    // if we finished grabbing all movies for one channel and there are still channels left, fetch the next one
    if (channellist.length) {
      channel = channellist.pop();
      progress += parseInt(progressInc);
      jQuery( "#progress" ).text(progress+ "%")
      //console.log("Fetching channel " + channel + ". " + channellist.length + " left.");
      getMovies(channel);
      return;
    }

    // only run once finished
    if (resultsPageRan == 0) {
      // wait for RT requests to come back
      var readyStateCheckInterval = setInterval(function() {
        if(outStandingRTCalls < 1) {
          clearInterval(readyStateCheckInterval);
          
          // sort movies by Rotten Tomato score
          sortedMovies = [];
          for (i in movies) {
            sortedMovies.push(movies[i]);
          }
          sortedMovies.sort(function(a, b) {
            aa = a.RTUserScore;
            bb = b.RTUserScore;
            // if a TV movie, lose a tie
            if(a.Rating.indexOf("TV") > -1) { aa -= .1; }
            if(b.Rating.indexOf("TV") > -1) { bb -= .1; }
            // if only an audience rating, put it last in a tie 
            if(a.isAudienceScore) { aa -= .5; }
            if(b.isAudienceScore) { bb -= .5; }
            // if no score found, put at the bottom
            if (!aa || aa.length == 0) { aa = -1 }
            if (!bb || bb.length == 0) { bb = -1 }
            // if no score found and MA, put at the very bottom
            if (!aa || aa.length == 0 && a.Rating.indexOf("MA")) { aa = -2 }
            if (!bb || bb.length == 0 && b.Rating.indexOf("MA")) { bb = -2 }
            return bb - aa;
          });

          // add movies results to our table
          table = "<center><br><table width=70%><tr><th colspan=4><center><h3>Movie Description</h3></center></th><th><h3>Record showing</h3></th></tr>";
          for (i in sortedMovies) {
            movie = sortedMovies[i];
            
            if (movie.PosterURI) {
              if (movie.PosterURI.indexOf("http://") != 0) {
                movie.PosterURI = "http://fiostvmercurydata.verizon.net/mercury/cdnprodlandingpad/tmsartwork/db_photos/" + movie.PosterURI;
              }
              
              movieid = encodeURI(movie.ProgramName + " " + movie.Year);
              movieidcss = movieid.replace(/[^_a-zA-Z0-9-]/g, '');
              poster = "<img id='"+movieidcss+"' width=104 height=147 src=" + movie.PosterURI + " onError='onImageLoadError(\""+movieid+"\",\""+movie.Year+"\",\""+movie.CastInfo+"\")'>";
            } else {
              poster = "<img id='"+movieidcss+"' width=104 height=147>";
            }
            
            if(movie.isAudienceScore) {
              movie.RTUserScore = "<font color=#86b889>" + movie.RTUserScore + "</font>"
            } else {
              movie.RTUserScore = "<b>" + movie.RTUserScore + "</b>"
            }

            // if the movie has been seen before, gray it out and show the last seen timestamp
            seenTime = localStorage.getItem(movie.ProgramName + " " + movie.Year);
            if (seenTime) {
              seenDate = new Date(0);
              seenDate.setUTCSeconds(seenTime);
              table += "<tr class=seen><td><a class='rt' target=_blank href='"+movie.url+"'>" + poster + "</td><td valign=top><a class='rt' target=_blank href='"+movie.url+"'>" + movie.RTUserScore + "</td>";
              table += "<td valign=top><a class='rt' target=_blank href='"+movie.url+"'>" + movie.ProgramName + " (" + seenDate.getMonth() + "/" + seenDate.getDate() + ")";
            } else {
              table += "<tr class=new><td><a class='rt' target=_blank href='"+movie.url+"'>" + poster + "</td><td valign=top><a class='rt' target=_blank href='"+movie.url+"'>" + movie.RTUserScore + "</td>";
              table += "<td valign=top><a class='rt' target=_blank href='"+movie.url+"'>" + movie.ProgramName;
            }

            table += "</td><td valign=top>" + movie.Year + " (" + movie.Rating + ") " + movie.Description + " <font size=-1>" + movie.CastInfo + " " + "</font></td><td width=225 valign=top>";
            
            // sort showings by most recent
            movie.showings.sort(function(a,b){
              return a.startdate - b.startdate;
            });
            
            for (j in movie.showings) {
              if (j > 0) {
                table += "<br>";
              }
              // for each showing of a movie, add a link to DVR it
              table += "<a class=dvr id=" + i + '-' + j + '>' + movie.showings[j].ChannelId + ' - ' + formatTime(movie.showings[j].startdate) + '<span></span></a>';
            }
            table += '</td></tr>';
          }
          // change body colors to ours
          $("body").attr("bgcolor", "#1e1f1f");
          $("body").attr("text", "#c6c8c9");
          // disable Verizon's scroll callbacks
          $(window).off('scroll');

          // replace the body with our table
          $("body").html("<style>a{color:#cd5151}a.rt{color:#c6c8c9}tr.seen a{color:#767879}tr.seen{color:#767879;}span{display:none;}a:hover span{position: absolute;margin-left:15px;padding-left:5px;margin-right:10px;display:inline;border-left:thin solid #c6c8c9}</style>"
          + "<script></script>"
          + table + "</table><br><a id=mark>Mark All Read</a></center><br><br><br><br>");
          
          checkForDVROverlaps();
          
          // Mark All Read link
          $("#mark").click(function(event) {
            c = 0;
            for (i in sortedMovies) {
              c++;
              localStorage.setItem(sortedMovies[i].ProgramName + " " + sortedMovies[i].Year, new Date().getTime());
            }
            $("td").css("color", "#767879");
            $("td a").css("color", "#767879");
            alert("Marked "+c+" movies as read.");
            event.preventDefault()
          });
          resultsPageRan = 1;
          
          // when showing link is clicked, attempt to record it
          $("a.dvr").click(function() {
            id = $(this).attr("id")
            movie = sortedMovies[id.replace(/-.*/, '')];
            showing = movie.showings[id.replace(/.*-/, '')];
            $(this).text("Setting...");
            $.get(
              'https://www.verizon.com/fiostv/myservices/Members/Handlers/Schedule.ashx?Action=SetRecording&BASIC_PCATID=&ChannelId=' + showing.ChannelId + '&Duration=' + showing.Duration + '&FiosId=59604308&Page=&PrgmName=' + movie.ProgramName.toUpperCase() + '&SN=' + SN + '&STBID=' + stbin + '&StartTime=' + showing.IntStartTime + '&StationId=' + showing.StationId, 
              parseDVRRequest(showing, $(this))
            );
            event.preventDefault();
          });
          
          // keep results page from timing out
          setInterval(function() {  
            $.get("https://www.verizon.com/fiostv/myservices/TVListingHandler.aspx?Action=ChannelSchedule&ChannelId=" + 1 + "&SN=" + SN + "&daycount=" + 1);
          }, 20000);
          
        } else if(loadFinishedTime == 0) {
          loadFinishedTime = new Date().getTime();
        // give outstanding RT calls 10 seconds to finish up
        } else if(loadFinishedTime + 10000 < new Date().getTime()) {
          outStandingRTCalls = -99;
        }
      }, 1000);
    }
  }
});

function parseDVRRequest(showing, tag) {
  return function(data) {
    if(String(data).indexOf("RFPRecedIcon") > -1) {
      // success!
      tag.text("Recording Set");
      tag.css("color","#cd5151");
      dvr.push(new Recording(showing.ProgramName, showing.ChannelId, showing.startdate, showing.Duration, true));
      checkForDVROverlaps();
    } else if(String(data).indexOf("This Program is already scheduled for recording.") > -1) { 
      tag.text("Recording already set");
    } else if(String(data).indexOf("The selected DVR indicates") > -1) {
      tag.text("Conflict!");
      tag.css("color","#ff0000");
    } else if(String(data).indexOf("Cannot record a program in the past time") > -1) {
      tag.text("Cannot record in the past");
      tag.css("color","#ff0000");
    } else {
      tag.text("Unknown Error!"+data);
      tag.css("color","#ff0000");
    }
  }
}

// listen for when a poster image from RT comes back
function setPosterListener(event) {
  if (event.data.type && (event.data.type.indexOf("FROM_TS_EXTENSION") == 0)) {
    movieid = event.data.type.replace(/FROM_TS_EXTENSION/, '').replace(/[^_a-zA-Z0-9-]/g, '');
    $("img#" + movieid).attr("src", event.data.posterURI);
  }
};

// some of verizon's images don't load, so go fetch them from RT if that happens
function onImageLoadError(movieid, year, cast) {
  window.addEventListener('message', setPosterListener);
  window.postMessage({ type: 'FROM_TS_PAGE', movie: movieid, year:year, cast:cast }, '*' );
};

function checkForDVROverlaps() {
  $("a.dvr").each(function(index, value) {
    id = $(this).attr("id")
    movie = sortedMovies[id.replace(/-.*/, '')-0];
    showing = movie.showings[id.replace(/.*-/, '')-0];
    
    // check if already recording
    for(i in dvr) {
      if(dvr[i].name == movie.ProgramName && +dvr[i].start == +showing.startdate)
      {
        $(this).css("color","#51ad51");
        $(this).find("span").text("Already set to record");
        return;
      }
    }
    
    overlap = doesDVROverlap(showing.startdate, showing.Duration);
    
    // if there is a conflict
    if(overlap) {
      $(this).css("color","#969899");
      $(this).find("span").html(overlap);
    } else {
      $(this).css("color","#cd5151");
      $(this).find("span").text("");
    }
  });
};