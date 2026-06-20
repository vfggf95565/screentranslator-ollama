# Design Specification: Ollama Translation Script for ScreenTranslator

This document describes the design and implementation of a custom translation script for ScreenTranslator that integrates with a locally running Ollama instance, optimized for speed and reliability.

## Goal

Add a new translation method to ScreenTranslator using a local Ollama instance running the `qwen2.5:7b` model, ensuring very fast translation speed via caching, connection optimization, and keep-alive settings.

## Architecture & Integration

ScreenTranslator loads translation scripts written in JavaScript from the directory:
`C:\Users\deth\AppData\Roaming\Gres\ScreenTranslator\assets\translators\`

We will introduce a new file `ollama.js` in that folder. 
The script runs in a Qt QJSEngine/QWebView environment where:
- The global `proxy` object provides integration with the host application.
- `proxy.translate.connect(callback)` registers the translation handler.
- `proxy.setTranslated(text)` returns the translated text.
- `proxy.setFailed(error)` reports translation failure.
- `XMLHttpRequest` is available for sending HTTP requests.

## Component Design

### 1. In-Memory Caching
To achieve near-instantaneous translation for repeated or identical texts:
- An in-memory dictionary `translationCache` will store mappings of `key -> translatedText`.
- The key format will be: `fromLanguage_toLanguage_cleanedText`.
- A FIFO queue `cacheKeysQueue` will keep track of the insertion order.
- `MAX_CACHE_SIZE` is capped at 100 to prevent unbounded memory growth.
- If the cache exceeds 100 elements, the oldest entry is removed.

### 2. Ollama API Integration
We will communicate with Ollama's HTTP API at `http://localhost:11434/api/generate` using asynchronous `XMLHttpRequest` POST requests.

Request payload structure:
```json
{
  "model": "qwen2.5:7b",
  "prompt": "Translate the following text from ISO language code '[from]' to ISO language code '[to]'. Output ONLY the final translation, do not include any introductions, explanations, formatting, markdown, quotes or notes. Text to translate:\n[text]",
  "stream": false,
  "options": {
    "temperature": 0.1,
    "num_predict": maxTokens
  },
  "keep_alive": "15m"
}
```

Optimization Parameters:
- `stream: false` - return the response as a single JSON object.
- `temperature: 0.1` - ensures deterministic, translation-focused outputs.
- `num_predict` - bounded to `Math.max(100, text.length * 2)` to stop the model from generating verbose explanations if it gets confused.
- `keep_alive: "15m"` - ensures the model stays loaded in VRAM for 15 minutes after the last request, eliminating model reload latency.

### 3. Error Handling
- Network timeouts are set to 15 seconds.
- Any non-200 HTTP status code or connection failure will call `proxy.setFailed("Ollama Error: [details]")`.

## Verification Plan

### Automated Testing (Local Node.js Environment)
We will create a test script `test_ollama.js` in a scratch workspace that:
1. Mocks the ScreenTranslator global `proxy` and `XMLHttpRequest` objects (since Node.js doesn't have `XMLHttpRequest` natively, we will mock it or use a lightweight package / native `fetch` wrapper).
2. Requires/evaluates the `ollama.js` script.
3. Tests cache hits (should respond immediately in 0 ms).
4. Tests integration with the real local Ollama instance on `http://localhost:11434`.
5. Verifies translation correctness and speed.

### Manual Verification
1. Copy `ollama.js` to `C:\Users\deth\AppData\Roaming\Gres\ScreenTranslator\assets\translators\ollama.js`.
2. Restart ScreenTranslator.
3. Open settings -> Update -> Translators, select Ollama if visible, or select it in the Translation tab.
4. Perform screen translation and observe the output.
