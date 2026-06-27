"use strict";

/**
 * Standalone Vosk speech-to-text worker.
 *
 * Runs in a separate process using the SYSTEM Node binary (not Electron),
 * because vosk's ffi-napi bindings are built against the system Node ABI and
 * crash with "Error in native callback" when loaded inside Electron's runtime.
 *
 * Protocol (newline-delimited JSON over stdin/stdout):
 *   <- argv[2] = absolute path to the Vosk model directory
 *   -> {"type":"ready"}                      once the model is loaded
 *   -> {"type":"fatal","error":"..."}        if the model fails to load
 *   <- {"id":1,"file":"/tmp/x.pcm","sampleRate":16000}
 *   -> {"type":"result","id":1,"text":"..."} or {"type":"result","id":1,"error":"..."}
 */

const fs = require("fs");
const path = require("path");

const modelPath = process.argv[2];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

let vosk;
let model;

try {
  vosk = require("vosk");
  vosk.setLogLevel(-1);
} catch (err) {
  send({ type: "fatal", error: "Failed to load vosk module: " + (err && err.message) });
  process.exit(1);
}

try {
  if (!modelPath || !fs.existsSync(path.join(modelPath, "am", "final.mdl"))) {
    send({ type: "fatal", error: "Vosk model not found at: " + modelPath });
    process.exit(1);
  }
  model = new vosk.Model(modelPath);
} catch (err) {
  send({ type: "fatal", error: "Failed to load model: " + (err && err.message) });
  process.exit(1);
}

send({ type: "ready" });

function transcribe(msg) {
  let recognizer = null;
  try {
    const pcm = fs.readFileSync(msg.file);
    const sampleRate = msg.sampleRate || 16000;

    recognizer = new vosk.Recognizer({ model, sampleRate });

    const chunkSize = 4000;
    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, pcm.length);
      // Copy each chunk into a standalone Buffer (no shared byteOffset)
      const chunk = Buffer.from(pcm.subarray(offset, end));
      recognizer.acceptWaveform(chunk);
    }

    const result = recognizer.finalResult();
    const text = (result.text || "").trim();
    send({ type: "result", id: msg.id, text });
  } catch (err) {
    send({ type: "result", id: msg.id, error: (err && err.message) || "transcription failed" });
  } finally {
    if (recognizer) {
      try {
        recognizer.free();
      } catch (_) {
        /* ignore */
      }
    }
    if (msg && msg.file) {
      try {
        fs.unlinkSync(msg.file);
      } catch (_) {
        /* ignore */
      }
    }
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (_) {
      continue;
    }
    if (msg && msg.file) {
      transcribe(msg);
    }
  }
});

process.stdin.on("end", () => {
  try {
    model.free();
  } catch (_) {
    /* ignore */
  }
  process.exit(0);
});
