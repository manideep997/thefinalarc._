# LeetCode Auto-Commit Bot

This repository is connected to LeetCode. Whenever you solve a problem, a GitHub Action automatically detects it and commits it with the commit message set to the question name and number (e.g. `1. Two Sum`).

<!-- LEETCODE_START -->
### 📊 My Solved Problems (5)

| Problem ID | Title | Difficulty | Language | Date Solved |
| :---: | :--- | :---: | :---: | :---: |
| 1 | Two Sum | 🟢 Easy | `python` | 2026-07-02 |
| 2 | Add Two Numbers | 🟡 Medium | `python` | 2026-07-11 |
| 21 | Merge Two Sorted Lists | 🟢 Easy | `python` | 2026-07-06 |
| 206 | Reverse Linked List | 🟢 Easy | `python` | 2026-07-13 |
| 1295 | Find Numbers with Even Number of Digits | 🟢 Easy | `python3` | 2026-02-18 |

*Last synced on: Mon, 13 Jul 2026 12:55:19 GMT*
<!-- LEETCODE_END -->

## 🚀 Setup Instructions

1. **Configure your Username**:
   - Open `.github/workflows/leetcode-sync.yml` and replace the `LEETCODE_USERNAME` environment variable with your LeetCode username.

2. **Enable Write Permissions**:
   - Go to your repository settings on GitHub: **Settings -> Actions -> General**.
   - Scroll down to **Workflow permissions**.
   - Select **Read and write permissions** and click **Save**. This allows the action to commit statistics updates back to your repository.

3. **Trigger the First Run**:
   - Go to the **Actions** tab in your GitHub repository.
   - Click on the **Sync LeetCode Stats** workflow.
   - Click **Run workflow** -> **Run workflow** to trigger it manually. It will run automatically every few hours to capture new solved problems!
