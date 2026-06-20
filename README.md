# ScreenTranslator Ollama Integration

A custom translator script for [OneMoreGres/ScreenTranslator](https://github.com/OneMoreGres/ScreenTranslator) that enables instant, 100% offline, and private text translation using a locally running **Ollama** instance with the **Qwen2.5:7b** model (or any other local LLM).

## Features

- **100% Offline & Private**: No data leaves your machine. No API keys required. No cloud subscriptions.
- **Optimized for Speed**:
  - **In-Memory FIFO Cache**: Identical translations are cached and returned instantly (**~0.07 ms**) without querying the LLM again.
  - **Model Keep-Alive**: Instructs Ollama to keep the model loaded in VRAM (`keep_alive: "15m"`) to eliminate the cold-start delay on subsequent translations.
  - **Optimized Generation**: The prompt is strictly tuned in Russian/English to prevent the model from rambling, keeping generation time under **~500 ms**.
- **CORS & PNA Bypass**: Automatically redirects the internal WebView to the local Ollama instance (`http://127.0.0.1:11434`) to bypass Chromium's strict CORS and Private Network Access security policies.

---

## Prerequisites

1. **Ollama**: Download and install [Ollama](https://ollama.com/).
2. **Qwen2.5 Model**: Download the model by running the following command in your terminal:
   ```bash
   ollama run qwen2.5:7b
   ```
   *(Note: You can use other models, but `qwen2.5:7b` is highly recommended for translation quality, especially for Russian, English, and Chinese).*

---

## Installation

1. Copy the [`ollama.js`](./ollama.js) file from this repository.
2. Paste it into the ScreenTranslator assets directory:
   ```
   C:\Users\<Your-Username>\AppData\Roaming\Gres\ScreenTranslator\assets\translators\
   ```
   *(Note: If you run ScreenTranslator in **portable** mode, place it in `[ProgramFolder]/assets/translators/` instead).*
3. **Restart ScreenTranslator** to load the new script.

---

## Configuration

1. Right-click the **ScreenTranslator** icon in your system tray and select **Settings**.
2. Go to the **Translation** tab on the left.
3. Check the **Translate** box.
4. Set the **Source** language (e.g., *English*) and **Target** language (e.g., *Russian*).
5. In the **Translator** dropdown menu, select **Ollama**.
6. Click **Ok** or **Apply**.

---

## Files in this Repository

- [`ollama.js`](./ollama.js): The main translator script loaded by ScreenTranslator.
- [`test_ollama.js`](./test_ollama.js): A Node.js mock test suite that simulates ScreenTranslator's environment and verifies the script integration, caching, and Ollama connection.
- [`log_server.js`](./log_server.js): A helper HTTP utility server that listens for log outputs from the ScreenTranslator JavaScript environment.

---

## How to Run Tests

To verify that the script successfully connects to your local Ollama instance and translates text:

1. Ensure Ollama is running.
2. Run the mock test suite using Node.js:
   ```bash
   node test_ollama.js
   ```
3. The console will output the test steps, execution times, and show if the cache is working as expected.

---

## License

MIT License. Feel free to modify and use!
