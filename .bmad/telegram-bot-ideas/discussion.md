---
type: discussion
branch: main
task: telegram-bot-ideas
state: confirmed
updated: 2026-04-30
---

# Developer Q&A: Telegram Bot for Story Ideas

**Q1:** When you send a message to the bot, which universe should the idea go to — fixed via env var, or pick each time?
**A:** Pick each time (inline keyboard with universe list).

**Q2:** How should you send an idea to the bot — plain text, or /idea command?
**A:** Plain text = idea. No command prefix needed.

**Q3:** What should the bot reply after the pipeline starts?
**A:** One confirmation only: "Story #N created, pipeline started". No completion notification.
