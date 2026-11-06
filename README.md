# Calm Feed for Facebook

**Facebook on the web with only the people and pages you follow.** Calm Feed is a small userscript that runs on facebook.com in Safari on iPhone. It:

- hides posts from pages, groups and people you don't follow (posts with a **Follow**, **Join** or **Add friend** button)
- hides **"Suggested for you"** and **"People you may know"**
- hides **ads**: posts marked "Ad" or "Sponsored", even when the word is scrambled, and posts with an ad button like "Shop now"
- hides **Reels** in the feed and sends you home if you land on the Reels page
- hides the **Video** tab and its endless feed
- hides **"Open app"** buttons and bars

**Marketplace is left completely alone.** Posts are only hidden on your home feed, so Marketplace, groups, profiles and notifications work as usual. Videos and reels that friends post or send you still open.

> Calm Feed is not affiliated with, endorsed by, or connected to Facebook or Meta.

## Privacy

Calm Feed only hides and redirects things on the page you're looking at. It makes **no network requests** and never reads your password, messages, or cookies. You log in on Facebook's own website in Safari, the same as without it. The whole thing is one readable file: [`calm-feed-facebook.user.js`](calm-feed-facebook.user.js).

## Install on iPhone

1. Install **Userscripts** from the App Store if you don't have it yet. It's free and [open source](https://github.com/quoid/userscripts).
2. Turn it on: **Settings → Apps → Safari → Extensions → Userscripts**. Switch it on and set **facebook.com** to **Allow**.
3. In Safari, open this link:
   **https://raw.githubusercontent.com/lmxproject/calm-feed-facebook/main/calm-feed-facebook.user.js**
4. Tap the **page menu icon** next to the address bar (it looks like **ᴀA** or a puzzle piece) → **Userscripts** → **Install**.
5. Go to **facebook.com** in Safari and log in.

### Make it feel like an app

1. On facebook.com in Safari, tap **Share → Add to Home Screen**.
2. Switch **"Open as Web App" off**, then tap **Add**.

This step matters: Safari extensions **don't run inside Home Screen web apps**. With "Open as Web App" off, the icon opens a normal Safari tab, where Calm Feed works.

## Settings

Open `calm-feed-facebook.user.js` and change `true` to `false` at the top for anything you want to keep:

```js
const SETTINGS = {
  hideNotFollowing: true, // hide posts with a "Follow", "Join" or "Add friend" button
  hideSuggested: true,    // hide "Suggested for you" and "People you may know"
  hideSponsored: true,    // hide ads
  hideAdButtons: true,    // also hide posts with an ad button like "Shop now" or "Learn more"
  hideReels: true,        // hide Reels in the feed and leave the Reels page
  hideVideoTab: true,     // hide the Video tab and leave its endless feed
  hideOpenApp: true,      // hide "Open app" buttons and bars
};
```

**Facebook not in English?** Posts are found by their label text. Add the exact text you see in your language to `LABELS`.

## Updates

Calm Feed checks this repository for new versions (`@updateURL`). When Facebook changes its website and something stops working, a fix pushed here reaches your phone automatically. To get it sooner, open the Userscripts extension in Safari and tap **Update**.

## Known limits

- **Safari only on iPhone.** It works on the Facebook website, not in the Facebook app.
- **No push notifications**, because you're using the website.
- **Facebook changes its site often**, and serves different versions to different browsers. Something may slip through or break until the script is updated.
- **The feed order stays Facebook's own.** Calm Feed removes posts from the normal feed; it doesn't switch to a newest-first feed.
- **A friend's share can be hidden too.** If a friend shares a post from a page you don't follow and it shows a **Follow** button, the whole post is hidden. If that hides too much, set `hideNotFollowing` to `false`.
- **Some ads can still get through.** Facebook works to dodge blockers, for example by showing "Sponsored" as a picture. An ad like that with no ad button won't be caught.
- **Ad buttons can catch normal posts.** A page you follow might post a link with a "Learn more" button, and that post gets hidden too. If you miss those, set `hideAdButtons` to `false`.

## How it works

- **Redirects.** Facebook's website changes pages without reloading, so the script checks the address a few times a second. If you're on the Reels page or the Video tab, it sends you home. If Facebook keeps undoing a redirect, the script gives up on that redirect for the rest of the tab.
- **Hiding.** On the home feed, the script looks for the exact words above, such as "Follow" or "Sponsored", and hides the post they belong to. A caption that merely mentions those words is left alone. Rows that aren't posts, like "People you may know", are hidden on their own, never anything containing your normal posts.

## Fixing it when Facebook changes

[`debug/calm-feed-debug.user.js`](debug/calm-feed-debug.user.js) is a helper script that adds a yellow **Page info** button to Facebook. It shows how the page is built so the rules can be corrected. It sends nothing anywhere and leaves out post text and names, though a short caption containing a word like "friend" or "video" can still appear, so read it before sharing. Remove it when you're done.

## Testing

Open `test/test.html` through a local web server and check that every test passes:

```bash
python3 -m http.server 8767
```

Then visit http://localhost:8767/test/test.html.

## License

[MIT](LICENSE)
