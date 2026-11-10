# Recorded audio with Azure (free tier)

The app plays recorded clips when they exist and falls back to the iPhone's Polish voice otherwise. Clips are made once on the Mac with `tools/make-audio.js`, using Azure AI Speech neural voices: **Agnieszka** (main voice, and your partner's lines) and **Marek** (your own lines when they depend on gender, and, in the extra pass, a second speaker for listening variety). Zofia was tried and dropped: she glitched on some words.

## Staying free

- Create the Speech resource on the **Free F0** pricing tier. F0 allows 0.5 million characters a month and 20 requests a minute.
- The script keeps its own count in `tools/audio-usage.json` and stops at 400,000 characters a month (it refuses any cap above 500,000).
- The whole course is about 37,000 characters for the main pass and about 26,000 for the extra pass (both counted with a safety margin), well under a fifth of one month's allowance.
- Text is sent to Microsoft only to make the clips: the course content, never your progress.

## One-time Azure setup (about 10 minutes)

1. Sign in at https://portal.azure.com (a free Microsoft account works; Azure may ask for a card for identity checks, but an F0 resource is free).
2. **Create a resource** → search **Speech** → *Create* (Azure AI services → Speech service).
3. Choose a resource group (create one, e.g. `polski`), a **Region** near you (e.g. *West Europe* or *UK South*), any name, and **Pricing tier: Free F0**. Create it.
4. Open the resource → **Keys and Endpoint**. You need *KEY 1* and the *Location/Region* (e.g. `westeurope`).

Keep the key private. Don't commit it, paste it into chat, or put it in a file in the repository.

## Making the clips

In Terminal, in the project folder:

```bash
export AZURE_SPEECH_KEY='paste KEY 1 here'
```

```bash
export AZURE_SPEECH_REGION='westeurope'
```

Check what would happen (no key used):

```bash
node tools/make-audio.js --dry-run
```

Main pass (about 90 minutes; leave it running):

```bash
node tools/make-audio.js
```

Optional extra pass: Marek for every sentence that doesn't depend on gender, for listening variety (about 70 minutes more; can run another day):

```bash
node tools/make-audio.js --pass extra
```

You can stop either with Ctrl-C and run it again later; it skips clips it has already made. When it finishes, publish:

```bash
node tools/update-sw.js && node --test tests/
```

Then commit and push (or ask Claude to). The phone downloads the clips with the next update (about 20 MB for the main pass, more with the extra voices; best on Wi-Fi).

## When content changes

New or edited sentences have no clip until you run `node tools/make-audio.js` again (it only makes the missing ones; the app uses the iPhone voice for them meanwhile). Clips for removed sentences drop out of the manifest automatically.
