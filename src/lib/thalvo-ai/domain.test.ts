import assert from "node:assert/strict";
import test from "node:test";
import { answerFromTraining, classifyMarineDomain, offTopicReply } from "./domain.ts";

test("stays inside seamanship, machinery, and weather", () => {
  assert.equal(classifyMarineDomain("Motor hararet yaptı"), "machinery");
  assert.equal(classifyMarineDomain("Göcek'te deniz durumu nasıl?"), "weather");
  assert.equal(classifyMarineDomain("Bu rüzgârda alargaya demirlenir mi?"), "seamanship");
  assert.equal(classifyMarineDomain("Bana bir pasta tarifi ver"), "outside");
});

test("machinery answer uses the plain-language report and does not invent a part code", async () => {
  const reply = await answerFromTraining({
    text: "Motor hararet yaptı",
    lang: "tr",
    position: null,
  });
  assert.equal(reply.domain, "machinery");
  assert.match(reply.text, /Sade Dil Raporu/);
  assert.match(reply.text, /impeller/i);
  assert.doesNotMatch(reply.text, /parça kodu:\s*\d/i);
});

test("off-topic refusal names the three subjects", () => {
  assert.match(offTopicReply("tr"), /deniz/);
  assert.match(offTopicReply("tr"), /makine/);
  assert.match(offTopicReply("tr"), /hava/);
});

test("weather without a place asks instead of inventing a wave height", async () => {
  const reply = await answerFromTraining({
    text: "Deniz durumu nasıl?",
    lang: "tr",
    position: null,
  });
  assert.equal(reply.domain, "weather");
  assert.match(reply.text, /Göcek/);
  assert.doesNotMatch(reply.text, /\d+(\.\d+)? m/);
});
