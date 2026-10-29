# [Misparim — Hebrew numbers](https://dmitryweiner.github.io/misparim/)

A trainer for Hebrew cardinal numbers from 1 to 999: from digits to words and back.

## Features

- Four modes: digits → words and words → digits, picking from four choices or typing the answer.
- The direction can be linked to: `#number-first` (digits → words) or `#word-first` (words → digits).
- Ranges: 1–10, 10–100, 100–999. Feminine and masculine forms.
- Hints; answers with a hint are counted separately.
- Optional automatic advance to the next question (off by default, can be paused).
- On-screen Hebrew keyboard.
- Interface in English, Russian and Ukrainian: picked from the browser language
  (English by default) and switchable in the header dropdown.
- Settings and the chosen language are saved in localStorage.
- Works offline (PWA): after the first visit everything is cached, and the app can be
  installed on a phone. A new version takes over once all tabs with the old one are closed.
- Typed answers ignore niqqud and extra spaces and accept common full and short spellings.
- Speech uses the browser's built-in synthesizer and needs a Hebrew voice installed;
  availability and quality depend on the browser and the device.

## Development

Requires Node.js 24 (see `.node-version`; with fnm: `fnm use`).

```sh
npm ci
npm run dev      # dev server
npm test         # unit tests
npm run lint     # oxlint and Prettier check
npm run format   # format with Prettier
npm run build    # type check and build into dist/
npm run preview  # preview the build
```

The app is static: the contents of `dist/` can be served from any static hosting.
GitHub Actions lints, tests and builds the project on every push and pull request;
a push to `main` publishes the build to GitHub Pages.

Development rules (TDD, module layout) are in [AGENTS.md](AGENTS.md).

## License

The code is licensed under the [GNU General Public License v3.0 or later](LICENSE).

The bundled Noto Sans Hebrew font (`src/fonts/print-sans.ttf`) is licensed under the
SIL Open Font License 1.1 ([public/NOTO-SANS-LICENSE.txt](public/NOTO-SANS-LICENSE.txt));
keep the license file when redistributing.
