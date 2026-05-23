# Contributing

Thanks for helping improve Pi Voice STT.

## Development setup

```bash
npm install
npm run ci
pi -e .
```

## Guidelines

- Keep runtime dependencies minimal.
- Keep providers small and isolated under `src/providers/`.
- Do not commit local config files, API keys, or audio recordings.
- Add tests for config parsing and provider-independent logic.
- Prefer clear errors over silent fallbacks when user configuration is invalid.

## Adding a provider

1. Add a provider config type in `src/config/types.ts`.
2. Parse it in `src/config/load-config.ts`.
3. Implement `SttProvider` in `src/providers/`.
4. Register it in `src/providers/factory.ts`.
5. Add a README example.
