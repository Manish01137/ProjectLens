import { expect, test, type Page } from "@playwright/test";

// The quality-bar flow: sign up → onboarding → 5 matches → 5 different ones → chat "hi" (no cards)
// → "suggest a project" (cards) → save one → it appears in Saved.

async function lastReply(page: Page) {
  const before = await page.getByTestId("assistant-message").count();
  return async () => {
    await expect(page.getByTestId("assistant-message")).toHaveCount(before + 1);
    await expect(page.getByRole("button", { name: "Stop generating" })).toHaveCount(0);
    return page.getByTestId("assistant-message").last();
  };
}

async function say(page: Page, text: string) {
  const wait = await lastReply(page);
  await page.locator("#composer").fill(text);
  await page.keyboard.press("Enter");
  return wait();
}

test("new student finds, refreshes, chats about and saves a project", async ({ page }) => {
  const email = `student${Date.now()}@e2e.test`;

  // Sign up
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Asha Verma");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Projects2026");
  await page.getByRole("button", { name: "Create account" }).click();

  // Onboarding (4 steps)
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await page.getByRole("radio", { name: "CSE" }).click();
  await page.getByRole("radio", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Your skills" })).toBeVisible();
  await page.getByRole("button", { name: "Python", exact: true }).click();
  await page.getByRole("button", { name: "React", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What you care about" })).toBeVisible();
  await page.getByRole("button", { name: "Healthcare" }).click();
  await page.getByRole("button", { name: "Agriculture" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Your constraints" })).toBeVisible();
  await page.getByRole("button", { name: "Show my matches" }).click();

  // Dashboard: 5 matches
  await expect(page).toHaveURL(/\/dashboard/);
  const cards = page.getByTestId("project-card");
  await expect(cards).toHaveCount(5);
  const first = await cards.locator("h3").allTextContents();

  // "Show me different projects": 5 new ones, no repeats
  await page.getByRole("button", { name: "Show me different projects" }).click();
  await expect(cards).toHaveCount(5);
  await expect.poll(async () => (await cards.locator("h3").allTextContents()).join("|")).not.toBe(first.join("|"));
  const second = await cards.locator("h3").allTextContents();
  expect(second.filter((t) => first.includes(t))).toEqual([]);

  // Chat: "hi" gets a warm reply and no cards
  await page.getByRole("link", { name: "New chat" }).first().click();
  await expect(page).toHaveURL(/\/chat$/);
  const hi = await say(page, "hi");
  await expect(hi).toHaveAttribute("data-intent", "greeting");
  await expect(hi.getByTestId("project-card")).toHaveCount(0);
  await expect(hi).toContainText("Asha");
  await expect(page).toHaveURL(/\/chat\/[a-z0-9]+$/);

  // "suggest a project" gets cards: 3 new ideas from /generate, grounded in the catalogue
  const ask = await say(page, "suggest a project");
  await expect(ask).toHaveAttribute("data-intent", "ask_project");
  const chatCards = ask.getByTestId("project-card");
  await expect(chatCards).toHaveCount(3);
  await expect(chatCards.first()).toHaveAttribute("data-kind", "generated");
  await expect(chatCards.first()).toContainText("New idea");
  const chatTitles = await chatCards.locator("h3").allTextContents();
  expect(chatTitles.filter((t) => [...first, ...second].includes(t))).toEqual([]); // never repeats

  // Save one → it appears in Saved
  const title = chatTitles[0]!;
  await chatCards.first().getByRole("button", { name: "Save" }).click();
  await expect(chatCards.first().getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("link", { name: "Saved" }).first().click();
  await expect(page).toHaveURL(/\/saved/);
  await expect(page.getByTestId("column-Shortlisted").getByTestId("saved-card")).toContainText(title);
});

test("follow-ups: refine without repeats, then explain the second card", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ravi Iyer");
  await page.getByLabel("Email").fill(`ravi${Date.now()}@e2e.test`);
  await page.getByLabel("Password").fill("Projects2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("radio", { name: "IT" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Python", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Education" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Show my matches" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/chat");
  for (const [text, intent] of [
    ["how are you?", "chitchat"],
    ["what is NLP?", "general_question"],
  ] as const) {
    const r = await say(page, text);
    await expect(r).toHaveAttribute("data-intent", intent);
    await expect(r.getByTestId("project-card")).toHaveCount(0);
  }
  const ask = await say(page, "suggest a healthcare project");
  await expect(ask.getByTestId("project-card")).toHaveCount(3);
  await expect(ask.getByTestId("filter-line")).toContainText("Showing Healthcare");
  const a = await ask.getByTestId("project-card").locator("h3").allTextContents();

  const easier = await say(page, "make it easier");
  await expect(easier).toHaveAttribute("data-intent", "refine_project");
  await expect(easier.getByTestId("project-card")).toHaveCount(3);
  // context carried: still Healthcare, now Beginner
  await expect(easier.getByTestId("filter-line")).toContainText("Showing Healthcare · Beginner");
  const b = await easier.getByTestId("project-card").locator("h3").allTextContents();
  expect(b.filter((t) => a.includes(t))).toEqual([]);

  const explain = await say(page, "explain the second one");
  await expect(explain).toHaveAttribute("data-intent", "explain_project");
  await expect(explain).toContainText(b[1]!);
  await expect(explain).toContainText(/Weeks? 1/);
  await expect(explain.getByTestId("project-card")).toHaveCount(0);
});

test("pages other than landing and auth require sign-in", async ({ page }) => {
  for (const path of ["/chat", "/dashboard", "/saved", "/profile", "/settings", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  const res = await page.request.get("/api/profile");
  expect(res.status()).toBe(401);
});
