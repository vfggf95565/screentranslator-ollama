// Ollama translation script for ScreenTranslator
// Optimized for speed with in-memory caching and keep-alive
// Supports automatic model detection and configurable parameters

// --- CONFIGURATION ---
var OLLAMA_HOST = "http://127.0.0.1:11434"; // Default Ollama API address
var PREFERRED_MODEL = "qwen2.5:0.5b";        // Adjusted to match your installed model
var DEBUG_MODE = false;                      // Set to true to send logs to local port 3000
// ---------------------

var translationCache = {};
var cacheKeysQueue = [];
var MAX_CACHE_SIZE = 100;
var activeModel = ""; // Auto-detected or fallback model

// Updated language names to English and added Arabic support
var langNames = {
    'en': 'English',
    'eng': 'English',
    'ar': 'Arabic',
    'ara': 'Arabic',
    'ru': 'Russian',
    'rus': 'Russian',
    'ja': 'Japanese',
    'jpn': 'Japanese',
    'zh': 'Chinese',
    'zh-CN': 'Chinese',
    'chi': 'Chinese',
    'de': 'German',
    'ger': 'German',
    'fr': 'French',
    'fre': 'French',
    'es': 'Spanish',
    'spa': 'Spanish',
    'it': 'Italian',
    'ita': 'Italian',
    'ko': 'Korean',
    'kor': 'Korean'
};

function logToServer(msg) {
    if (!DEBUG_MODE) return;
    try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", "http://127.0.0.1:3000/log?msg=" + encodeURIComponent(msg), true);
        xmlHttp.send(null);
    } catch(e) {
        // Fallback silently
    }
}

function cleanText(text) {
    if (!text) return '';
    return text.trim();
}

function getCacheKey(text, from, to) {
    return from + '_' + to + '_' + text;
}

function httpGetAsync(url, callback, errorCallback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.timeout = 10000; // 10 seconds timeout for GET requests
    
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState !== 4) {
            return;
        }
        if (xmlHttp.status === 200) {
            callback(xmlHttp.responseText);
        } else {
            errorCallback(xmlHttp.statusText || ("HTTP Status " + xmlHttp.status));
        }
        xmlHttp.onreadystatechange = null;
        xmlHttp = null;
    };
    
    xmlHttp.open("GET", url, true);
    xmlHttp.send(null);
}

function httpPostAsync(url, payload, callback, errorCallback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.timeout = 60000; // 60 seconds timeout (allows cold start loading of the model)
    
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState !== 4) {
            return;
        }
        if (xmlHttp.status === 200) {
            callback(xmlHttp.responseText);
        } else {
            var errorMsg = xmlHttp.statusText || ("HTTP Status " + xmlHttp.status);
            errorCallback(errorMsg);
        }
        xmlHttp.onreadystatechange = null;
        xmlHttp = null;
    };
    
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.send(JSON.stringify(payload));
}

function selectModelAndTranslate(text, from, to) {
    logToServer("Fetching installed models from Ollama to auto-detect the best option...");
    
    httpGetAsync(OLLAMA_HOST + "/api/tags", function(responseText) {
        try {
            var responseJson = JSON.parse(responseText);
            var modelsList = responseJson.models || [];
            
            var chatModels = [];
            for (var i = 0; i < modelsList.length; i++) {
                var modelName = modelsList[i].name;
                if (modelName.indexOf('embed') === -1 && modelName.indexOf('bge') === -1) {
                    chatModels.push(modelName);
                }
            }
            
            if (chatModels.length === 0) {
                logToServer("No usable LLM models found in Ollama.");
                proxy.setFailed("No usable models found in Ollama. Please run 'ollama pull " + PREFERRED_MODEL + "'");
                return;
            }
            
            // 1. Check for preferred model
            for (var i = 0; i < chatModels.length; i++) {
                if (chatModels[i].indexOf(PREFERRED_MODEL) !== -1) {
                    activeModel = chatModels[i];
                    break;
                }
            }
            
            // 2. Fallback to any qwen model
            if (activeModel === "") {
                for (var i = 0; i < chatModels.length; i++) {
                    if (chatModels[i].toLowerCase().indexOf('qwen') !== -1) {
                        activeModel = chatModels[i];
                        break;
                    }
                }
            }
            
            // 3. Fallback to any llama model
            if (activeModel === "") {
                for (var i = 0; i < chatModels.length; i++) {
                    if (chatModels[i].toLowerCase().indexOf('llama') !== -1) {
                        activeModel = chatModels[i];
                        break;
                    }
                }
            }
            
            // 4. Fallback to any other chat model (gemma, phi, etc.)
            if (activeModel === "") {
                for (var i = 0; i < chatModels.length; i++) {
                    var lower = chatModels[i].toLowerCase();
                    if (lower.indexOf('gemma') !== -1 || lower.indexOf('phi') !== -1) {
                        activeModel = chatModels[i];
                        break;
                    }
                }
            }
            
            // 5. Final fallback: Use the first available model
            if (activeModel === "") {
                activeModel = chatModels[0];
            }
            
            logToServer("Auto-detected active model: " + activeModel);
            executeTranslation(text, from, to);
            
        } catch(e) {
            logToServer("Failed to parse Ollama tags response: " + e.toString());
            activeModel = PREFERRED_MODEL;
            executeTranslation(text, from, to);
        }
    }, function(errorMsg) {
        logToServer("Ollama tags request failed: " + errorMsg);
        activeModel = PREFERRED_MODEL;
        executeTranslation(text, from, to);
    });
}

function executeTranslation(text, from, to) {
    var cleanedText = cleanText(text);
    var cacheKey = getCacheKey(cleanedText, from, to);
    
    var url = OLLAMA_HOST + "/api/generate";
    
    var fromLangName = langNames[from.toLowerCase()] || from;
    var toLangName = langNames[to.toLowerCase()] || to;
    
    // Completely rewritten prompt in English for universal compatibility and better accuracy
    var promptText = "Translate this text from '" + fromLangName + "' to '" + toLangName + "'.\n" +
                     "Output ONLY the final translation. Do not include any commentary, explanations, quotes, footnotes, or the original text. The result must contain exclusively the translated text.\n" +
                     "Text to translate:\n" + cleanedText;
    
    var maxTokens = Math.max(100, cleanedText.length * 2);
    
    var payload = {
        "model": activeModel,
        "prompt": promptText,
        "stream": false,
        "options": {
            "temperature": 0.1,
            "num_predict": maxTokens
        },
        "keep_alive": "15m"
    };
    
    logToServer("Sending translation request to Ollama using model " + activeModel + "...");
    httpPostAsync(url, payload, function(responseText) {
        try {
            var responseJson = JSON.parse(responseText);
            var translated = responseJson.response;
            if (translated) {
                translated = translated.trim();
                
                translationCache[cacheKey] = translated;
                cacheKeysQueue.push(cacheKey);
                
                if (cacheKeysQueue.length > MAX_CACHE_SIZE) {
                    var oldKey = cacheKeysQueue.shift();
                    delete translationCache[oldKey];
                }
                
                logToServer("Ollama translation success: " + translated);
                proxy.setTranslated(translated);
            } else {
                logToServer("Ollama returned empty response");
                proxy.setFailed("Ollama returned empty response");
            }
        } catch(e) {
            logToServer("Failed to parse Ollama response JSON: " + e.toString());
            proxy.setFailed("Failed to parse Ollama response JSON: " + e.toString());
        }
    }, function(errorMsg) {
        logToServer("Ollama request failed: " + errorMsg);
        proxy.setFailed("Ollama request failed. Details: " + errorMsg);
    });
}

function translate(text, from, to) {
    logToServer('Ollama start translate: ' + text + ' from: ' + from + ' to: ' + to);
    
    var cleanedText = cleanText(text);
    if (cleanedText.length === 0) {
        logToServer('Text is empty, returning empty string');
        proxy.setTranslated('');
        return;
    }
    
    var cacheKey = getCacheKey(cleanedText, from, to);
    if (translationCache.hasOwnProperty(cacheKey)) {
        logToServer('Ollama cache hit for: ' + cleanedText);
        proxy.setTranslated(translationCache[cacheKey]);
        return;
    }
    
    if (activeModel === "") {
        selectModelAndTranslate(text, from, to);
    } else {
        executeTranslation(text, from, to);
    }
}

function init() {
    var currentUrl = window.location.href;
    logToServer("Init called. Current URL: " + currentUrl);
    
    if (currentUrl.indexOf(OLLAMA_HOST) === -1) {
        logToServer("Redirecting WebView from " + currentUrl + " to " + OLLAMA_HOST + " to bypass security policies");
        window.location = OLLAMA_HOST;
        return;
    }
    
    logToServer("Ollama translator initialized on Same-Origin domain.");
    proxy.translate.connect(translate);
}
