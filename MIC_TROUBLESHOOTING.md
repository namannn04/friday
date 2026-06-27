# Microphone Not Working? Fix Guide

## Problem: Mic Always Failing with "Speech Engine Glitch"

This error means the Vosk speech recognition engine is crashing. Here's how to fix it:

---

## Quick Fixes (Try These First)

### 1. Restart the App Completely
```bash
# Stop the app (Ctrl+C in terminal)
# Then start fresh:
npm run dev
```

**Why this helps**: Reloads the Vosk model and clears any corrupted state.

---

### 2. Check Your Microphone
```bash
# Test if system can see your mic:
arecord -l

# Test recording (speak for 3 seconds, then Ctrl+C):
arecord -d 3 test.wav
aplay test.wav
```

**Expected**: You should hear your voice played back.

**If fails**: Your mic isn't working at system level. Check:
- Is mic plugged in / Bluetooth connected?
- System Settings → Sound → Input → Check volume, not muted
- Try a different microphone

---

### 3. Grant Microphone Permission

**For Electron:**
```bash
# Check if permission is granted:
pactl list sources | grep -i "application"

# If denied, run:
sudo apt install pulseaudio-utils
```

**In System Settings:**
- Privacy → Microphone
- Allow "Electron" or "FRIDAY Assistant"

---

## Advanced Fixes

### 4. Verify Vosk Model is Installed

```bash
# Check if model exists:
ls -lh ~/.friday-assistant/models/vosk-model-small-en-us-0.15/am/final.mdl

# Expected: Should show a ~15MB file
# If missing, delete and redownload:
rm -rf ~/.friday-assistant/models/
# Then restart the app - it will auto-download
```

---

### 5. Check Console Logs for Errors

While the app is running, watch the terminal for errors:

```bash
npm run dev
# Use the mic, look for lines starting with:
# [Vosk] or [Voice] or [Vosk IPC]
```

**Common error patterns:**

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `native callback` | C++ binding crash | Restart app, try shorter speech |
| `Buffer too short` | Recording < 0.5s | Speak for at least 2 seconds |
| `Invalid audio format` | Corrupted buffer | Check mic connection, restart |
| `Empty audio buffer` | No audio captured | Grant mic permissions |
| `Model error` | Vosk model corrupted | Delete `~/.friday-assistant/models/` |

---

### 6. Test Vosk Directly (Diagnostic)

Create a test file to isolate the issue:

```bash
cd ~/Desktop/Dev/friday
npx tsx -e "
import { transcribePcm16, isVoskReady } from './services/speech/vosk-stt.ts';
import { getModelPath, isModelInstalled } from './services/speech/model-download.ts';
import fs from 'fs';

(async () => {
  console.log('Model installed:', isModelInstalled());
  console.log('Model path:', getModelPath());
  console.log('Vosk ready:', isVoskReady());
  
  // Try transcribing test audio
  const silence = Buffer.alloc(32000); // 1s of silence
  const result = await transcribePcm16(silence, 16000);
  console.log('Test result:', result);
})();
"
```

**Expected output:**
```
Model installed: true
Model path: /home/user/.friday-assistant/models/vosk-model-small-en-us-0.15
Vosk ready: true
Test result: { text: '', error: 'No speech detected...' }
```

**If crashes**: The Vosk installation is broken. Try:
```bash
npm uninstall vosk
npm install vosk
npm run build:electron
```

---

### 7. Reinstall Vosk

If nothing else works:

```bash
# Remove vosk
npm uninstall vosk

# Clear model
rm -rf ~/.friday-assistant/models/

# Reinstall
npm install vosk

# Rebuild
npm run build:electron

# Start fresh
npm run dev
```

---

## Testing the Fix

Once you've tried fixes, test the mic:

1. Click mic button in FRIDAY
2. **Speak clearly for 3-4 seconds**: "hello friday how are you"
3. Click mic again to stop
4. Watch terminal for `[Vosk IPC] Transcription success: hello friday how are you`

**Success indicators:**
- ✅ Terminal shows: `[Vosk IPC] Transcription success:`
- ✅ UI shows your transcribed text
- ✅ FRIDAY responds in voice

---

## Still Not Working?

### Check Audio Format
Your mic might be outputting in a format Vosk doesn't like:

```bash
# Check mic sample rate:
pactl list sources | grep -A 20 "Name.*input" | grep "Sample"

# Vosk needs 16kHz, but we resample from any rate
# If it shows 0Hz or very weird values, your mic driver has issues
```

### Try Different Mic
- Use headset mic instead of laptop mic
- Try USB mic instead of Bluetooth
- Reduce background noise

### Check CPU/Memory
Vosk requires CPU to run. If your system is overloaded:

```bash
top
# Check if CPU is at 100% or RAM is full
```

---

## What Changed in Latest Fix?

The code now has:

1. **Automatic retry** - If Vosk crashes, it reloads the model and tries again
2. **Better buffer validation** - Checks audio is valid before sending to Vosk
3. **Smaller chunks** - Processes audio in 4KB chunks instead of 8KB (more stable)
4. **Detailed logging** - Every step logged to terminal for debugging
5. **Error recovery** - Cached model is reset if it gets corrupted

---

## Known Limitations

- **Robotic voice**: TTS uses espeak (robotic but works offline)
- **English only**: Vosk model is English-only
- **Needs 2+ seconds**: Very short speech might not transcribe
- **Quiet audio fails**: Speak close to mic, in quiet environment

---

## Report a Bug

If mic still doesn't work after all these steps, open an issue with:

1. Terminal output when you click mic
2. Output of `arecord -l`
3. Output of `ls -lh ~/.friday-assistant/models/vosk-model-small-en-us-0.15/am/`
4. Your OS: `uname -a`

---

**Last Updated**: 2026-06-27
**FRIDAY Version**: 1.1 (Vosk crash fixes)
