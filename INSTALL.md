# Install Dashboard Studio

This guide takes about 10 minutes. Do the steps in order. After each step there's a **✅ You should now see** check, so you always know it worked before you move on.

If something doesn't match, jump to [If something goes wrong](#if-something-goes-wrong).

---

## Step 0: Find out which kind of Home Assistant you have

1. Open Home Assistant.
2. Select **Settings** in the sidebar.
3. Select **About** (near the bottom of the Settings page).
4. Look for the line **Installation type**.

| It says | Follow |
| --- | --- |
| **Home Assistant OS** | [Path A: the add-on](#path-a-the-add-on-recommended) |
| **Home Assistant Supervised** | [Path A: the add-on](#path-a-the-add-on-recommended) |
| **Home Assistant Container** | [Path B: the card only](#path-b-the-card-only) |
| **Home Assistant Core** | [Path B: the card only](#path-b-the-card-only) |

Most people have **Home Assistant OS**. If you bought a Home Assistant Green or Yellow, or put Home Assistant on a Raspberry Pi from the official guide, that's you.

---

## Path A: the add-on (recommended)

The add-on puts the whole Studio in your sidebar. It knows your devices and rooms, and installs dashboards for you in one click.

### A1. Add this repository to Home Assistant

**The easy way:** open this page on the same computer or phone where you use Home Assistant, then select this button:

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fpcorcoran20%2Fha-dashboard-studio)

- If it asks for your Home Assistant address, type the one you normally use, like `http://homeassistant.local:8123`, and select **Save**.
- Home Assistant opens and asks **"Add repository?"**. Select **Add**.

**The manual way** (only if the button didn't work):

1. In Home Assistant, go to **Settings**, then **Add-ons**.
2. Select **Add-on store** (bottom right corner).
3. Select the **three dots** (top right corner), then **Repositories**.
4. In the box, paste exactly: `https://github.com/pcorcoran20/ha-dashboard-studio`
5. Select **Add**, then **Close**.

✅ **You should now see:** a **Dashboard Studio** section in the add-on store. You may need to scroll down to find it.

### A2. Install the add-on

1. In the add-on store, select **Dashboard Studio**.
2. Select **Install**.
3. Wait. The first install builds the add-on on your device, so it can take **2 to 10 minutes**. Don't close the page or restart while it says "Installing".

✅ **You should now see:** a **Start** button where the Install button was.

### A3. Start it and put it in your sidebar

1. Turn on **Show in sidebar**.
2. Select **Start**.
3. Wait about 10 seconds.

✅ **You should now see:** **Dashboard Studio** in your sidebar, with a dashboard-and-pencil icon. If it doesn't appear, reload the page.

### A4. Open the Studio

1. Select **Dashboard Studio** in the sidebar.

✅ **You should now see:** the Studio, with your home's name and a **green dot** in the top right corner. The green dot means it's connected to your devices.

If the dot is red, see [The dot is red](#the-dot-in-the-top-right-is-red).

### A5. Make your dashboard and install it

1. Design your dashboard. The sample layout is a fine starting point.
2. Select **Export** (top right corner).
3. Select **Install to Home Assistant** (bottom of the window).
4. Wait a few seconds.

✅ **You should now see:** a checklist. Green ticks mean done. Orange **!** marks mean "look at this", and each one tells you exactly what to do.

5. Select **Open your dashboard**.

🎉 **That's it.** Your new dashboard is also in the sidebar from now on.

### A6. Make themes work (one time only, and only if the checklist asked)

If the checklist said **Themes** with an orange **!**, Home Assistant needs one setting so it can read theme files. You only ever do this once.

1. Go to **Settings**, then **Add-ons**, then **Add-on store**.
2. Search for **File editor**, select it, then **Install**. (It's an official add-on.)
3. Turn on **Show in sidebar**, then select **Start**.
4. Select **File editor** in the sidebar.
5. Select the **folder icon** (top left), then **configuration.yaml**.
6. Look through the file for a line that starts with `frontend:`.
   - **If there is no `frontend:` line**, go to the very bottom of the file and add these two lines exactly. The second line starts with **two spaces**:
     ```yaml
     frontend:
       themes: !include_dir_merge_named themes
     ```
   - **If there already is a `frontend:` line**, don't add a second one. Add only this line right under it, starting with **two spaces**:
     ```yaml
       themes: !include_dir_merge_named themes
     ```
7. Select the **red save icon** (top right).
8. Go to **Settings**. Select the **three dots** (top right), then **Restart Home Assistant**, then **Restart Home Assistant** again to confirm.
9. When Home Assistant is back, open **Dashboard Studio**, then **Export**, then **Install to Home Assistant** again.

✅ **You should now see:** a green tick next to **Themes**.

### A7. Optional: the frosted glass look

The frosted blur, Pride flag borders and per-block styles need a free extra called **card-mod**. Skip this if you don't use those. Everything else works without it.

1. Make sure you have **HACS**. If you don't, follow the official guide at [hacs.xyz](https://hacs.xyz/docs/use/).
2. Open **HACS** in the sidebar.
3. Search for **card-mod**, select it, then **Download**, then **Download** again.
4. Reload your browser.

✅ **You should now see:** frosted cards on your dashboard, if your theme uses them.

---

## Path B: the card only

Use this if you don't have the add-on store, or you only want the live cards. You'll design in the web Studio and paste the result into Home Assistant.

You need **HACS** first. If you don't have it, follow the official guide at [hacs.xyz](https://hacs.xyz/docs/use/).

### B1. Add the card to HACS

**The easy way:**

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=pcorcoran20&repository=ha-dashboard-studio&category=plugin)

Select **Open link**, then in HACS select **Download**, then **Download** again.

**The manual way:**

1. Open **HACS** in the sidebar.
2. Select the **three dots** (top right), then **Custom repositories**.
3. In **Repository**, paste: `https://github.com/pcorcoran20/ha-dashboard-studio`
4. In **Type**, choose **Dashboard**.
5. Select **Add**, then close the window.
6. Search HACS for **Dashboard Studio**, select it, then **Download**, then **Download** again.

✅ **You should now see:** HACS asks you to reload. Select **Reload**, or reload the browser yourself.

### B2. Add the cards to a dashboard

1. In the web Studio, open **Export** and turn on **Use the Dashboard Studio card**.
2. Copy the **Dashboard** tab.
3. In Home Assistant, go to **Settings**, then **Dashboards**, then **Add dashboard**, then **New dashboard from scratch**. Give it a name and select **Create**.
4. Open the new dashboard. Select the **pencil** (top right), then the **three dots**, then **Raw configuration editor**.
5. Delete everything in the box, paste what you copied, then select **Save** and close the editor.

✅ **You should now see:** your dashboard with the hub and effects.

Then do the other tabs in Export (**Theme**, **Scenes**, **Good night script**) by following the **How to install** tab there.

---

## Updating

- **Add-on:** Home Assistant tells you when there's an update. Go to **Settings**. If you see **Dashboard Studio update available**, select it, then **Update**. Then open the Studio and select **Install to Home Assistant** once, so your dashboard gets the new card too.
- **HACS:** open **HACS**. If Dashboard Studio shows an update, select it, then **Update**, then reload your browser.

## Removing it

- **Add-on:** go to **Settings**, then **Add-ons**, then **Dashboard Studio**, then **Uninstall**. Your dashboards stay. Delete them under **Settings**, then **Dashboards**, if you don't want them.
- **HACS:** open **HACS**, select **Dashboard Studio**, then the **three dots**, then **Remove**.

---

## If something goes wrong

### I can't find Dashboard Studio in the add-on store

1. In the add-on store, select the **three dots** (top right), then **Check for updates**.
2. Reload the page and scroll down the whole list.
3. Still missing? Do step [A1](#a1-add-this-repository-to-home-assistant) again with the manual way, and check the address is exactly `https://github.com/pcorcoran20/ha-dashboard-studio`.

### The install fails or never finishes

1. Go to **Settings**, then **Add-ons**, then **Dashboard Studio**, then the **Log** tab.
2. Copy everything in it and send it to whoever helps you. It says exactly what went wrong.
3. Check your system is 64-bit: the add-on runs on **amd64** and **aarch64** (that includes a Raspberry Pi 4 or 5). It doesn't run on 32-bit systems.

### The dot in the top right is red

1. Go to **Settings**, then **Add-ons**, then **Dashboard Studio**, then **Restart**.
2. Open the Studio again.
3. Still red? Open the **Log** tab and look for a line that starts with `[studio]`.

### The dashboard says "Custom element doesn't exist"

The browser is still using an old copy of the page.

- **On a computer:** hold **Ctrl** and **Shift** and press **R**. On a Mac, hold **Cmd** and **Shift** and press **R**.
- **In the phone app:** go to **Settings**, then **Companion app**, then **Debugging**, then **Reset frontend cache**. Then close and reopen the app.

### The themes don't show up

Do step [A6](#a6-make-themes-work-one-time-only-and-only-if-the-checklist-asked).

### I don't see the moving background

Something in your theme is covering it. Open the dashboard, select the **pencil**, find the **Dashboard Studio effects** card, select it, and change `layer: behind` to `layer: front`. Then select **Save**.

### Something else

Open an issue at [github.com/pcorcoran20/ha-dashboard-studio/issues](https://github.com/pcorcoran20/ha-dashboard-studio/issues). Include what you did, what you expected, and the add-on log if you have one.
