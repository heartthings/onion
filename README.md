**English** · [简体中文](./README.zh-CN.md)

# Onion

One idea comes in. A map comes out.

You choose the next layer. The model writes the title, the summary, and the explanation straight onto the card, so you can read the node without opening it first.

## What it is for

- A concept is stuck, so you split it before you wander
- Highlights, favorites, and notes stay on the map
- What you missed today comes back later

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:5188](http://localhost:5188).

You can click around before adding a model key. That is demo mode: the nodes are placeholders, the interaction is real. After you add a key, the browser talks to the model vendor directly. There is no Onion server in the middle.

## How to study

1. Start with one specific concept. Smaller topics make better maps.
2. The model prepares up to 12 directions and ranks them. Settings decide how many you see first. The rest sit behind "还有 N 个". Each visible node shows the full summary on the card.
3. Tap a card to open it. Tap the plus when you want the next layer.
4. Generate the explanation and it stays on the card, not only inside the side panel. Select a sentence there to highlight it. The star saves the node.
5. The follow-up questions at the end of an explanation are buttons. Tap one and it grows beside the current node, then fans out.
6. Mark each node **懂了 / 模糊 / 不会** (got it / fuzzy / lost). Fuzzy and lost branches turn amber or rose on the map.
7. Ask for a few multiple-choice questions on the current node. A wrong answer marks the node as still needing review and drops it into today's queue.
8. Choose "和另一个对比", then tap a second node, to see what they share and where they split.
9. Press `N` to write your own node. Yours are blue and labeled "我写的".

The sidebar has **今天要复习**. Highlights and favorites become cards on a small forgetting curve: forgot it, see it again in 10 minutes; fuzzy, tomorrow; remembered, the gap grows.

Export from the top bar gives you the whole map, a Markdown file of highlights and notes, or a text file Anki can import.

## Shortcuts

| Key | What it does |
| --- | --- |
| Arrows | Move around the map |
| Enter | Fan out, or reveal the next batch |
| N | Write your own node |
| F | Favorite |
| R | Today's review |
| Esc | Close whatever is open |
| ? | Shortcut help |

These stay quiet while you are typing in a field.

## Models

Open model settings from the bottom of the sidebar. DeepSeek, Qwen, Kimi, Zhipu, Doubao, OpenAI, OpenRouter, Ollama, or any OpenAI-compatible endpoint.

Keys, maps, highlights, and review cards live in IndexedDB in your browser, database name `onion`. They do not follow you to another computer. Clearing site data deletes them. That is the point.

## Buy the author a coffee

If this is useful, a coffee is enough. ¥25, WeChat or Alipay.

| WeChat | Alipay |
| --- | --- |
| ![WeChat Pay, ¥25](docs/coffee-wechat.jpg) | ![Alipay, ¥25](docs/coffee-alipay.jpg) |

## Open source, commercial use is email-only

Home: [github.com/heartthings](https://github.com/heartthings). This repo: [github.com/heartthings/onion](https://github.com/heartthings/onion).

Personal study, research, and tinkering: go ahead.

Charging for it, handing it to a client, or embedding it in a product your organization offers to other people: email first, and wait for written permission.

**deklyn.liang@snowballing.ltd**

The full text is in [LICENSE](LICENSE). This is not MIT, and it is not a free pass for commercial use.

If you change the code, keep it local-first. Please do not add anything that phones home. Issues and pull requests are welcome.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Flow · d3-hierarchy · Zustand · Dexie · motion
