// PubNub Function (After Publish or Fire) on the channel pattern facts-request.*
// The app fires { lat, lng } on facts-request.<User ID>. This Function asks the OpenAI Responses API for
// a few facts about that place and publishes them as { text } on facts.<User ID>, which the app subscribes to.
// Set your OpenAI API key as the Function secret OPENAI_API_KEY.

const MODEL = 'gpt-6-luna' // A fast, low-cost model. See https://developers.openai.com/api/docs/models
const MAX_OUTPUT_TOKENS = 300

export default async (request) => {
  const xhr = require('xhr')
  const vault = require('vault')
  const pubnub = require('pubnub')

  try {
    const message = request.message || {}
    const lat = Number(message.lat)
    const lng = Number(message.lng)
    // Anyone with the keys can publish here, so only send real coordinates to OpenAI.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return request.ok()
    }

    const apiKey = await vault.get('OPENAI_API_KEY')
    const response = await xhr.fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 9000, // The default is 5 s; a Function may run for up to 10 s.
      body: JSON.stringify({
        model: MODEL,
        instructions: 'You give short, interesting facts about places. Answer in plain text, at most 5 sentences. ' +
          'If you can\'t tell where the coordinates are, say so in one sentence.',
        input: `Tell me about the place at latitude ${lat}, longitude ${lng}: where it is and a few facts about it.`,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'none' }, // Reasoning tokens count against max_output_tokens; facts don't need them.
        store: false // Don't keep the request and the answer on OpenAI.
      })
    })
    // The text is in the output_text parts of the message items; don't assume it's the first item.
    const output = JSON.parse(response.body).output || []
    const text = output
      .filter(item => item.type === 'message')
      .flatMap(item => item.content || [])
      .filter(part => part.type === 'output_text')
      .map(part => part.text)
      .join('')
      .trim()
    if (!text) return request.ok()

    const userId = request.channels[0].substring('facts-request.'.length)
    await pubnub.publish({ channel: `facts.${userId}`, message: { text } })
    return request.ok()
  } catch (error) {
    // xhr.fetch() rejects on non-2XX answers too, e.g. a wrong key (401). The Debug tab shows this log.
    console.log('Location facts failed:', error)
    return request.ok() // After Publish: the request was already delivered, ok() just ends this run.
  }
}
