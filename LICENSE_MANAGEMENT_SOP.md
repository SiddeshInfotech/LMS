# 🛡️ School-Wide License Management (SOP)

This document outlines the workflow for managing the **Self-Binding Static License** system. This system allows you to use a single "School Key" on hundreds of machines while maintaining physical hardware security.

---

## 1. How the Security Works
The system uses a **Dual-Layer Lock**:
1.  **Layer 1 (The Signature)**: Verifies that you (the Admin) authorized the school name.
2.  **Layer 2 (The Hardware Anchor)**: The first time a machine is activated with the school key, it "Anchors" itself to that machine's unique **SSD Serial**. Even if the license/signature is leaked, it won't work on other unauthorized SSDs.

---

## 2. Admin: Generating a School-Wide License
To create a key that works for **all** PCs in a specific school, use the terminal on your admin machine:

**Command Format:**
`node tools/sign_license.cjs "SCHOOL_WIDE" "[SCHOOL_NAME]" "1.0.2"`

**Example for "Global Public School":**
`node tools/sign_license.cjs "SCHOOL_WIDE" "Global-Public-School" "1.0.2"`

**The Output:**
You will receive two pieces of data to send to the school:
*   **LICENSE ID**: `LIC-XXXXXX`
*   **SECURITY SIGNATURE**: (A long string of random characters)

---

## 3. School: Initial Activation Process
On every PC in the school, the staff follows these steps:

1.  **Launch LMS**: The app will open the **School Deployment Wizard**.
2.  **Enter Details**:
    *   **SCHOOL NAME**: Must match exactly what you signed (e.g., `Global-Public-School`).
    *   **LICENSE ID**: Paste the ID provided.
    *   **SECURITY SIGNATURE**: Paste the long signature string.
3.  **Active & Bind**: Click "Activate School PC". The app will instantly create a hidden `machine.lock` file on that machine.

---

## 4. Maintenance & Security Protection
*   **Preventing Sharing**: If a student copies the `LMS` folder or `.deb` files to their home laptop, the **Hardware Anchor** (SSD Serial) will not match. The app will detect the change and say `HARDWARE_MISMATCH`.
*   **Video Protection**: All videos are encrypted. The decryption key is locked to the hardware anchor. If the hardware is tampered with, the videos will refuse to play.

---

## 5. Troubleshooting Common Errors

| Error Code | Meaning | Solution |
| :--- | :--- | :--- |
| **TAMPERED** | Signature doesn't match the School Name. | Ensure "School Name" is typed EXACTLY as it was signed (case-sensitive). |
| **HARDWARE_MISMATCH** | The app was activated on a different machine. | The app folder was copied from another PC. Must delete `machine.lock` and reactivate for this machine. |
| **CORRUPT** | System failed to read the hardware ID or lock file. | Run with `sudo` permissions or check if the SSD is readable. |

---

## 6. How to Reset / Re-install (Troubleshooting)
If you need to move a license to a new machine or clear a "CORRUPT" state, you must delete these **three** files to reset the app to its "Unlicensed" out-of-the-box state:

| File Type | Location (Linux/WSL) |
| :--- | :--- |
| **Active License** | `~/.config/ai-and-mechatronix-lab/license.lic` |
| **Hardware Binding** | `~/.config/ai-and-mechatronix-lab/machine.lock` |
| **System Anchor** | `/etc/lms/machine.lock` (requires `sudo`) |

**Quick Reset Command:**
```bash
sudo rm -f /etc/lms/machine.lock && rm -f ~/.config/ai-and-mechatronix-lab/license.lic ~/.config/ai-and-mechatronix-lab/machine.lock
```

---

## 7. Current Static Test Credentials
Use these keys to test your installation wizard immediately:

*   **SCHOOL NAME**: `Siddesh-Global-Education-Society`
*   **LICENSE ID**: `LIC-444486`
*   **SECURITY SIGNATURE**: `VCMG8987*&`
*   **SECURITY SIGNATURE**: 
```text
OOjHzl0qVIO930+mxNsKMR7lx/OUderaJmufYK1Z40t6x+WHvLNcKgfbYY9sZ9jWPx+sfgu6yJIJJ4tJzxfJfNDaWvzjnNwezVOjB8WBK3VfdkQroOF4qUmckrNQKu0BVBbaegARrSwt1AQBOWFkat6f98WAwrslBX8CGYQRT97md8O7W2E+4P0N87ePZ+uq2hmAIa4JFhMQytC0Y6bpeHqLP/uN8cTTOgM62EGubNmuAHcm39UpXXktesAhr6rd4trCtWzizg0rvp5F2LqdWmqS5lOcJFv7RfL5UGTM6bjPqwixJey+MoQj3QfbTXGI7KSOd2rohL6Q8kDhcynF1Q==
```
rameshwar_gulave@LAPTOP-SC1LTRAO:~/LMS-Deploy/LMS/LMS$ node tools/generate_activation_code.cjs "SCHOOL_WIDE" "Siddesh-Global-Education-Society"













🔑 GENERATING ACTIVATION CODE FOR: Siddesh-Global-Education-Society
-----------------------------------------------
👉 CODE: VCMG8987*&
-----------------------------------------------

✅ SUCCESS! Registry file created at: ./registry/VCMG8987*&.json
🚀 UPLOAD THIS FILE TO: https://api.siddesh.com/license-keys/VCMG8987*&.json

rameshwar_gulave@LAPTOP-SC1LTRAO:~/LMS-Deploy/LMS/LMS$ npm run package-linux