import assert from "node:assert/strict";
import test from "node:test";
import { answerFromTraining, classifyMarineDomain, offTopicReply } from "./domain.ts";
import { detectBrokerIntent, indicativePriceEur } from "./brokerage.ts";

test("classifies marine, brokerage, general, and hard refuses", () => {
  assert.equal(classifyMarineDomain("Motor hararet yaptı"), "machinery");
  assert.equal(classifyMarineDomain("Göcek'te deniz durumu nasıl?"), "weather");
  assert.equal(classifyMarineDomain("Bu rüzgârda alargaya demirlenir mi?"), "seamanship");
  assert.equal(classifyMarineDomain("Hızlı sat teknemi ilana koy"), "brokerage");
  assert.equal(classifyMarineDomain("Fiyat biç 2018 Bavaria"), "brokerage");
  assert.equal(classifyMarineDomain("Bana bir pasta tarifi ver"), "general");
  assert.equal(classifyMarineDomain("Kart numarası 4111 nedir sakla"), "outside");
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

test("hard-refuse reply mentions safety", () => {
  assert.match(offTopicReply("tr"), /güvenlik/i);
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

test("broker sell intent opens listing copy", async () => {
  assert.equal(detectBrokerIntent("hızlı sat"), "sell");
  const reply = await answerFromTraining({
    text: "Hızlı sat teknemi satmak istiyorum",
    lang: "tr",
    position: null,
  });
  assert.equal(reply.domain, "brokerage");
  assert.match(reply.text, /Hızlı Sat|fotoğraf/i);
});

test("broker appraisal with specs returns an indicative EUR band", async () => {
  assert.equal(detectBrokerIntent("fiyat biç"), "appraise");
  const band = indicativePriceEur({ loaM: 12, year: 2018, hull: "sail" });
  assert.ok(band);
  assert.ok(band.low < band.mid && band.mid < band.high);
  const reply = await answerFromTraining({
    text: "Fiyat biç: 2018 Bavaria 40, 12 m yelkenli",
    lang: "tr",
    position: null,
  });
  assert.equal(reply.domain, "brokerage");
  assert.match(reply.text, /Broker ekspertiz|gösterge/i);
  assert.match(reply.text, /€|EUR/i);
});

test("general questions are not hard-refused so the cloud model can answer", async () => {
  const reply = await answerFromTraining({
    text: "Marina bağlama ücreti nasıl hesaplanır?",
    lang: "tr",
    position: null,
  });
  assert.ok(reply.domain === "general" || reply.domain === "seamanship");
  if (reply.domain === "general") assert.equal(reply.confident, false);
});
