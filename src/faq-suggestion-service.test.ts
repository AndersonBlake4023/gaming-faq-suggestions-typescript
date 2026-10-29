import assert from "node:assert/strict";
import test from "node:test";
import { validateSuggestionRequest } from "./faq-suggestion-service.ts";

test("the request boundary keeps the four game records together", () => {
  const request = validateSuggestionRequest({ playerId: "p1", question: "Where is my reward?", assetId: "reward-chest", eventId: "spring-arena", moderationQueueId: "queue-4" });
  assert.equal(request.eventId, "spring-arena");
  assert.equal(request.moderationQueueId, "queue-4");
});
