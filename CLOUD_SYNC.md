# 电脑与手机同步设置

EnglishAI V2 的本机素材库仍可离线使用。云端同步需自行创建一个 Supabase 项目；网页只保存项目地址、公开的 publishable key 和该设备的登录会话。不要将 secret/service_role key 输入网页、提交到 GitHub 或发到聊天里。

1. 在 [Supabase](https://supabase.com/dashboard) 新建项目。进入 **Storage → New bucket**，名称填 `englishai-media`，保持 **Private**。免费方案单个文件最大 50 MB，超过的本机视频会跳过上传并显示提示。
2. 在 **SQL Editor** 执行以下规则。它们只允许已登录用户操作自己账号 ID 对应文件夹内的对象：

```sql
create policy "englishai read own media"
on storage.objects for select to authenticated
using (bucket_id = 'englishai-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "englishai upload own media"
on storage.objects for insert to authenticated
with check (bucket_id = 'englishai-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "englishai update own media"
on storage.objects for update to authenticated
using (bucket_id = 'englishai-media' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'englishai-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "englishai delete own media"
on storage.objects for delete to authenticated
using (bucket_id = 'englishai-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
```

3. 在 **Project Settings → API Keys** 找到项目地址和 **publishable key**。打开 EnglishAI 网页的“☁️ 电脑和手机同步”，在电脑和手机上分别填入这两项并保存。这两项不是管理员密钥；保护私有文件的是登录和上面的访问规则。
4. 在电脑点击“注册”，用自己的邮箱和密码注册。默认需要打开验证邮件中的链接。验证后在电脑、手机都用同一邮箱登录。Supabase 的默认邮件服务有速率限制，收不到邮件时需在项目里配置邮件发送服务。
5. 电脑导入视频及对应字幕，等待“同步完成”并确认显示上传数量。手机打开同一个 EnglishAI 网址并登录；等待下载完成，在“已保存的视频”里打开。再次打开页面或切回页面时会自动检查；也可点“立即同步”。

只有已经登录时，网页才会上传或下载。同步上传的是视频文件及对应字幕；单词本、笔记和复习进度仍用原有 JSON 备份方式转移。超过 50 MB 的视频仅在本机保存，不会出现在另一设备。删除视频时，如果已登录，会同时删除云端副本；“删除本机保存的素材”只清除当前设备。网络中断时素材继续留在本机，下次打开或点“立即同步”会重试。首次同步大视频可能较慢，建议保持页面打开。

参考：[Supabase 私有存储与访问规则](https://supabase.com/docs/guides/storage/security/access-control)、[文件大小限制](https://supabase.com/docs/guides/storage/uploads/file-limits)、[免费方案额度](https://supabase.com/pricing)、[邮箱密码登录](https://supabase.com/docs/guides/auth/passwords)。
