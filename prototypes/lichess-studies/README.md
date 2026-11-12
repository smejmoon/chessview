# Lichess Study Lab

An isolated, read-only Chessview prototype for exploring Lichess studies as a position-centered map. Visit the built page at `prototypes/lichess-studies/` or, on GitHub Pages, under Chessview's deployed base path.

## Try it

1. Open the page. It uses Chessview's existing Lichess OAuth2/PKCE session. Visitors without a session are redirected to Lichess to sign in.
2. Paste a study URL (for example `https://lichess.org/study/<8-character-ID>`) or use **My studies**.
3. Pick a chapter; click a Root, Line or continuation board to recenter. The Rail retains chapter-specific notes and provides an authored move route. The same canonical position may be found in multiple chapters.
4. Open **Activity log** (expanded by default), use **Copy log** for troubleshooting, and check the browser console. The log reports auth state, request statuses/latency, PGN parsing, graph counts, navigation, rendering and errors. It never logs access tokens or raw PGN/comments. Copied logs may contain chapter names and move notation.
5. For private and unlisted content use **Grant study access**. This is an explicit OAuth grant of Lichess `study:read` through the same Chessview session; it does not create a separate account or send tokens to a Chessview server. The shared token is replaced after a successful OAuth callback.

## Scope

- Supports standard chess PGNs and custom starting FENs; includes main lines, recursively nested variations, NAGs and written comments. Move counts and canonical position identities come from Chessview's `graph.ts` and `chess.js`.
- Study chapter occurrences remain distinct even when two positions have identical canonical identity. At a Nodus, Roots and Lines aggregate matching authored occurrences; original chapter comments do not merge.
- A limited spatial preview is rendered, with up to four Roots, six Lines and four next steps. The Rail lists all immediate study Lines. It does not claim to be the production Constellation selection algorithm.
- Reads the Lichess API using `LichessGateway` and, where available, `LichessSession.authorizedRequest`. An authorization-scope 403 falls back to public access for the requested study/list, and reports that only public content was returned.
- No editing, no Lichess write endpoints, no local persistence of study content, no global graph mutation, no automatic syncing, no ChessView production navigation changes.
- The small importer limits input to 2 MB, 200 chapters, and 20,000 move occurrences. Unsupported variants or malformed chapters are skipped with diagnostic messages.
- Imported free-text comments are displayed as plain text, never injected as HTML. PGN-specific draw arrows/circles and interactive Lichess study features are not reproduced.

## Source references

- [Lichess study export](https://lichess.org/api#tag/Studies/operation/studyAllChaptersPgn)
- [Lichess study metadata](https://lichess.org/api#tag/Studies/operation/studyListMetadata)
- [Chessview Lichess access contract](../../docs/components/lichess-access.md)

The parser and navigation are experimental; validate with real studies and the project's tests before promoting this interface into the main Chessview experience.
