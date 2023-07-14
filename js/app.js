function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * 
charactersLength));
}
return result;
}

var GEOchannel = getParameterByName('channel'); // Get channel or make a new channel
if (!GEOchannel) {
    GEOchannel = makeid(5);
}
document.getElementById("channel-label").innerHTML = GEOchannel;
var orglocation = window.location.href; // This is saved for the interactive demo on PubNub.com. It is not part of the demo of this application. 
window.history.replaceState(null, null, "?channel="+GEOchannel);

var UUID = getParameterByName('uuid'); // Allows you to force a uuid
if (!UUID) {
    let savedUUID = sessionStorage.getItem('uuid');
    if (!savedUUID) {
        UUID = makeid(15); // Make new UUID
    } else {
        UUID = savedUUID;
    }
}
sessionStorage.setItem('uuid', UUID);

var username = getParameterByName('username'); // Allows you to force a name
if (!username) {
    let savedusername = sessionStorage.getItem('username');
    if (!savedusername) {
        let input = prompt("Please enter your name to join the channel.");
        if (input == null || input == "") {
            username = "ANON_"+makeid(4); // If they dont give a name and no saved name then make them anonymous 
        } else {
            username = input.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30);
        }
    } else {
        username = savedusername;
    }
}
sessionStorage.setItem('username', username);

var pubnub = new PubNub({
  publishKey:   'pub-c-481aaaf6-951b-495f-ad54-f71f4b372da9',
  subscribeKey: 'sub-c-0c599162-7971-11ec-add2-a260b15b99c5',
  uuid: UUID
});

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(showPosition);
    } else {
        alert("Not sharing location. Please refresh and try again to share.");
    }
}

async function showPosition(position) {
   if ( document.getElementById('locationshareswitch').checked === false ) { 
    //Set the channel members
    var uuids = [
        UUID,
        { id: UUID, custom: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            username: username,
            greeting: greeting
        }},
    ]; 
    setChannelMembers(GEOchannel, uuids);
    var message = { 
        uuid:UUID, 
        username:username, 
        greeting: greeting, 
        lat:position.coords.latitude, 
        lng:position.coords.longitude
    };

    //Update with coordinates,
    publishMessage(GEOchannel, message);
    // For future feature: playback of user history
    publishMessage(GEOchannel+"."+UUID, message);
   }
}

var map;
var mark = [];
var lineCoords = {};
var lineCoordinatesPath = [];
var bounds = [];
var lastLat = "";
var lastLng = "";
var greeting = sessionStorage.getItem('greeting');
if (!greeting) {
    greeting = "Not set.";
}

var initialize = function() {
    var myLatlng = new google.maps.LatLng(37.7749,122.4194);
    map  = new google.maps.Map(document.getElementById('map-canvas'), {
        zoom: 2,
        center: myLatlng
    })
    bounds  = new google.maps.LatLngBounds();
};

window.initialize = initialize;

var redraw = function(payload) {
    if (payload.channel == GEOchannel) {
        var lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
        };
        var lat = payload.message.lat;
        var lng = payload.message.lng;
        lastLat = lat;
        lastLng = lng;
        var uuid = payload.message.uuid;
        var displayName = payload.message.username;
        var greeting = payload.message.greeting;
        var lastseen = new Date(payload.timetoken.substring(0, 10)*1000);
        loc = new google.maps.LatLng(lat, lng);
        if ( document.getElementById('plotnewswitch').checked === false ) {
            lineCoords = [];
            if (mark[uuid] && mark[uuid].setMap) {
                mark[uuid].setMap(null);
            }
            if (lineCoordinatesPath[uuid] && lineCoordinatesPath[uuid].setMap) {
                lineCoordinatesPath[uuid].setMap(null);
            }
            mark[uuid] = new google.maps.Marker({
                position:loc,
                map:map,
                label: {
                    text: displayName,
                    color: "#000000",
                    fontWeight: "bold"
                }
            });

            var content = "Name: " + displayName + '<br>' + "Last Seen: " + lastseen + '<br>' + "Lat: " + lat +  '<br>' + "Long: " + lng +  '<br>' + "Greeting: " + greeting;  

            var infowindow = new google.maps.InfoWindow();

            var markdata = mark[uuid];

            google.maps.event.addListener(mark[uuid], 'click', (function(markdata,content,infowindow){ 
                return function() {
                    infowindow.setContent(content);
                    infowindow.open(map,markdata);
                    actionCompleted({action: 'View User Details', windowLocation: orglocation}); // This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
                    google.maps.event.addListener(map,'click', function(){ 
                        infowindow.close();
                    });  
                };
            })(markdata,content,infowindow));  

            mark[uuid].setMap(map);
        } else {
            if (typeof lineCoords[uuid] == 'undefined' || lineCoords[uuid].length == 0) {
                lineCoords[uuid] = [];
            }
            if (mark[uuid] && mark[uuid].setMap) {
                mark[uuid].setMap(null);
            }
            if (lineCoordinatesPath[uuid] && lineCoordinatesPath[uuid].setMap) {
                lineCoordinatesPath[uuid].setMap(null);
            }
            lineCoords[uuid].push(loc);
            lineCoordinatesPath[uuid] = new google.maps.Polyline({
                path: lineCoords[uuid],
                icons: [{
                    icon: lineSymbol,
                    repeat: '35px',
                    offset: '100%'
                }],
                geodesic: true,
                strokeColor: '#C70E20'
            });
            lineCoordinatesPath[uuid].setMap(map);

            mark[uuid] = new google.maps.Marker({
                position:loc,
                map:map,
                label: {
                    text: displayName,
                    color: "#000000",
                    fontWeight: "bold"
                }
            });

            var content = "Name: " + displayName + '<br>' + "Last Seen: " + lastseen + '<br>' + "Lat: " + lat +  '<br>' + "Long: " + lng +  '<br>' + "Greeting: " + greeting;  

            var infowindow = new google.maps.InfoWindow();

            google.maps.event.addListener(mark[uuid], 'click', function() {
                infowindow.setContent(content);
                infowindow.open(map,mark[uuid]);
                google.maps.event.addListener(map,'click', function(){ 
                    infowindow.close();
                });      
            });
        
            mark[uuid].setMap(map);
        }
        bounds.extend(loc);
        if (document.getElementById('fitviewswitch').checked) {
            map.fitBounds(bounds);       
            map.panToBounds(bounds); 
        }
    } else if (payload.channel ==  GEOchannel+".greet") {
        alert(payload.message);
    }    
};

pubnub.subscribe({
    channels: [GEOchannel, GEOchannel+'.greet'], 
    withPresence: true
});

pubnub.addListener({
    message:redraw,
    presence: (presenceEvent) => {
        document.getElementById("active-label").innerHTML = presenceEvent.occupancy;
    },
});

getLocation();

getCurrentUsers();

async function getCurrentUsers() {
    try {
        const hereNowResult = await pubnub.hereNow({
            channels: [GEOchannel],
        });
    } catch (status) {
        console.log(status);
    }
}

async function loadLastLocations(loadChannel) {
    try {
        const response = await pubnub.objects.getChannelMembers({
            channel: loadChannel,
            include: {
                customFields: true,
                UUIDFields: true,
                customUUIDFields: true,
            }
        });
        var arrayLength = response.data.length;
        for (var i = 0; i < arrayLength; i++) {
            if (response.data[i].uuid.id != UUID && response.data[i].custom) {
                loc = new google.maps.LatLng(response.data[i].custom.lat, response.data[i].custom.lng);
                mark[response.data[i].uuid.id] = new google.maps.Marker({
                    position:loc,
                    map:map,
                    label: {
                        text: response.data[i].custom.username,
                        color: "#000000",
                        fontWeight: "bold",
                    }
                });

                console.log(response.data[i]);

                var lastseen = new Date(response.data[i].updated);

                var content = "Name: " + response.data[i].custom.username + '<br>' + "Last Seen: " + lastseen + '<br>' + "Lat: " + response.data[i].custom.lat +  '<br>' + "Long: " + response.data[i].custom.lng +  '<br>' + "Greeting: " + response.data[i].custom.greeting;  

                var infowindow = new google.maps.InfoWindow();

                var markdata = response.data[i];

                google.maps.event.addListener(mark[markdata.uuid.id], 'click', (function(markdata,content,infowindow){ 
                    return function() {
                        infowindow.setContent(content);
                        infowindow.open(map,mark[markdata.uuid.id]);
                        google.maps.event.addListener(map,'click', function(){ 
                            infowindow.close();
                        });  
                    };
                })(markdata,content,infowindow));  
                

                mark[response.data[i].uuid.id].setMap(map);
                bounds.extend(loc);
            }
        }
        if (document.getElementById('fitviewswitch').checked) {
            map.fitBounds(bounds);       
            map.panToBounds(bounds); 
        }
    } catch (status) {
        console.log("Get Channel Members Operation Failed w/Error:", status);
    }
}

loadLastLocations(GEOchannel);

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}
function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function() {
        console.log('Async: Copying to clipboard was successful!');
    }, function(err) {
        console.error('Async: Could not copy text: ', err);
    });
}

document.getElementById("newsession").addEventListener("click", function() {
    if (confirm("Are you sure you want to create a new session? You'll start as the only participant.")) {
        pubnub.unsubscribe({
            channels: [GEOchannel, GEOchannel+'.greet']
        });
        sessionStorage.removeItem('channel');
        map = null;
        bounds = [];
        lineCoords = {};
        lineCoordinatesPath = [];
        GEOchannel = makeid(5);
        document.getElementById("channel-label").innerHTML = GEOchannel;
        window.history.replaceState(null, null, "?channel="+GEOchannel);
        var myLatlng = new google.maps.LatLng(37.7749,122.4194);
        map = new google.maps.Map(document.getElementById('map-canvas'), {
            zoom: 2,
            center: myLatlng
        })
        bounds = new google.maps.LatLngBounds();
        loadLastLocations(GEOchannel); // Load any history on the channel
        pubnub.subscribe({
            channels: [GEOchannel, GEOchannel+'.greet'], 
            withPresence: true
        });
        if ( document.getElementById('locationshareswitch').checked === false ) { // Add self to map.                  
            //Set the channel members
            var uuids = [
                    UUID,
                    { id: UUID, custom: {
                        lat: lastLat,
                        lng: lastLng,
                        username: username,
                        greeting: greeting
                    }},
            ];
            setChannelMembers(GEOchannel, uuids);

            //Publish with updates
            var message = {
                uuid:UUID, 
                username:username, 
                lat:lastLat, 
                lng:lastLng,
                greeting: document.getElementById('input-greet').value 
            }
            publishMessage(GEOchannel, message);

            // For future feature: playback of user history
            publishMessage(GEOchannel+"."+UUID, message)
        }
        actionCompleted({action: 'Create New Session', windowLocation: orglocation}); // This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
    };
}); 

document.getElementById("newinvite").addEventListener("click", function() {
    let input = prompt("Please enter an email to invite.");
    if (input != null || input != "") {
        if (validateEmail(input)) {
            var body = 'Join me and share locations on the GEO Track App. Join with this link: '+window.location.href.split("?")[0]+'?channel='+GEOchannel;
            window.open('mailto:'+input+'?subject=GEO Track Invite&body='+encodeURIComponent(body));
            actionCompleted({action: 'Send Invite', windowLocation: orglocation}); // This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
        }
    }
});

document.getElementById("newinvitelink").addEventListener("click", function() {
    if (confirm("Do you want to copy the link to share your session?")) {     
        copyTextToClipboard(window.location.href.split("?")[0]+'?channel='+GEOchannel);
        actionCompleted({action: 'Send Invite', windowLocation: orglocation}); // This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
    }
});

document.getElementById("button-changeusername").addEventListener("click", function() {
    username = document.getElementById('input-changeusername').value.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30);
    sessionStorage.setItem('username', username);
    //Set the channel members
    var uuids = [
        UUID,
        { id: UUID, custom: {
            lat: lastLat,
            lng: lastLng,
            username: username,
            greeting: greeting
        }},
    ];
    setChannelMembers(GEOchannel, uuids);

    //Publish with updates. // resend last point to update map labels for other users.
    var message = {
        uuid:UUID, 
        username:username, 
        lat:lastLat, 
        lng:lastLng,
        greeting: document.getElementById('input-greet').value
    }
    publishMessage(GEOchannel, message);

    // For future feature: playback of user history
    publishMessage(GEOchannel+"."+UUID, message);
    actionCompleted({action: 'Change Username', windowLocation: orglocation}); //This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
    alert("Your username has been updated.");
    //window.location = window.location.href.split("?")[0]+'?channel='+GEOchannel;
}); 

document.getElementById("send-greet").addEventListener("click", function() {
    //publishMessage(GEOchannel + ".greet", username+" says: "+document.getElementById('input-greet').value);
    sessionStorage.setItem('greeting', document.getElementById('input-greet').value);

    //Set the channel members
    var uuids = [
        UUID,
        { id: UUID, custom: {
            lat: lastLat,
            lng: lastLng,
            username: username,
            greeting: document.getElementById('input-greet').value
        }},
    ];
    setChannelMembers(GEOchannel, uuids);

    //Publish with updates.
    var message = {
        uuid:UUID, 
        username:username, 
        lat:lastLat, 
        lng:lastLng,
        greeting: document.getElementById('input-greet').value 
    }
    publishMessage(GEOchannel, message);

    // For future feature: playback of user history
    publishMessage(GEOchannel+"."+UUID, message);
    actionCompleted({action: 'Send Greeting', windowLocation: orglocation}); // This is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
    alert("You've updated your greeting.");
});

//Set the channel members given the channel and UUIDs
async function setChannelMembers(channel, uuids) {
    try {
        const setChannelResult = pubnub.objects.setChannelMembers({
            channel: channel,
            uuids
        });
    } catch(status) {
        console.log("Set Channel Member Failed w/ error:", status)    
    }
}

//Publish the message given the channel and message
async function publishMessage(channel, message) {
    try {
        const result = await pubnub.publish({
            channel: channel, 
            message: message
        });
    } catch (status) {
        console.log(status);
    }
}

//The below function is for the interactive demo on PubNub.com. It is not part of the demo of this application. 
var actionCompleted = function(args) {
    const pub = 'pub-c-c8d024f7-d239-47c3-9a7b-002f346c1849';
    const sub = 'sub-c-95fe09e0-64bb-4087-ab39-7b14659aab47';
    let identifier = "";
    let action = args.action;
    let blockDuplicateCalls = args.blockDuplicateCalls;
    let debug = args.debug;
    let windowLocation = args.windowLocation;

    if (typeof action === 'undefined')
    {
        console.log('Interactive Demo Integration Error: No action provided');        
        return;
    }

    if (typeof blockDuplicateCalls === 'undefined')
    {
        blockDuplicateCalls = true;
    }

    if (typeof debug === 'undefined')
    {
        debug = false;
    }

    //  If invoked from client-side, you can omit the window location
    if (typeof windowLocation === 'undefined')
        windowLocation = window.location.href;

    var fetchClient = null;
    if (typeof fetch === 'undefined')
        fetchClient = args.fetchClient;
    else
        fetchClient = fetch;

    let queryString = new URL(windowLocation).search.substring(1);
    const urlParamsArray = queryString.split('&');
    for (let i = 0; i < urlParamsArray.length; i++) {
        if (urlParamsArray[i].startsWith('identifier') && urlParamsArray[i].includes('=')) {
            let identifierPair = urlParamsArray[i].split('=');
            identifier = identifierPair[1];
        }
    }
    if (identifier === "") {
        if (debug)
        {
            console.log('Interactive Demo Integration Error: Failed to detect identifier in URL query string');
        }
        return;
    }
    if (blockDuplicateCalls) {
        //  This option only works if the sessionStorage object is defined (client-side only)
        try {
            if (!(typeof sessionStorage === 'undefined')) {
                //  Read the id from session storage and only send the message if the message was not previous sent
                let sessionStorageKey = "Demo_" + identifier + action;
                let storedId = sessionStorage.getItem(sessionStorageKey);
                if (storedId == null) {
                    if (debug)
                        console.log('Setting session key to avoid duplicate future messages being sent. Action: ' + action + '. Identifier: ' + identifier);
                        sessionStorage.setItem(sessionStorageKey, "set");
                }
                else {
                    //  This is a duplicate message, do not send it
                    if (debug)
                        console.log('Message blocked as it is a duplicate. Action: ' + action + '. Identifier: ' + identifier);
                    return;
                }
            }                   
        }
        catch (err) {} //  Session storage is not available
    }

    if (debug)
    {
        console.log('Sending message. Action: ' + action + '. Identifier: ' + identifier);
    }
    
    const url = `https://ps.pndsn.com/publish/${pub}/${sub}/0/demo/myCallback/${encodeURIComponent(JSON.stringify({ id: identifier, feature: action }))}?store=0&uuid=${identifier}`;
    fetchClient(url)
        .then(response => {
        if (!response.ok) {
            throw new Error(response.status + ' ' + response.statusText);
        }
        return response;
    })
        .then(data => {
        //  Successfully set demo action with demo server
        console.log("Guided Demo Integration success", url, data)
    })
        .catch(e => {
        console.log('Interactive Demo Integration: ', e);
    });
    return;
} 