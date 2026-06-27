# FRIDAY Voice Workflow Documentation

## Overview
FRIDAY now has a production-ready voice workflow with:
- ✅ Offline speech recognition (Vosk)
- ✅ Natural text-to-speech (spd-say with optimized voice settings)
- ✅ Voice output for ALL inputs (text or voice)
- ✅ Comprehensive error handling and timeout protection
- ✅ Conversational AI responses (Ollama)

## Voice Pipeline

### 1. Input (Voice or Text)

#### Voice Input Flow:
1. User clicks microphone button
2. Audio captured via Web Audio API as PCM
3. Audio quality checks (amplitude, duration)
4. Resampled to 16kHz PCM16
5. Sent to Electron main process via IPC
6. Vosk transcribes offline → text
7. Text sent to orchestrator with `fromVoice: true`

#### Text Input Flow:
1. User types in input field
2. Clicks "Execute" button
3. Text sent directly to orchestrator

### 2. Processing (Orchestrator)

```
lib/orchestrator.ts::processCommand()
│
├─> executeProcessCommand() - handles command logic
│   ├─> Casual conversation? → chatWithOllama()
│   ├─> Tool command? → execute tool (search, open file, etc.)
│   └─> Unknown? → fallback to conversation or examples
│
└─> speakReply() - ALWAYS speaks the response (if voiceEnabled)
    ├─> Prepares text (removes markdown, limits length)
    ├─> Calls speakOnLinux() with timeout protection
    └─> Returns response with voiceSpoken: true
```

### 3. Output (Always Voice + Text)

- **Text**: Displayed in Result panel on UI
- **Voice**: Spoken via spd-say with natural voice settings
- **Indicator**: "FRIDAY is speaking…" shows while audio plays

## Voice Quality Settings

### TTS Configuration (services/speech/tts-linux.ts)
```typescript
const TTS_CONFIG = {
  rate: 15,        // Slightly faster for natural pace
  pitch: 20,       // Higher pitch for friendlier tone
  voice: "en-GB+f3" // British English female voice
}
```

### Voice Selection Priority:
1. `spd-say` with voice `en-GB+f3` (preferred)
2. `spd-say` with default voice (fallback)
3. `espeak-ng` with US English voice
4. `espeak` with US English voice
5. `festival` TTS engine

## Error Handling

### Voice Input Errors
| Error | Handling |
|-------|----------|
| Mic permission denied | Clear error message, no audio attempt |
| Audio too quiet | Amplitude check, user feedback |
| Recording too short | Minimum 0.5s enforced |
| Transcription timeout | 30s timeout with helpful message |
| No speech detected | Vosk returns empty, user asked to try again |
| "Native callback" error | Caught, user told to restart |

### Processing Errors
| Error | Handling |
|-------|----------|
| Ollama not running | Friendly message: "Start with: ollama serve" |
| Model not found | Instructions to install model |
| Timeout (45s) | AI response timeout with clear message |
| Network error | "Can't reach Ollama" message |

### TTS Errors
| Error | Handling |
|-------|----------|
| spd-say fails | Falls back to espeak-ng/espeak/festival |
| All TTS engines fail | Command succeeds, text shown, voice silently skipped |
| Timeout (15s) | TTS times out gracefully, doesn't block response |

## UI Feedback States

1. **Idle**: Input field ready
2. **Recording**: "🟡 Listening… speak naturally, then click mic again."
3. **Transcribing**: "🔵 Understanding what you said…" (spinner)
4. **Processing**: "🔵 Processing your request…" (spinner)
5. **Speaking**: "🟢 FRIDAY is speaking…" (pulsing dot)

## Settings

User settings at `~/.friday-assistant/settings.json`:

```json
{
  "voiceEnabled": true,        // Master voice switch
  "voiceAutoSpeak": true,      // Unused in current version
  "conversationMode": true,    // Enable casual chat
  "ttsRate": 0.92             // Unused (spd-say rate is hardcoded)
}
```

## Testing Checklist

### ✅ Voice Input Tests
- [x] Click mic → speak → click mic → transcribes correctly
- [x] Too short recording shows helpful error
- [x] Too quiet audio detected and rejected
- [x] Timeout after 30s works
- [x] Mic permission denied handled gracefully

### ✅ Text Input Tests
- [x] Type command → Execute → gets voice response
- [x] Casual conversation works (e.g., "hello friday")
- [x] Tool commands work (e.g., "list files in downloads")

### ✅ TTS Tests
- [x] Voice output for text input
- [x] Voice output for voice input
- [x] Voice output for both casual and tool commands
- [x] Error messages spoken (when appropriate)
- [x] Timeout protection works (15s max)
- [x] Fallback to other TTS engines works

### ✅ Error Scenarios
- [x] Ollama not running → helpful error + voice
- [x] Model not found → installation instructions
- [x] Network error → clear message
- [x] Mic blocked → no voice attempt, clear text error

## Conversational Quality

### Persona (services/ai/conversation.ts)
FRIDAY is configured to:
- Talk like a real human friend (warm, witty)
- Reply in 1-3 short sentences
- Match user's language (English, Hindi, Hinglish)
- Be conversational, not robotic
- Never pretend to do actions it didn't do

### Conversation Memory
- Last 10 messages (20 turns) kept in memory
- Stored in `lib/conversation-memory.ts`
- Enables context-aware responses

### Response Optimization
- Temperature: 0.8 (slightly creative)
- Max tokens: 150 (keeps responses concise)
- Timeout: 45s (prevents long waits)

## Known Limitations

1. **Voice Quality**: spd-say/espeak voices are robotic compared to modern neural TTS
   - **Future**: Consider piper-tts, coqui-tts, or cloud TTS for production
2. **Language**: Vosk model is English-only
   - **Future**: Add Hindi/multilingual models
3. **Transcription Accuracy**: Vosk is good but not perfect
   - Works best with clear audio, minimal background noise
4. **TTS Speed**: 15s timeout means very long responses might be cut off
   - Current responses are short enough this doesn't happen

## Recommended Improvements for Production

1. **Better TTS Engine**:
   ```bash
   # Install Piper TTS (neural voice, sounds much more human)
   pip install piper-tts
   piper-tts --model en_US-lessac-medium "Hello from FRIDAY"
   ```

2. **Voice Activity Detection**: Add VAD to auto-stop recording

3. **Streaming TTS**: Start speaking while still generating response

4. **Better Error Recovery**: Retry transcription once on failure

5. **Voice Analytics**: Log transcription accuracy for monitoring

6. **Multilingual Support**: Add Hindi/Hinglish Vosk models

## Files Modified for Voice Workflow

### Core Voice Files
- `lib/hooks/useVoiceInput.ts` - Audio capture, transcription client
- `services/speech/vosk-stt.ts` - Offline speech recognition
- `services/speech/tts-linux.ts` - Text-to-speech with quality settings
- `lib/speech/text-for-speech.ts` - Text preparation for TTS
- `lib/speech/tts-client.ts` - Renderer-side TTS fallback

### Processing & AI
- `lib/orchestrator.ts` - Main command processor + TTS integration
- `services/ai/conversation.ts` - Conversational AI with Ollama
- `lib/conversation-memory.ts` - Chat history management

### UI & Integration
- `components/Dashboard.tsx` - Voice UI, indicators, error handling
- `electron/main.ts` - IPC handlers for voice/TTS
- `electron/preload.ts` - IPC bridge to renderer
- `types/index.ts` - Added `voiceSpoken` flag

## Usage Instructions for End Users

### First Time Setup
1. Start Ollama: `ollama serve`
2. Pull model: `ollama pull llama3.2`
3. Start FRIDAY: `npm run dev`
4. Use the **FRIDAY Assistant desktop window** (NOT browser)

### Using Voice
1. Click the microphone button
2. Speak naturally for 2-4 seconds
3. Click microphone again to stop
4. Wait for transcription
5. FRIDAY responds in voice + text

### Using Text
1. Type your message or question
2. Click "Execute"
3. FRIDAY responds in voice + text

### Both work the same - you always get voice + text responses!

## Troubleshooting

**No voice output?**
- Check Settings → Voice Enabled is ON
- Restart the app: Stop npm run dev, run again
- Test spd-say: `spd-say "hello test"`

**Mic not working?**
- Grant microphone permissions in system settings
- Check browser/Electron has mic access
- Try: `arecord -l` to see if mic is detected

**Transcription fails?**
- Speak clearly for at least 2 seconds
- Reduce background noise
- Try getting closer to microphone
- Restart app (Vosk model might be stuck)

**Ollama errors?**
- Start Ollama: `ollama serve` in separate terminal
- Check model installed: `ollama list`
- Install if needed: `ollama pull llama3.2`

**Voice sounds robotic?**
- This is expected with espeak/spd-say
- Install piper-tts for neural voice quality
- Update `services/speech/tts-linux.ts` to use piper

---

**Status**: ✅ Production-ready for desktop use
**Last Updated**: 2026-06-27
**Version**: 1.0 (Voice Workflow Complete)
