# Telegram flow

The bot only responds to one authorized user id; every command and callback checks this first. It
offers `/new` (starts the interactive story-creation flow below), `/go` (finalizes it), `/stories`
(opens an inline menu of unread/read stories), `/topic <text>` (saves a teaching theme into the
default universe's `topics`), and `/fragment <text>` (saves a delight into `fragments`). There is
also `/start`, which just lists what the bot can do.

**Outside that flow, the core interaction is plain text.** Any message that isn't a command, and
isn't sent while a story is being composed (see below), is inspected: if it parses as a bare story
id, the bot shows that story (and marks it read); otherwise the text is treated as a new story idea
— `createStoryAndFire` inserts a `draft` and calls `triggerAutoPipeline` against the most-recently-used
universe. Generation runs in the background; when it finishes, the pipeline's story-ready callback
pushes a Telegram message telling the parent the story is ready to read.

**`/new` starts an interactive, accumulate-then-generate flow instead of firing on the very next
message.** `/new` replies with an inline keyboard of every universe (`story_groups`); tapping one
stores the choice in `telegram_pending_actions` (one row per chat, keyed by `chat_id`, 30-minute
TTL) and prompts for the idea. From there, every plain-text message the parent sends is *appended*
to that row's `accumulated_seed` column instead of immediately creating a story — each message gets
an acknowledgement reply with a "✅ Готово" button, and the TTL refreshes on every append so an
actively-used session doesn't expire mid-conversation. The parent can send as many messages as they
want before finalizing. Finalizing — tapping "✅ Готово" or sending `/go` — reads the accumulated
seed, creates the story with it, and dispatches the pipeline exactly like the old one-shot flow did;
finalizing with nothing accumulated yet is a no-op that keeps the pending row alive rather than an
error. An expired or absent pending action falls through to the normal id-lookup/default-universe
path unchanged.

Both `/topic` and `/fragment` exist in `telegram.ts` today, matching the anchor's guess.

![Telegram flow](img/03-telegram-flow.png)

```mermaid
flowchart TD
  msg["Incoming Telegram update<br/>(authorized user only)"]
  cmds{"Command or plain text?"}
  new["/new<br/>reply with universe keyboard"]
  pick["newpick:&lt;id&gt; callback<br/>store pending action, prompt for idea"]
  stories["/stories<br/>show category menu"]
  topic["/topic &lt;text&gt;<br/>insert topic row"]
  frag["/fragment &lt;text&gt;<br/>insert fragment row"]
  pending{"Live pending action<br/>for this chat?"}
  append["Append message to<br/>accumulated_seed, refresh TTL<br/>reply with '✅ Готово' button"]
  finalize["'✅ Готово' callback or /go<br/>&rarr; finalizePendingStory"]
  ready{"accumulated_seed<br/>non-empty?"}
  text{"Plain text:<br/>looks like a story id?"}
  show["showStory(id)<br/>reply with text, mark read"]
  createfire["createStoryAndFire /<br/>createStoryForUniverse<br/>&rarr; triggerAutoPipeline"]
  gen["Pipeline generates story<br/>(async, fire-and-forget)"]
  cb["story-ready callback<br/>&rarr; bot.api.sendMessage"]

  msg --> cmds
  cmds --> new --> pick
  cmds --> stories
  cmds --> topic
  cmds --> frag
  cmds -->|"plain text or /go"| pending
  pending -->|"yes, not finalizing"| append
  append -.->|"parent taps Готово / sends /go"| finalize
  pending -->|"finalize triggered"| finalize
  finalize --> ready
  ready -->|"yes"| createfire
  ready -->|"no"| append
  pending -->|"no live pending action"| text
  text -->|"yes"| show
  text -->|"no"| createfire
  createfire --> gen --> cb
  cb -.->|"user taps id"| show
  stories -->|"pick story:id button"| show
```
