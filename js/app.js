// Geolocation tracker: everyone in a session shares their location on one map.
// Positions are messages on the session channel. Presence counts who's in the session, and
// Message Persistence gives the last known position of everyone who shared one.

function getParameterByName (name, url = window.location.href) {
  return new URL(url).searchParams.get(name)
}

function makeid (length) {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

// Letters, digits, spaces and basic punctuation only, up to maxLength characters.
function cleanText (text, maxLength) {
  return String(text ?? '').replace(/[^\p{L}\p{N} .,!?'-]/gu, '').substring(0, maxLength).trim()
}

// The session channel comes from the invite link (?channel=...), or a new one is made.
let sessionChannel = String(getParameterByName('channel') ?? '').replace(/[^A-Za-z0-9]/g, '').substring(0, 20) || makeid(5)
document.getElementById('channel-label').textContent = sessionChannel
window.history.replaceState(null, '', '?channel=' + sessionChannel)

// Keep the same User ID, name and greeting while the tab is open.
const userId = sessionStorage.getItem('userId') || makeid(15)
sessionStorage.setItem('userId', userId)
let username = sessionStorage.getItem('username')
if (!username) {
  username = cleanText(prompt('Please enter your name to join the session.'), 30) || 'ANON_' + makeid(4)
  sessionStorage.setItem('username', username)
}
let greeting = sessionStorage.getItem('greeting') || 'Not set.'

const pubnub = new PubNub({
  publishKey: 'YOUR_PUBLISH_KEY',
  subscribeKey: 'YOUR_SUBSCRIBE_KEY',
  userId: userId
})

// Map: Leaflet with OpenStreetMap tiles, no API key needed.
const map = L.map('map-canvas').setView([37.7749, -122.4194], 2)
// OpenStreetMap's tile servers are fine for a tutorial. For production, use a tile provider: see the tutorial.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map)
let layers = L.layerGroup().addTo(map) // The markers and paths of the current session.
let markers = {} // User ID → marker
let paths = {} // User ID → path, when "Plot New Paths" is on

let lastPosition = null // Your last position: { lat, lng }
let lastFactsPosition = null // Where you were when the app last asked for facts
const FACTS_DISTANCE_MILES = 5 // Ask for new facts after you've moved this far.

// Subscriptions: the session channel with presence events, and your own channel for the AI facts.
let sessionSubscription = null
const factsSubscription = pubnub.channel('facts.' + userId).subscription()
factsSubscription.onMessage = event => showFacts(event.message)

function subscribeToSession () {
  sessionSubscription = pubnub.channel(sessionChannel).subscription({ receivePresenceEvents: true })
  // A position from someone in the session (or from you): move their marker.
  sessionSubscription.onMessage = event => {
    const update = readPosition(event.message, event.publisher, event.timetoken)
    if (update) showUser(update)
  }
  // Someone joined or left: update the count. state-change events carry no occupancy.
  sessionSubscription.onPresence = event => {
    if (event.action !== 'state-change') setActiveUsers(event.occupancy)
  }
  sessionSubscription.subscribe()
}

pubnub.addListener({
  status: statusEvent => {
    if (statusEvent.category === 'PNConnectedCategory') updateActiveUsers()
  }
})

subscribeToSession()
factsSubscription.subscribe()
loadLastPositions()

// Leave the session when the tab closes, so the count drops for the others right away.
window.addEventListener('pagehide', () => {
  sessionSubscription.unsubscribe()
  factsSubscription.unsubscribe()
})
// Back button: the browser restored this page from its cache, so subscribe again.
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    sessionSubscription.subscribe()
    factsSubscription.subscribe()
  }
})

// Anyone with your keys can publish on the channel, so only accept positions with the expected shape.
// The marker belongs to the publisher, not to an ID inside the message.
function readPosition (message, publisher, timetoken) {
  if (!message || typeof message !== 'object') return null
  const lat = Number(message.lat)
  const lng = Number(message.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return {
    userId: publisher,
    username: (typeof message.username === 'string' && cleanText(message.username, 30)) || 'ANON',
    greeting: (typeof message.greeting === 'string' && cleanText(message.greeting, 100)) || 'Not set.',
    lat,
    lng,
    lastSeen: new Date(Number(timetoken) / 10000) // A timetoken counts 100-nanosecond intervals.
  }
}

// Show or move a user's marker, with their name on it and the details in a popup.
function showUser (update) {
  const latLng = [update.lat, update.lng]
  let marker = markers[update.userId]
  if (!marker) {
    marker = L.marker(latLng).addTo(layers)
    marker.bindTooltip(textElement([update.username]), { permanent: true, direction: 'top', offset: [-15, -12] })
    marker.bindPopup(textElement([]))
    markers[update.userId] = marker
  } else {
    marker.setLatLng(latLng)
  }
  // Elements built with textContent, so a name or greeting can't inject HTML.
  marker.setTooltipContent(textElement([update.username]))
  marker.setPopupContent(textElement([
    'Name: ' + update.username,
    'Last seen: ' + update.lastSeen.toLocaleString(),
    'Lat: ' + update.lat,
    'Long: ' + update.lng,
    'Greeting: ' + update.greeting
  ]))

  if (document.getElementById('plotnewswitch').checked) {
    if (paths[update.userId]) paths[update.userId].addLatLng(latLng)
    else paths[update.userId] = L.polyline([latLng], { color: '#C70E20' }).addTo(layers)
  } else if (paths[update.userId]) {
    paths[update.userId].remove()
    delete paths[update.userId]
  }
  fitView()
}

function textElement (lines) {
  const div = document.createElement('div')
  lines.forEach((line, i) => {
    if (i > 0) div.append(document.createElement('br'))
    div.append(line)
  })
  return div
}

function fitView () {
  const points = Object.values(markers).map(marker => marker.getLatLng())
  if (document.getElementById('fitviewswitch').checked && points.length > 0) {
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
  }
}

// Ask PubNub how many users are in the session right now.
async function updateActiveUsers () {
  try {
    const result = await pubnub.hereNow({ channels: [sessionChannel] })
    setActiveUsers(result.totalOccupancy)
  } catch (error) {
    console.log(error)
  }
}

function setActiveUsers (count) {
  if (Number.isFinite(count)) document.getElementById('active-label').textContent = count
}

// Show everyone's last known position: the latest of the last 100 positions in the session.
async function loadLastPositions () {
  try {
    const result = await pubnub.fetchMessages({ channels: [sessionChannel], count: 100 })
    const latest = {}
    for (const item of result.channels[sessionChannel] || []) {
      const update = readPosition(item.message, item.uuid, item.timetoken)
      if (update) latest[update.userId] = update // Oldest first, so later positions win.
    }
    Object.values(latest).forEach(showUser)
  } catch (error) {
    console.log(error)
  }
}

// Your location from the browser. Every update goes to the session channel.
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(onPosition, error => console.log('Location not available:', error.message))
} else {
  alert('This browser can\'t share its location.')
}

function onPosition (position) {
  if (document.getElementById('locationshareswitch').checked) return // "Don't Update My Location"
  lastPosition = { lat: position.coords.latitude, lng: position.coords.longitude }
  publishPosition()
  askForFacts(lastPosition)
}

function publishPosition () {
  if (!lastPosition) return
  publishMessage(sessionChannel, { username, greeting, lat: lastPosition.lat, lng: lastPosition.lng })
}

async function publishMessage (channel, message) {
  try {
    await pubnub.publish({ channel, message })
  } catch (error) {
    console.log(error)
  }
}

// Optional AI facts: publish your position on facts-request.<User ID>. A PubNub Function on facts-request.*
// asks OpenAI about the place and publishes the answer on facts.<User ID> (see functions/location-facts.js).
let factsTimer = 0
const factsArea = document.getElementById('location-details-text')

function askForFacts (position) {
  if (lastFactsPosition && distanceMiles(lastFactsPosition, position) <= FACTS_DISTANCE_MILES) return
  lastFactsPosition = position
  publishMessage('facts-request.' + userId, { lat: position.lat, lng: position.lng })
  factsArea.value = 'Asking for facts about your location...'
  clearTimeout(factsTimer)
  factsTimer = setTimeout(() => {
    factsArea.value = 'No answer. To see facts about your location here, set up the optional location facts Function (see the tutorial).'
  }, 20000)
}

// Type the answer out character by character.
function showFacts (message) {
  if (!message || typeof message.text !== 'string') return
  clearTimeout(factsTimer)
  const text = message.text.substring(0, 2000)
  factsArea.value = ''
  let i = 0
  const typing = setInterval(() => {
    if (i < text.length) factsArea.value += text[i++]
    else clearInterval(typing)
  }, 20)
}

// Distance between two positions on Earth (haversine formula).
function distanceMiles (from, to) {
  const toRadians = degrees => degrees * Math.PI / 180
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) // Earth's radius in miles
}

// Session controls
document.getElementById('newsession').addEventListener('click', () => {
  if (!confirm('Are you sure you want to create a new session? You\'ll start as the only participant.')) return
  sessionSubscription.unsubscribe()
  layers.remove()
  layers = L.layerGroup().addTo(map)
  markers = {}
  paths = {}
  sessionChannel = makeid(5)
  document.getElementById('channel-label').textContent = sessionChannel
  window.history.replaceState(null, '', '?channel=' + sessionChannel)
  subscribeToSession()
  loadLastPositions()
  publishPosition()
})

function inviteLink () {
  return window.location.href.split('?')[0] + '?channel=' + sessionChannel
}

document.getElementById('newinvite').addEventListener('click', () => {
  const email = prompt('Please enter an email to invite.')
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const body = 'Join me and share locations on the GEO Track App: ' + inviteLink()
    window.open('mailto:' + encodeURIComponent(email) + '?subject=GEO%20Track%20Invite&body=' + encodeURIComponent(body))
  }
})

document.getElementById('newinvitelink').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(inviteLink())
    alert('Invite link copied.')
  } catch (error) {
    prompt('Copy the invite link:', inviteLink())
  }
})

// Name and greeting: saved for this tab and sent with your next position, so the others see them at once.
document.getElementById('button-changeusername').addEventListener('click', () => {
  username = cleanText(document.getElementById('input-changeusername').value, 30) || username
  sessionStorage.setItem('username', username)
  publishPosition()
})

document.getElementById('send-greet').addEventListener('click', () => {
  greeting = cleanText(document.getElementById('input-greet').value, 100) || 'Not set.'
  sessionStorage.setItem('greeting', greeting)
  publishPosition()
})
