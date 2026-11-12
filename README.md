# EnglishAI V2

静态 PWA。保留 V1 的本地 iPhone 视频导入、SRT/VTT 双语字幕、点击字幕跳转、逐句循环、录音与回放；新增六个学习入口。本机使用无需账号；可选的电脑与手机视频同步需自行配置 Supabase 项目，设置方法见 [CLOUD_SYNC.md](CLOUD_SYNC.md)。

| 入口 | 当前实现 |
| --- | --- |
| 字幕 | 导入、粘贴或载入示例双语字幕，点选句子跳转 |
| 跟读 | 视频原声、设备英文 TTS、录音回放；可试用浏览器语音识别并查看文字差异 |
| 听写 | 播放当前句并输入英文，显示缺少与多出的词 |
| 填空 | 从当前英文字幕隐藏一个单词，检查答案 |
| Quiz | 从至少三句有不同中文译文的字幕生成释义选择题 |
| AI 对话 | 可选 Netlify Function + OpenAI 服务端；配置密钥后进行英文文字对话、设备朗读和浏览器语音输入 |

字幕中的英文单词可以逐词点击，查看中文参考义、英文释义及整句语境；可收藏到单词本、填写笔记并用卡片复习。复习卡片提供“听发音”按钮，用设备英文语音朗读当前单词；“认识了”会安排 1、3、7、14、30 天后的下次复习，“再练习”会保留在待复习队列中，也可随时点“复习全部”。单词本可导出为 JSON 备份，并在另一台设备导入；导入会添加新单词，保留当前已有的词和笔记。备份包含笔记和复习进度，请自行妥善保存。示例句常用词有本地释义；其他单词会尝试查询 [Free Dictionary API](https://dictionaryapi.dev/) 和 [MyMemory](https://mymemory.translated.net/doc/spec.php)。点击查询只向这些服务发送所点单词，服务不可用时仍可保存单词和手写笔记。单词本存于当前浏览器的本地存储，不自动跨设备同步，也可能在清除站点数据后消失。

只载入示例字幕时，“播放本句”会使用设备英文 TTS；选择视频后改为播放视频原句。浏览器语音识别的可用性取决于浏览器、网络和权限，尤其是 iPhone Safari。文字差异反馈**不是发音评分**。设备 TTS 声音取决于系统安装的语音。导入的视频和字幕会尝试保存在当前浏览器的 IndexedDB，重新打开同一网址时自动恢复；“已保存的视频”中可以打开、切换和删除多个视频，每个视频保留自己的字幕。旧版本保存的单个视频仍可在列表中打开。录音仅在当前页面内存中，关闭后不保留。浏览器语音识别可能由浏览器服务处理语音。AI 对话的文字会发送到 Netlify Function 和 OpenAI；对话仅保留在当前页面内存中，刷新即清空。AI 对话会产生 API 调用费用。

本机保存受可用空间和浏览器策略限制。大视频保存失败时仍可在当前页面使用，页面会显示原因。Safari 可能在设备空间不足等情况下清除网站数据，因此原始视频仍应保留在“照片”或“文件”；切换 Netlify 网址也不会自动转移本机素材。[WebKit 存储政策](https://webkit.org/blog/14403/updates-to-storage-policy/)说明了空间限制与数据清除条件。云端同步只包含视频及其字幕，单词本仍需使用 JSON 备份。免费 Supabase 项目单个文件上限 50 MB，视频超过上限时只留在本机。

## 本地检查

无需安装依赖。运行 `node --test tests/*.test.js` 检查字幕解析、练习题、示例字幕朗读、本机保存、云端同步流程、单词本和 AI 服务端请求逻辑。使用任意静态服务器打开根目录进行桌面预览；麦克风、语音识别与 PWA 安装应在 HTTPS 页面测试。静态服务器不会提供 AI 服务端，AI 入口会显示“待接入”。云端同步测试使用模拟服务；真实跨设备同步需连接自己的 Supabase 项目验证。

## iPhone 预览与测试

此 PR 合并之前，GitHub Pages 的 main 站点仍显示 V1。要在 iPhone 预览 V2，可将 `englishai-v2` 分支部署到单独的 HTTPS 预览站点，或使用支持 HTTPS 的静态预览服务部署此分支根目录。不要修改 main 的 Pages 来源。

1. 用 iPhone Safari 打开 V2 预览 HTTPS 地址。如需测试 PWA，点“分享”→“添加到主屏幕”，从主屏幕打开。
2. 选择相册或“文件”中的 MP4/MOV，再导入英文一行、中文一行的 SRT/VTT。等待“已加入本机素材库”和字幕保存提示，刷新页面检查视频和字幕自动恢复。再导入另一段视频和字幕，展开“已保存的视频”，切换两段视频，确认各自字幕对应。点字幕，检查跳转、上一句/下一句和循环；关闭循环，检查句尾暂停。视频格式还需受 iPhone Safari 支持。
3. 打开“跟读”，测试英文朗读、麦克风授权、录音停止与回放。点击“尝试识别我的朗读”，检查支持提示、识别文字与差异反馈；若 Safari 不提供接口，按钮应禁用并提示原因。
4. 打开“听写”和“填空”输入正确及错误答案，检查反馈；打开 Quiz 选答案及下一题。若 AI 服务已配置，打开“AI 对话”，选择话题并发送一句英文，检查回复和“听回复”；若未配置，应显示“待接入”。
5. 如以前安装过 V1，关闭并重开应用或刷新一次，再检查新入口。Service worker 缓存已升级为 V2。
6. 在“字幕”点英文单词，确认词义卡片能打开；收藏后打开“我的单词本”复习，点“听发音”确认当前单词能朗读，再点“认识了”检查待复习数量减少。点“复习全部”可再次看到该词；点“再练习”检查它回到待复习队列。写入一条笔记，点“保存备份”保存 JSON 文件；刷新页面检查收藏、笔记和复习状态仍在。要测试恢复，可在另一浏览器的“我的单词本”点“导入备份”。

## 启用 AI 对话（现有 Netlify 预览站点）

AI 密钥只放在 Netlify 的环境变量中，**不要贴到网页、聊天、GitHub 或预览压缩包里**。拖拽上传的静态文件只会显示 AI 入口，不能部署 `netlify/functions/dialogue.mjs`。按 [Netlify 的仓库连接说明](https://docs.netlify.com/build/git-workflows/repo-permissions-linking/) 在现有预览项目中打开 **Project configuration → Developer settings → Continuous deployment → Repository → Link repository**，选择 `aa18589070603-gif/englishai-pwa`，将部署分支设为 `englishai-v2`。项目根目录的 `netlify.toml` 会运行 `scripts/build.mjs`，把公开网页文件放进 `dist`，同时部署 Functions。不要选择 `main`。

然后在 Netlify 项目的 **Environment variables** 新增 `OPENAI_API_KEY`，值填入你自己的 OpenAI API 密钥；确保变量可供 Functions 使用，保存后重新部署 `englishai-v2`。手机 Safari 打开预览网址，进入“AI 对话”；顶部应显示“已连接”。密钥配置和运行方式见 [Netlify Functions 环境变量文档](https://docs.netlify.com/build/functions/environment-variables/)。服务端使用 [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) 和 `gpt-6-luna`，限制每次消息长度、历史和回复字数，并按 IP 限制请求频率；仍建议在 OpenAI 账户设置自己的用量预算。

当前开发 PR 不会更改或合并 `main`，GitHub Pages 的 V1 也不会因预览部署而改变。
