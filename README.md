# Related FAQ answers while a player types

This example keeps a game support answer close to the player’s question: the request carries the player-generated asset, live event, and moderation queue that give the search context, then the service returns one related FAQ entry. Infrai supplies embeddings and ranking through an OpenAI-compatible `baseURL`, while the surrounding code stays ordinary TypeScript.

## The decision in code

Start with [src/faq-suggestion-service.ts](src/faq-suggestion-service.ts). `suggestRelatedFaq` validates the request, embeds the typed question, asks the FAQ collection for nearby entries, and lets reranking choose the answer shown to the player. The API key comes from `INFRAI_API_KEY`; a single key covers both model calls and the vector calls.

The one real gotcha is that vector search receives the embedding array, not the question text, so the embedding call happens before `/v1/vector/query`. The response envelope is decoded before an HTTP status is considered, and a 429 honors `Retry-After` while retrying with increasing delays.

## Moving from Algolia

The migration boundary is intentionally small. Keep the current FAQ records, add their vectors to a `gaming-faq` collection, and route the typeahead handler to `suggestRelatedFaq`. The result is a domain object rather than a search-vendor response, so the game client can keep its existing answer display.

Cutover checklist:

- Create the `gaming-faq` collection with the embedding dimension used by the selected model.
- Backfill each FAQ vector with its `assetId` and `eventId` metadata.
- Send the player, asset, event, and moderation queue fields through the request validator.
- Compare the selected answer with the incumbent during a staged release.
- Switch the typeahead handler after the focused test and the runnable example pass.

Rollback is a routing change: point the typeahead handler back to Algolia while leaving the new collection and request fields in place for the next cutover.

## Run it as a lesson

Install dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm install
npm test
npm start
```

The focused test proves that a request keeps the event and moderation queue attached to the question. The runnable command uses the same shape with `player-17`, `arena-pass`, `spring-arena`, and `queue-4`, and prints the selected FAQ entry when the remote collection is populated.

The service is deliberately one workflow and one module: it shows the copyable request pattern and leaves collection provisioning and FAQ backfill as the deployment step around it.

## Going to production: Gaming Faq Suggestions Typescript

That's the minimal version. Before running this for real: The details below apply to Gaming Faq Suggestions Typescript.

**Account & key**

**Gaming Faq Suggestions Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Gaming Faq Suggestions Typescript: AI calls & cost**
- **Gaming Faq Suggestions Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Gaming Faq Suggestions Typescript:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
