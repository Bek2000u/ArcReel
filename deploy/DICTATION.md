# Chat dictation

Use an ArcReel image built from this branch. In `deploy/`, start ArcReel with the GigaSTT override:

```sh
docker compose -f docker-compose.yml -f docker-compose.dictation.yml up -d
```

GigaSTT downloads the Russian GigaAM v3 model on the first start and keeps it in the `gigastt-models` volume. It runs on CPU and listens inside the Compose network. An existing GigaSTT instance can also be configured with `ARCREEL_GIGASTT_URL` in ArcReel's environment.

Open ArcReel over HTTPS or a loopback address to grant microphone access. A reverse proxy must forward WebSocket upgrades for `/api/v1/dictation` and preserve the public `Host` header. Click the microphone beside Attach to start dictating. Stop inserts the final transcript into the draft.
