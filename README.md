# Geolocation Tracking Demo

Share your location with everyone in a session and see them all on one map, in real time. Try it on [PubNub's website](https://www.pubnub.com/demos/geolocation-demo/), or follow the [tutorial](https://www.pubnub.com/tutorials/geolocation-tracking-tutorial-javascript/).

<p align="middle">
  <img src="/images/geo-tracker.png" alt="Two users in one session on the map"/>
</p>

The demo runs in the browser with the [PubNub JavaScript SDK](https://www.pubnub.com/docs/sdks/javascript) and these PubNub features:

* **Messages:** every position goes to the session channel in real time.
* **[Presence](https://www.pubnub.com/docs/presence/overview):** the number of active users in the session.
* **[Message Persistence](https://www.pubnub.com/docs/data-storage/message-history/overview):** the last known position of everyone in the session when you join.
* **[Functions](https://www.pubnub.com/docs/message-processing/serverless/overview) (optional):** `functions/location-facts.js` asks the [OpenAI API](https://developers.openai.com/api/docs) for facts about your location and sends them back to you.

The map uses [Leaflet](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/) tiles, so it needs no API key. OpenStreetMap's tile servers aren't meant for heavy use ([tile usage policy](https://operations.osmfoundation.org/policies/tiles/)); in production, use a tile provider.

Tested with the PubNub JavaScript SDK 13.1.2 (October 2026).

## Run it

1. Create a PubNub keyset in the [Admin Portal](https://admin.pubnub.com/) (free account). Under **Presence**, choose **All channels**; Message Persistence is on by default. Or create it from your AI coding tool with the [PubNub MCP Server](https://www.pubnub.com/docs/ai-development/set-up-mcp-server).
2. Clone the repository and put your publish and subscribe keys into `js/app.js` in place of `YOUR_PUBLISH_KEY` and `YOUR_SUBSCRIBE_KEY`:

	```bash
	git clone https://github.com/PubNubDevelopers/Geolocation-Demo.git
	cd Geolocation-Demo
	```
3. Serve the folder on localhost, for example with `npx serve .` or `python3 -m http.server 8000`, and open it in your browser. Browsers only share your location with pages on `https://` or `localhost`.
4. Allow location access. Use **Copy invite link** to open the same session in another browser or on your phone.

For the location facts, deploy `functions/location-facts.js` as an After Publish Function on the channel pattern `facts-request.*`, with your OpenAI API key in the Function secret `OPENAI_API_KEY`. The tutorial has the steps.

For more geolocation use cases and strategies, such as geofencing, our solution architect and support teams can help. Contact sales@pubnub.com
