وثائق API — CreatoClone

الملخص
هذا الملف يشرح نقاط النهاية (endpoints) المتاحة في الخادم وطريقة استخدامها مع أمثلة curl. جميع الروابط في الأمثلة ينبغي استبدالها بالعناوين الحقيقية (مثلاً https://creatoclone1.onrender.com).

ملاحظات مهمة
- لا ترسل روابط من النوع `blob:` في حقل `content` — هذه روابط محلية للمتصفح ولن يتمكن الخادم من الوصول إليها.
- استخدم إما: روابط عامة http(s) أو ارفع الملف إلى /api/upload أولاً لتحصل على رابط عام، أو استخدم data: (base64) للصور الصغيرة.
- ffmpeg يجب أن يكون مثبتاً على السيرفر (في Dockerfile مضمّن تثبيت ffmpeg).

نقاط النهاية

1) POST /api/upload
- وظيفته: رفع ملف (multipart/form-data) وإرجاع رابط عام داخل /uploads
- حقل الفورم: file

مثال curl:
curl -X POST "https://your-host/api/upload" -F "file=@/path/to/image.jpg"

استجابة ناجحة:
{ "url": "https://your-host/uploads/167123456789-image.jpg" }


2) POST /api/templates
- حفظ قالب (template) بصيغة JSON. يعيد template_id
- Body: JSON كامل القالب (template_info, modifications, render_settings)

مثال curl (بعد رفع الملفات واستبدال content بروابط عامة):
curl -X POST "https://your-host/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "template_info": { "name":"My","canvas_size": {"width":1280,"height":720},"total_duration":10 },
    "modifications": {
      "vis": {"id":"vis","type":"image","content":"https://your-host/uploads/my.jpg","transform":{},"timing":{"start_time":0,"duration":10}}
    },
    "render_settings": {"format":"mp4","fps":25,"quality":"high","callback_url":"https://n8n.your-webhook"}
  }'

استجابة:
{ "template_id": "tpl_abc123" }


3) POST /api/templates/:id/render
- يضع مهمة رندر في الطابور (queue) ويعيد task_id
- يمكن تمرير body فارغ أو حقل modifications لتجاوز القالب المحفوظ

مثال:
curl -X POST "https://your-host/api/templates/tpl_abc123/render" -H "Content-Type: application/json" -d '{}'

استجابة:
{ "task_id": "r_abc123", "status": "queued" }


4) GET /api/renders/:id
- استعلام حالة مهمة الرندر
- الاستجابة تحتوي على status و mp4_url عند الانتهاء أو error

مثال:
curl "https://your-host/api/renders/r_abc123"

نماذج استجابة:
- أثناء الانتظار: { "id":"r_...","status":"queued" }
- عند النجاح: { "id":"r_...","status":"done","mp4_url":"https://your-host/uploads/render-....mp4" }
- عند الفشل: { "id":"r_...","status":"error","error":"message" }


5) (اختياري) POST /api/render
- نقطة نهاية قديمة/مباشرة: ترسِل payload كامل وسيَحاول الخادم تنفيذ render بشكل متزامن.
- لا ترسل blob: في المحتويات — إن وُجدت ستُعاد رسالة خطأ.
- يُستخدم عادة للـ testing أو عندما تريد رد فوري (قد تكون العملية بطيئة)

مثال:
curl -X POST "https://your-host/api/render" -H "Content-Type: application/json" -d '{...}'


نمط عمل مقترح للـ n8n (مخطط سريع)
- Webhook أو Trigger يستقبل الـ assets أو يُشير إلى ملفات محلية
- لكل ملف → HTTP Request (POST) إلى /api/upload (Send Binary Data)
- بعد رفع كل الملفات → Function/Set لبناء payload حيث تكون كل `modification.content` رابط public المرفوع
- POST /api/templates
- POST /api/templates/:id/render
- استخدم Poll أو Webhook (callback_url) لتلقي النتيجة النهائية (mp4_url)

أمثلة عملية مختصرة
1) رفع صورة ثم عمل رندر (shell):
# 1) ارفع الصورة
curl -F "file=@/tmp/img.jpg" https://your-host/api/upload
# استلم URL من الاستجابة، وافترض https://your-host/uploads/img.jpg
# 2) احفظ قالب
curl -X POST https://your-host/api/templates -H "Content-Type: application/json" -d '{"template_info":{"name":"t"},"modifications":{"v":{"type":"image","content":"https://your-host/uploads/img.jpg","timing":{"start_time":0,"duration":5}}},"render_settings":{"format":"mp4","fps":25}}'
# 3) أنشئ مهمة
curl -X POST https://your-host/api/templates/<template_id>/render
# 4) راقب الحالة
curl https://your-host/api/renders/<task_id>


ملاحظات أمنية وتشغيلية
- حد طول payloads: تجنب إرسال ملفات كبيرة كـ data:base64 في JSON.
- للاحتفاظ بالملفات بعد إعادة النشر استخدم S3 أو persistent disk (Render).
- ضع حدوداً وحصصاً لمنع استهلاك الموارد.

إن أردت، أستطيع:
- توليد ملف n8n workflow جاهز (JSON) يُنَفَّذ مباشرة ليقوم بعملية الرفع، البناء، إنشاء المهمة، والـ polling. اكتب "أرسل الـ workflow" وسأجهّزه.