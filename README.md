# EnglishAI PWA 第一版

功能：本地视频导入、SRT/VTT 双语字幕、点击句子跳转、逐句循环、麦克风录音及回放。

## 部署到 GitHub Pages
1. 新建公开 GitHub 仓库，例如 `englishai-pwa`。
2. 将此文件夹中的 `index.html`、`manifest.webmanifest`、`sw.js`、`icon-192.png`、`icon-512.png` 上传到仓库根目录（不要上传 ZIP 代替这些文件）。
3. 仓库 Settings → Pages → Build and deployment → Deploy from a branch，选择 `main` 和 `/(root)`，保存。
4. 等待部署后访问 `https://你的用户名.github.io/englishai-pwa/`。
5. iPhone Safari 打开该 HTTPS 地址 → 分享 → 添加到主屏幕。

## 注意
- 这是可部署源码，不是已经上线的网站。
- Safari 需要允许麦克风，录音只保存在当前页面内存，刷新后消失。
- 视频文件和字幕文件均不上传服务器；本地视频选择需在重新打开后再次选择。
- 示例字幕用于展示功能，需要有时间匹配的视频才会同步播放。
- 尚无 AI 对话、语音识别和发音评分。
