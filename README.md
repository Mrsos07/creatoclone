# CreatoClone AI - Video Automation Platform

مشروع متطور لأتمتة صناعة الفيديو باستخدام تقنيات Google Gemini و Veo و ElevenLabs.

## تعليمات الرفع على GitHub

لرفع المشروع على مستودعك الخاص `https://github.com/Mrsos07/creatoclone.git` كرر الخطوات التالية في الـ Terminal الخاص بك:

```bash
# 1. تهيئة المستودع المحلي
git init

# 2. إضافة كافة الملفات
git add .

# 3. تسجيل التغييرات
git commit -m "Initial commit: AI Video Editor with Docker support"

# 4. ربط المستودع المحلي بالبعيد
git remote add origin https://github.com/Mrsos07/creatoclone.git

# 5. رفع الملفات (تأكد من تغيير اسم الفرع إذا لزم الأمر)
git branch -M main
git push -u origin main
```

## التشغيل باستخدام Docker

يمكنك تشغيل المشروع محلياً أو على السيرفر باستخدام Docker:

```bash
# بناء وتشغيل الحاوية
docker-compose up -d --build
```

سيصبح المشروع متاحاً على الرابط: `http://localhost:8080`

## التقنيات المستخدمة
- **Frontend:** React + Tailwind CSS + Lucide Icons
- **AI Models:** Google Gemini 3 Pro (Reasoning), Veo 3.1 (Video Gen)
- **Audio:** ElevenLabs API (Arabic Voice Synthesis)
- **Deployment:** Docker + Nginx
