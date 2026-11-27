# PodiumPanda

A shared-link group workspace for an orchestra or other ensemble. Groups have a shared roster and multiple concerts, each with optional guest players, setlists, preferences, assignments and editable Konva floorplans. No accounts or permission levels.

## Stack

TypeScript, TanStack Start (SPA mode), TanStack Query, shadcn/ui, Tailwind, React Konva, Zod, pnpm, Oxlint, Oxfmt, and Vitest. AWS CDK provisions private S3 hosting behind CloudFront, API Gateway HTTP endpoints, Node.js Lambda, and a DynamoDB single table. Application resources use `eu-west-1`; the production CloudFront certificate uses `us-east-1`. No containers are needed.

The supplied panda SVG is the app icon and header mark; the full panda PNG appears on the homepage. Baloo 2 headings and Montserrat body text are self-hosted through Fontsource (no external font requests). Light mode uses a cool near-white lavender background and white cards, with dark-purple primary actions, lilac selected tabs and coral accents. Dark mode retains the purple palette with lilac and coral highlights. The theme initially follows the device preference; the header toggle remembers an explicit choice in browser storage.

The interface supports Dutch and English. It checks the browser's preferred languages in order, matching regional variants such as `nl-BE` and `en-GB`. If neither language matches, Dutch is the default. The header selector remembers an explicit language choice in browser storage across visits; without a saved choice, the system preference is used. User-entered names, notes, and titles are never translated.

Dropdowns, checkboxes, tables, and date pickers use shadcn primitives. Dates are displayed as `dd-MM-yyyy` in both languages and stored as ISO `yyyy-MM-dd`; calendar selections preserve the local day without UTC conversion. The shared-edit status shows only saving/saved/disconnected, not internal revisions or polling intervals.

The header's settings menu contains language and theme controls. Concert tabs stay in one horizontally scrollable row on narrow screens, with keyboard navigation and a swipe hint. The selected concert tab is kept in the URL, so refresh and browser back/forward restore it; sharing keys remain in the URL fragment.

The homepage links to a dedicated group-creation page. Creating a group opens its workspace and saves a shortcut in the browser when storage is available.

Each group has a shared, changeable icon chosen from music and percussion options. Older groups and shortcuts use the people icon by default. Homepage shortcuts show the icon last seen in that browser and update when the group is opened.

The group edit menu can remove its shortcut from the current browser. This does not delete the shared group or its concerts; the full link can be used to open it again.

Pieces can store an HTTP(S) music link without embedded credentials. YouTube and Spotify use official, click-to-load iframe players; other links open externally. Embed URLs are derived from allowlisted hosts and validated IDs, without forwarding unrelated query parameters. YouTube receives only the application's origin as the referrer, as required by its embedded-player policy; concert paths and sharing keys are never sent. The floating YouTube player loads through a same-origin wrapper because its blank Picture-in-Picture document cannot supply a referrer. CloudFront permits only that same-origin wrapper, YouTube's privacy-enhanced host and Spotify as frames.

The Spotify icon is from [Simple Icons](https://simpleicons.org/) (CC0 1.0).

Spotify tracks, episodes and shows use the compact 80px player without an iframe border; albums and playlists retain the 352px collection layout.

The floating player uses feature-detected Document Picture-in-Picture in supporting browsers and stays open when navigating between app pages and concert sections. A browser refresh or leaving the app closes it. Opening/returning it can restart an iframe's playback. Provider restrictions still apply: some YouTube videos disable embedding, and Spotify may provide previews or require its own login for full playback. Spotify's embed does not expose login status; the app displays a general sign-in hint instead. PodiumPanda itself requires no login.

Motion stays subtle: concert-card lifts, button presses, tab/entry entrances, copy-success feedback, and a gently conducting homepage panda with floating music notes. Longer route/concert/history/floorplan loads show a panda conductor with floating music notes only after 300 ms; fast loads do not flash the indicator. Background polling does not animate the workspace. All motion honors `prefers-reduced-motion`, including shadcn popovers; the panda and loading indicator remain static in reduced-motion mode.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The Vite proxy forwards `/api/*` to the deployed PodiumPanda development backend by default. Local changes are real, shared changes to that cloud backend, not an isolated or offline database; an internet connection is required. The localhost origin has its own browser shortcuts, separate from the deployed site. To use a different backend, run `PODIUMPANDA_API_URL=https://YOUR_API_ID.execute-api.eu-west-1.amazonaws.com pnpm dev`. Do not point local development at production data.

```sh
pnpm build
pnpm check
pnpm synth
pnpm format
```

Build first: TanStack generates the route tree, and CDK needs the static output in `dist/client`. Only that directory is hosted; the Start server bundle is not deployed. Lambda implements the backend separately.

Keep the shared router pending renderer configured: SPA prerendering and hydration must produce the same Suspense structure. Browser-dependent pages use client-only rendering.

## Initial AWS deployment

The AWS account must already have the GitHub OIDC provider for `https://token.actions.githubusercontent.com`, with audience `sts.amazonaws.com`. Use the same AWS account for both regions and replace `huskey` with your AWS profile if needed.

```sh
pnpm build
pnpm cdk bootstrap --profile huskey aws://YOUR_ACCOUNT_ID/eu-west-1
pnpm run deploy --profile huskey --context stage=dev
```

The development stack outputs `Url`, `ApiUrl`, and `GitHubRoleArn`. Development continues to use its CloudFront URL and separate data.

### Production domain

Production serves `https://podiumpanda.com` (the apex only, not `www`). CDK uses an existing public Route 53 hosted zone in the same AWS account, creates an ACM certificate in `us-east-1` with DNS validation, and adds IPv4/IPv6 aliases to the production CloudFront distribution. Other AWS resources incur charges.

1. Make sure exactly one public hosted zone named `podiumpanda.com` exists in the account and is authoritative for the domain. CDK looks it up by name; the certificate cannot validate until public DNS delegates to it. Existing apex A or AAAA records must be migrated before CDK can create its aliases; plan any DNS cutover to avoid disrupting existing services. Other records are not managed by this stack.
2. Bootstrap the same account in both regions if needed, then deploy production once locally:

   ```sh
   pnpm build
   pnpm cdk bootstrap --profile huskey aws://YOUR_ACCOUNT_ID/eu-west-1
   pnpm cdk bootstrap --profile huskey aws://YOUR_ACCOUNT_ID/us-east-1
   pnpm run deploy --profile huskey --context stage=prod
   ```

   CDK requests and DNS-validates the certificate; no manual certificate is needed. The lookup requires Route 53 read access (the CDK bootstrap lookup role provides it) and is cached in the ignored `cdk.context.json`; run `pnpm cdk context --clear` if the hosted zone changes. Issuance, CloudFront deployment and DNS propagation can take time. The production stack outputs `Url`, `ApiUrl`, and `GitHubRoleArn`. Production data is separate from development; browser-stored shortcuts are also specific to each origin and do not migrate to the new domain.

CDK uses local esbuild, not Docker. S3 and DynamoDB are retained if the stack is deleted. DynamoDB point-in-time recovery is enabled. CloudFront forwards authorization headers only to the uncached backend behavior. SPA rewrites apply only to `/`, `/g/*` and `/c/*`, never to backend failures.

## GitHub Actions

Repository: https://github.com/RikClaessens/podiumpanda

Create a GitHub environment named `dev`, and set its variable `AWS_DEPLOY_ROLE_ARN` to the `GitHubRoleArn` output. Restrict that environment to `main`. Pushes to `main` run build, typecheck, lint, formatting, and Vitest before deploying with AWS OIDC. Pull requests run verification only.

After the initial production deployment above, create a protected `prod` GitHub environment and set its `AWS_DEPLOY_ROLE_ARN` variable to the production stack's `GitHubRoleArn`. Configure environment approval and restrict eligible branches to `main`. Manually dispatch the workflow from `main` with `stage=prod`; pushes to `main` deploy only development, and pull requests never deploy.

Before deploying, the workflow uses the same GitHub deployment role to assume the existing CDK bootstrap deployment role in each required region: `eu-west-1` for dev, and both `eu-west-1` and `us-east-1` for prod. Both regions must be bootstrapped initially as described above; the bootstrap deployment roles cannot create themselves. The workflow runs `cdk bootstrap` with the corresponding CloudFormation execution role and `--previous-parameters`, preserving existing permissions-boundary and public-access-block settings explicitly.

Bootstrapping can update the shared `CDKToolkit` stacks and affect other applications; in particular, the default bootstrap template can overwrite a customized one. An update can also assign the CDK CloudFormation execution role to a toolkit stack, allowing other principals with stack-update access to use that role. Review the existing configuration and adapt the bootstrap command if necessary before enabling this workflow. The GitHub deployment roles trust the immutable owner/repository IDs and their matching environment, and have infrastructure-management authority through the bootstrap roles, not application-user access.

## Shared links and browser storage

New group links have the form `/g/<group-id>#key=<random-secret>`. The group secret grants equal access to the group, its roster and all its concerts. Concert pages within a group use the same key and their share button shares the group link. The secret stays in the browser URL fragment and is sent to the backend as a bearer header, never a query parameter. Only its SHA-256 hash is persisted in metadata. Every read, edit, history, and undo request validates it.

Existing standalone `/c/<concert-id>#key=...` links and browser shortcuts continue to work independently; they are not automatically imported into a group.

Anyone holding the link can edit everything. Player names are unverified concert data, not identities. Browser local storage remembers up to 50 recent links and the selected player; it is not authoritative storage or ownership. Clearing it loses shortcuts, not concerts. Link revocation/rotation is not implemented in this first version, so share carefully. No analytics or public concert listing is included.

## Data and collaboration

- Group partition key: `GROUP#<uuid>`, with a `META` record for the roster, concert IDs and group revision. A group supports up to 200 roster players and 100 concerts.
- Concert partition key: `CONCERT#<uuid>`.
- Metadata sort key: `META`.
- Entity sort key: `DOC#<uuid>`, with a `kind` discriminator for players, entries, parts, preferences, assignments, floorplans, and objects.
- History sort key: `HISTORY#<zero-padded-revision>`.

Preferences and assignments are separate player-to-part relationships. Multiple players can share a part, and players can hold multiple parts. A setlist entry optionally references a floorplan; otherwise it uses the concert default. Floorplan player/part references do not alter assignments.

Group players are available to every concert and edited on the group page. Concert guests exist only in that concert. Players do not have a fixed instrument: parts describe their roles for individual pieces. Legacy instrument fields remain readable but are not used for assignments. Group players cannot be removed once the group has concerts, protecting references and undo history; their names can still be edited. Concurrent group-roster updates conflict with concert writes rather than overwriting them.

Workspaces show concert data first; editing players, setlists, allocations, details, and floorplans is an explicit action. Empty sections offer creation directly. Preferences appear in a scrollable piece-and-part by player grid; choose a player to edit their preferences across the setlist. “Favorite” is the highest preference, marked with a yellow star, and existing ratings and notes remain available. Assignments are grouped by piece in a compact part-and-player overview, including parts with nobody assigned. “Only show me” shows only the selected player's assigned pieces and parts; turn it off to assign more parts. Floorplans cannot be dragged until editing is enabled.

Floorplan objects include squares, rectangles, and tapered melodic instruments alongside chairs, stands and labels. In edit mode, drag objects to move them, use the selection handles to resize or rotate them, and edit their labels in the sidebar. Gridlines can be shown or hidden; PNG exports follow that setting and omit editing handles. Legacy player and part references are preserved.

Active group and concert views poll every two seconds and pause polling in hidden tabs; concert polling slows down after errors. Writes update individual documents and atomically increment a concert-wide revision. Stale drafts produce explicit conflicts instead of silently overwriting another edit. Revision checks are deliberately conservative: even unrelated intervening edits can require a reload.

Snapshot reads check metadata revisions before and after strongly consistent paginated document reads. Deletions remove dependent allocations and clear optional stage references. Each successful edit stores enough history to undo the latest shared edit, including deletion. Undo is itself a new edit; undoing an undo acts as redo. History is not an attribution or identity audit.

Transactions are limited to 80 changed documents and 300 KB of undo data per edit. Oversized operations fail explicitly; split large deletions/reorders into smaller changes. Concert creation and backend traffic have API Gateway throttling, but production use should add per-client abuse protection and AWS billing alarms. Offline editing, automatic allocation, concert duplication, and link rotation are not included yet.
