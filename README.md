# ⚡ InstantClip — Instant Phone & Laptop Sync

> A lightning-fast, zero-friction text and clipboard bridge between your Phone and Laptop. Transfer text, URLs, OTPs, and code in **< 50 milliseconds** without WhatsApp's slow startup or chat clutter.

---

## 🌟 Key Features

- **⚡ Blazing Fast (<50ms Sync)**: Powered by real-time WebSockets. As soon as you hit send or paste, it instantly pops up on your other device.
- **📱 Zero-App Install (PWA)**: Works right in any browser on Android, iPhone, Windows, Mac, or Linux. Can be "Added to Home Screen" as a standalone app.
- **📷 Instant QR Code Pairing**: Open on your laptop, point your phone's camera at the screen, and you're paired. No accounts or logins required.
- **📋 1-Click "Paste & Send"**: One tap reads your clipboard and broadcasts it to your other device immediately.
- **⚡ Auto-Copy on Receive**: Incoming text can automatically copy to your system clipboard without you even touching a button.
- **🔗 Smart URL Detection**: Detects links and gives you a 1-tap "Open Link" button.
- **🔒 Private Rooms**: Default room `sync` or switch to any private room code for isolation.
- **📲 Mobile "Share via..." Target**: On Android/iOS, you can share text or links from any app directly into InstantClip.

---

## 🚀 How to Run

### Option 1: Double-Click (Easiest)
Simply double-click **`start.bat`**. It will start the server and automatically open the web app in your browser!

### Option 2: Command Line
```bash
npm start
```

---

## 📲 How to Connect Your Phone

1. **Keep Phone & Laptop on the same Wi-Fi**.
2. Open InstantClip on your laptop (`http://localhost:3000`).
3. Click **"📱 Pair Phone"** at the top right to show your QR Code.
4. Open your phone's camera app and scan the QR code (or visit `http://<YOUR_LOCAL_IP>:3000`).
5. **Done!** Anything you paste or type on one device appears instantly on the other.

---

## 💡 Pro Tips

* **Add to Phone Home Screen**: In Chrome on Android (or Safari on iOS), tap the menu `⋮` and select **"Add to Home screen"** or **"Install App"**. It will look and launch just like a native mobile app!
* **Keyboard Shortcut**: Press `Ctrl + Enter` (or `Cmd + Enter`) to instantly send what you typed.
* **Sound Alerts**: You can toggle the subtle chime on/off in the top settings bar.

---

## 🌐 Want to use it outside your home Wi-Fi (over 4G/5G)?
You can deploy this repository to **Render**, **Railway**, or **Fly.io** for free in 2 minutes:
1. Push this folder to a free GitHub repository.
2. Connect it to [Render.com](https://render.com) (choose Web Service, build command `npm install`, start command `npm start`).
3. Now you get a permanent `https://your-app.onrender.com` link that works anywhere in the world!
