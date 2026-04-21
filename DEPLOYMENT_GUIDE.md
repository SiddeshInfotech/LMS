# 📦 LMS Enterprise Deployment Guide

This guide provides the official procedure for building and installing the **Siddesh Global Education Society** LMS application on Linux systems.

---

## 🛠️ Section 1: Administrator Build (Preparation)
Before sharing the software with a school, you must package it into a `.deb` file.

1.  **Sync latest changes**:
    `npm run build`
2.  **Generate Linux Package**:
    `npm run package-linux`
3.  **Locate Artifact**:
    The installer will be generated at: `dist_electron/LMS_1.0.2_amd64.deb`

---

## 🏫 Section 2: School Installation (Zero-Fail Procedure)
Follow these steps on every target Linux machine.

### 1. Install Dependencies
Ensure the system has all required video and system libraries:
```bash
sudo apt-get update
sudo apt-get install -f
```

### 2. Install the LMS Package
Navigate to the folder containing your `.deb` file and run:
```bash
sudo dpkg -i ai-and-mechatronix-lab_1.0.3_amd64.deb
```
*The installer will automatically configure the secure Hardware Anchor and system paths.*

### 3. Verify Installation (Optional)
If you see dependency errors, run `sudo apt-get install -f` to fix them. You can then launch the app by searching for "LMS Secure" in your menu.

---

## 🛡️ Section 3: Activation & Locking
1.  **Launch the App**: Look for "LMS Secure" in your application menu or run `lms-secure` in the terminal.
2.  **Deployment Wizard**:
    *   **Step 1**: Capture the Machine ID (for admin records).
    *   **Step 2**: Enter the **School Name**, **License ID**, and **Activation Signature**.
    *   **Step 3**: Click "Activate System".
3.  **The Lock**: The app will bind itself to the PC's SSD. This machine is now permanently activated.

---

## ❓ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"Failed to create Hardware Anchor"** | Run `sudo chmod 777 /etc/lms` again. |
| **Video doesn't play** | Ensure the SSD hasn't been replaced since activation. |
| **App won't open (Linux)** | Run with `--no-sandbox` if using a restricted environment like WSL. |

---

**Siddesh Global Secure Deployment Protocol v1.0.2**
