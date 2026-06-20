// Test script to verify ollama.js translation logic and caching
const fs = require('fs');
const vm = require('vm');

console.log("=== Starting Ollama Translator Tests ===");

// 1. Mock the Environment
const mockProxy = {
    translateCallback: null,
    translate: {
        connect: function(callback) {
            mockProxy.translateCallback = callback;
        }
    },
    setTranslated: function(text) {
        if (mockProxy.resolvePromise) {
            mockProxy.resolvePromise({ success: true, text: text });
        }
    },
    setFailed: function(errorMsg) {
        if (mockProxy.resolvePromise) {
            mockProxy.resolvePromise({ success: false, error: errorMsg });
        }
    },
    // Helper to run a translation and return a Promise
    runTranslate: function(text, from, to) {
        return new Promise((resolve) => {
            mockProxy.resolvePromise = resolve;
            if (mockProxy.translateCallback) {
                mockProxy.translateCallback(text, from, to);
            } else {
                resolve({ success: false, error: "translateCallback is not registered" });
            }
        });
    }
};

// Mock XMLHttpRequest using Node's native fetch
class XMLHttpRequestMock {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.responseText = '';
        this.onreadystatechange = null;
        this.headers = {};
        this.timeout = 0;
    }
    
    open(method, url, async) {
        this.method = method;
        this.url = url;
    }
    
    setRequestHeader(name, value) {
        this.headers[name] = value;
    }
    
    send(body) {
        this.readyState = 1;
        if (this.onreadystatechange) this.onreadystatechange();
        
        const fetchOptions = {
            method: this.method,
            headers: this.headers,
            body: body
        };
        
        // Handle timeout
        let controller;
        if (this.timeout > 0) {
            controller = new AbortController();
            fetchOptions.signal = controller.signal;
            setTimeout(() => controller.abort(), this.timeout);
        }
        
        fetch(this.url, fetchOptions)
            .then(res => {
                this.status = res.status;
                this.statusText = res.statusText;
                return res.text();
            })
            .then(text => {
                this.readyState = 4;
                this.responseText = text;
                if (this.onreadystatechange) this.onreadystatechange();
            })
            .catch(err => {
                this.readyState = 4;
                this.status = 0;
                this.statusText = err.message;
                if (this.onreadystatechange) this.onreadystatechange();
            });
    }
}

// Set up global environment for the script
const sandbox = {
    proxy: mockProxy,
    XMLHttpRequest: XMLHttpRequestMock,
    console: console,
    JSON: JSON,
    Math: Math,
    // Set properties that might be accessed
    translationCache: {},
    cacheKeysQueue: [],
    MAX_CACHE_SIZE: 100
};

// 2. Load and evaluate ollama.js
const scriptPath = __dirname + '/ollama.js';
const scriptCode = fs.readFileSync(scriptPath, 'utf8');
vm.createContext(sandbox);
vm.runInContext(scriptCode, sandbox);

// Call init to connect signals
sandbox.init();

// Helper to format duration
function formatMs(start) {
    const diff = process.hrtime(start);
    return ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2) + " ms";
}

async function runTests() {
    try {
        // Test 1: Live translation from English to Russian
        console.log("\n--- Test 1: Translating 'Hello, world!' from English to Russian ---");
        let start = process.hrtime();
        let result = await sandbox.proxy.runTranslate("Hello, world!", "en", "ru");
        console.log("Result:", JSON.stringify(result));
        console.log("Time taken:", formatMs(start));
        if (!result.success) {
            throw new Error("Test 1 failed: " + result.error);
        }
        if (!result.text || result.text.trim().length === 0) {
            throw new Error("Test 1 failed: Returned empty text");
        }
        console.log("Test 1 Passed! Translated text: " + result.text);

        // Test 2: Cache hit (same translation)
        console.log("\n--- Test 2: Translating 'Hello, world!' again (Cache Hit Test) ---");
        start = process.hrtime();
        result = await sandbox.proxy.runTranslate("Hello, world!", "en", "ru");
        const timeTakenMs = parseFloat(formatMs(start));
        console.log("Result:", JSON.stringify(result));
        console.log("Time taken:", timeTakenMs + " ms");
        if (!result.success) {
            throw new Error("Test 2 failed: " + result.error);
        }
        if (timeTakenMs > 5.0) {
            console.log("Warning: Cache hit took longer than 5ms: " + timeTakenMs + " ms");
        } else {
            console.log("Test 2 Passed! Cache hit is near-instant.");
        }

        // Test 3: Translate another sentence
        console.log("\n--- Test 3: Translating 'Screen Translator is awesome' from English to Russian ---");
        start = process.hrtime();
        result = await sandbox.proxy.runTranslate("Screen Translator is awesome", "en", "ru");
        console.log("Result:", JSON.stringify(result));
        console.log("Time taken:", formatMs(start));
        if (!result.success) {
            throw new Error("Test 3 failed: " + result.error);
        }
        console.log("Test 3 Passed! Translated text: " + result.text);

        // Test 4: Error Handling (simulate connection failure)
        console.log("\n--- Test 4: Error Handling (Invalid Ollama URL) ---");
        // We will temporarily swap the url in the sandbox
        const originalUrl = "http://localhost:11434/api/generate";
        // Let's modify the code execution dynamically by redefining the url inside sandbox or just modifying the url string in script
        // In ollama.js we have: var url = "http://localhost:11434/api/generate";
        // Since it's local in translate function, we can mock sandbox.XMLHttpRequest to point to a broken port
        const originalSend = XMLHttpRequestMock.prototype.send;
        XMLHttpRequestMock.prototype.send = function(body) {
            this.url = "http://localhost:9999/api/generate"; // Broken port
            originalSend.call(this, body);
        };

        start = process.hrtime();
        result = await sandbox.proxy.runTranslate("Test error", "en", "ru");
        console.log("Result:", JSON.stringify(result));
        console.log("Time taken (timeout expected to be fast on refusal):", formatMs(start));
        
        // Restore original send
        XMLHttpRequestMock.prototype.send = originalSend;

        if (result.success) {
            throw new Error("Test 4 failed: Expected translation to fail on invalid URL but it succeeded");
        }
        console.log("Test 4 Passed! Error caught successfully: " + result.error);

        console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
    } catch(err) {
        console.error("\n!!! TEST SUITE FAILED !!!");
        console.error(err);
        process.exit(1);
    }
}

runTests();
