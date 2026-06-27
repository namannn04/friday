# FRIDAY Voice Workflow - Test Scenarios

## How to Test

1. Stop any running instance: Press Ctrl+C in terminal
2. Start fresh: `npm run dev`
3. Wait for "✓ Ready" message
4. Use the **FRIDAY Assistant desktop window** (not browser)

## Test Cases

### Test 1: Text Input → Voice Output ✅
**Steps:**
1. Type: `hello friday how are you`
2. Click "Execute"

**Expected:**
- Text response appears in Result panel
- "🟢 FRIDAY is speaking…" shows briefly
- You hear voice from speakers saying the response
- Response should be conversational (e.g., "I'm doing great, thanks!")

---

### Test 2: Voice Input → Voice Output ✅
**Steps:**
1. Click microphone button
2. Say clearly: "hi friday what's up"
3. Click microphone button again

**Expected:**
- "🟡 Listening…" while recording
- "🔵 Understanding what you said…" during transcription
- Text appears showing what you said
- Response appears in text + voice
- "🟢 FRIDAY is speaking…" indicator

---

### Test 3: Tool Command via Text ✅
**Steps:**
1. Type: `list all pdf files in my downloads`
2. Click "Execute"

**Expected:**
- Command executes (lists PDFs)
- Result shown in text
- Voice says something like "I found 3 PDF files, including resume.pdf and document.pdf"

---

### Test 4: Tool Command via Voice ✅
**Steps:**
1. Click mic
2. Say: "open VS Code"
3. Click mic again

**Expected:**
- Transcription: "open vs code"
- VS Code opens
- Voice says "Opening Visual Studio Code" or similar
- Text confirmation shown

---

### Test 5: Error Handling - Too Short Recording ✅
**Steps:**
1. Click mic
2. Don't speak or speak very briefly (< 0.5s)
3. Click mic again

**Expected:**
- Error message: "Recording too short. Speak for at least 2-3 seconds"
- No voice output (error message only)

---

### Test 6: Error Handling - Ollama Not Running ✅
**Steps:**
1. Stop Ollama: `pkill -f ollama` in separate terminal
2. Type: `hello friday`
3. Click "Execute"

**Expected:**
- Error message: "Can't reach Ollama. Start it with: ollama serve"
- Voice says: "I can't reach my AI brain. Make sure Ollama is running."
- Command fails gracefully

**Cleanup:** Start Ollama again: `ollama serve`

---

### Test 7: Silent Audio Detection ✅
**Steps:**
1. Click mic
2. Stay completely silent for 3-4 seconds
3. Click mic again

**Expected:**
- Error: "Audio too quiet. Speak louder and closer to your microphone."
- No transcription attempt

---

### Test 8: Conversation Memory ✅
**Steps:**
1. Type: `my name is John`
2. Execute
3. Type: `what is my name`
4. Execute

**Expected:**
- First response: "Nice to meet you, John!" or similar
- Second response: "Your name is John" or similar
- Voice output for both

---

### Test 9: Multiple Text Commands in Sequence ✅
**Steps:**
1. Type: `hello`
2. Execute
3. Type: `how are you`
4. Execute
5. Type: `tell me a joke`
6. Execute

**Expected:**
- Each gets a conversational response
- Each response is spoken in voice
- Responses are contextually aware (conversation memory)

---

### Test 10: Voice Settings Toggle
**Steps:**
1. Click "Settings" in header
2. Toggle "Voice Enabled" OFF
3. Save Settings
4. Go back to main page
5. Type: `hello friday`
6. Execute

**Expected:**
- Response appears in text
- NO voice output (silent)
- No "FRIDAY is speaking…" indicator

**Cleanup:**
- Go back to Settings
- Toggle "Voice Enabled" ON
- Save

---

### Test 11: Browser Mode Warning ✅
**Steps:**
1. Stop the Electron app (Ctrl+C)
2. Keep Next.js running if it's still up, or start it: `npm run dev:next`
3. Open Chrome/Firefox to `http://localhost:3000`
4. Try clicking microphone

**Expected:**
- Warning banner: "Browser mode — Mic, files & AI tools need the FRIDAY Assistant desktop window"
- Mic button shows "Need Electron" message if clicked
- Text commands still work but may show Electron-only warning

**Cleanup:** Start full app again: `npm run dev`

---

## Expected Voice Quality

Current setup uses `spd-say` with `en-GB+f3` voice:
- Voice is **robotic but clear**
- Rate: Slightly faster than default
- Pitch: Slightly higher (friendlier tone)
- This is normal for espeak-based TTS

For **human-like** voice, recommend:
- Piper TTS (neural voice)
- Cloud TTS (Google, Azure, ElevenLabs)

---

## Pass Criteria

All tests pass if:
1. ✅ Text input → voice output works
2. ✅ Voice input → voice output works
3. ✅ Error messages are clear and helpful
4. ✅ UI indicators show correct state
5. ✅ Voice is audible (even if robotic)
6. ✅ No crashes or uncaught errors
7. ✅ Settings toggle works

---

## Failed Tests?

**Voice not playing:**
- Check: `spd-say -w "test"`
- If fails: `sudo apt install speech-dispatcher`
- Check: Settings → Voice Enabled is ON
- Restart app completely

**Mic not working:**
- Check: System Settings → Privacy → Microphone
- Grant permission to Electron
- Check: `arecord -l` shows your mic

**Transcription fails:**
- Vosk model downloading? Check `~/.friday-assistant/vosk-models/`
- Speak clearly, at least 2 seconds
- Reduce background noise

**Ollama errors:**
- Start: `ollama serve` in separate terminal
- Install: `ollama pull llama3.2`
- Check: `curl http://localhost:11434/api/tags`

---

**Ready to test?** Run `npm run dev` and start with Test 1!
