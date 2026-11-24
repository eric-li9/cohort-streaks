# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Run a cohort pilot

Unistreak uses one Node.js server with a persistent local volume. The current deployment
target is the Nitro Node server, which can serve phones and desktops on the same site.
Lovable's managed edge publishing would need a shared storage integration before it can
host this pilot.

1. Use Node 22.12+ or 24 and install dependencies with `npm install`.
2. Set `UNISTREAK_ROSTER` to a JSON array with one entry per participant. Each entry
   needs a stable, unique `id`, a `name`, a club `role`, a `group`, and a unique personal
   `code`. Set `"admin": true` only for program heads. Use the same group name for
   teammates and invite at least two members per group. Generate each code with
   `node -e 'console.log(require("node:crypto").randomBytes(24).toString("base64url"))'`
   and share it privately with its owner. Codes are reusable sign-in credentials.
3. Optionally set `UNISTREAK_REWARD` to a whole-dollar reimbursement amount (defaults
   to 25 CAD, set to 0 to disable).
4. Run `npm run dev` for local development. For the pilot, run `npm run build` and
   `node .output/server/index.mjs`. Set the runtime variables on the server process.
   Set `UNISTREAK_ORIGIN` to the public HTTPS origin (for example
   `https://unistreak.example.org`) and `UNISTREAK_DATA` to an absolute path on its
   persistent volume. Run a single server process and back up that volume. The default
   local data file is `.unistreak/state.json`. Keep the roster, invite codes, and data file private.

Roster entry shape

```json
{
  "id": "maya",
  "name": "Maya Chen",
  "role": "Analyst",
  "group": "Seed Stage",
  "admin": false,
  "code": "<replace-with-a-generated-code>"
}
```

Weeks run from Monday through Sunday in Toronto. Two members of the same group must
log and confirm the meetup within the same week. Extra meetups can be confirmed and
shared in the feed. A group earns at most one streak increment per week. Each group
starts with one freeze, automatically used when an active streak would otherwise
expire. Three separate meetup weeks unlock one reimbursement per group. Program
heads record reimbursement after paying it outside the site.
